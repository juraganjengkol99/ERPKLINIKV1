using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors();

var dataDir = Path.Combine(app.Environment.ContentRootPath, "Data");
Directory.CreateDirectory(dataDir);
var stateFile = Path.Combine(dataDir, "cloud_state.json");

var state = CloudState.LoadOrCreate(stateFile);
var syncLock = new object();

app.MapGet("/api/cloud-info", () => new
{
    brand = "Klinik Group",
    subtitle = "Server pusat (VPS)",
    mode = "cloud",
    connectionText = $"{state.Outlets.Count(o => o.IsOnline)}/{state.Outlets.Count} outlet online",
    connectionStatus = state.Outlets.All(o => o.IsOnline) ? "ok" : "warn"
});

app.MapGet("/api/menu", () => state.MenuGroups);

app.MapGet("/api/dashboard", () =>
{
    lock (syncLock)
    {
        var onlineCount = state.Outlets.Count(o => o.IsOnline);
        var totalVisits = state.Outlets.Sum(o => o.TodayVisits);
        var totalRevenue = state.Outlets.Sum(o => o.TodayRevenueMillions);
        var pendingSync = state.Outlets.Sum(o => o.PendingSyncCount);

        return new
        {
            stats = new[]
            {
                new { label = "Outlet online", value = $"{onlineCount} dari {state.Outlets.Count}" },
                new { label = "Kunjungan hari ini", value = totalVisits.ToString() },
                new { label = "Pendapatan hari ini", value = $"Rp {totalRevenue:0.0} jt".Replace('.', ',') },
                new { label = "Data menunggu sinkron", value = pendingSync.ToString() }
            },
            outlets = state.Outlets,
            recentSyncLogs = state.SyncLogs.OrderByDescending(l => l.Timestamp).Take(20).ToList()
        };
    }
});

app.MapGet("/api/outlets", () => state.Outlets);

app.MapPost("/api/outlets", (CreateOutletRequest req) =>
{
    lock (syncLock)
    {
        var code = $"KLN-{Guid.NewGuid().ToString("N")[..4].ToUpper()}-A9";
        var name = string.IsNullOrWhiteSpace(req.Name) ? "Klinik Cabang Bekasi" : req.Name;
        var type = string.IsNullOrWhiteSpace(req.Type) ? "Klinik Utama" : req.Type;
        var id = name.ToLowerInvariant().Replace(" ", "-");
        var item = new OutletNode
        {
            OutletId = id,
            Name = name,
            Type = type,
            IsOnline = true,
            ConnectionLabel = "Online",
            ConnectionStatus = "ok",
            LastSync = "Baru saja",
            SatuSehatLabel = "Terkirim",
            SatuSehatStatus = "ok",
            BpjsLabel = type == "Apotek" ? "PRB aktif" : (type == "Klinik Pratama" ? "P-Care aktif" : "VClaim aktif"),
            BpjsStatus = "ok",
            TodayVisits = 0,
            TodayRevenueMillions = 0m,
            PendingSyncCount = 0,
            ActivationCode = code,
            Address = req.Address ?? "Bekasi",
            Nib = req.Nib ?? "91203018201"
        };
        state.Outlets.Add(item);
        state.Save(stateFile);
        return Results.Ok(new { outlet = item, activationCode = code });
    }
});

app.MapGet("/api/users", () => state.Users);

app.MapPost("/api/users", (CreateUserRequest req) =>
{
    lock (syncLock)
    {
        var outletTarget = string.IsNullOrWhiteSpace(req.Outlet) ? "Klinik Utama" : req.Outlet;
        var outletOnline = state.Outlets.FirstOrDefault(o => o.Name.Equals(outletTarget, StringComparison.OrdinalIgnoreCase))?.IsOnline ?? true;
        var newUser = new UserRecord(
            Guid.NewGuid().ToString("N")[..8],
            string.IsNullOrWhiteSpace(req.Name) ? "Dewi Anggraini" : req.Name,
            string.IsNullOrWhiteSpace(req.Role) ? "Dokter" : req.Role,
            outletTarget,
            "Aktif",
            outletOnline ? "Tersinkron" : "Menunggu (offline)",
            req.Email ?? "user@klinik.id",
            req.Nik ?? "3275010101900001",
            req.StrSip ?? "STR-2026-9981"
        );
        state.Users.Add(newUser);
        state.MasterVersion++;
        state.SyncLogs.Add(new SyncLogEntry(
            Guid.NewGuid().ToString("N")[..8],
            DateTime.Now.ToString("HH:mm:ss"),
            "CLOUD -> LOKAL",
            outletTarget,
            "UserOutlet",
            $"User baru {newUser.Name} ({newUser.Role})",
            outletOnline ? "Tersinkron" : "Menunggu Cabang Online"
        ));
        state.Save(stateFile);
        return Results.Ok(newUser);
    }
});

app.MapGet("/api/inventory", () => state.InventoryItems);

app.MapPost("/api/inventory", (InventoryItemRecord item) =>
{
    lock (syncLock)
    {
        var created = item with
        {
            Code = string.IsNullOrWhiteSpace(item.Code) ? $"KFA-{Random.Shared.Next(10000, 99999)}" : item.Code
        };
        state.InventoryItems.Add(created);
        state.MasterVersion++;
        state.SyncLogs.Add(new SyncLogEntry(
            Guid.NewGuid().ToString("N")[..8],
            DateTime.Now.ToString("HH:mm:ss"),
            "CLOUD -> LOKAL",
            "Semua Outlet",
            "MasterBarangKFA",
            $"Update Master KFA: {created.Name} ({created.Code})",
            "Tersinkron"
        ));
        state.Save(stateFile);
        return Results.Ok(created);
    }
});

app.MapGet("/api/finance", () => state.JournalEntries);

// Endpoint Sinkronisasi Dua Arah (Dipanggil oleh Server Lokal)
app.MapPost("/api/sync/status", (OutletStatusUpdate req) =>
{
    lock (syncLock)
    {
        var outlet = state.Outlets.FirstOrDefault(o =>
            o.OutletId.Equals(req.OutletId, StringComparison.OrdinalIgnoreCase) ||
            o.Name.Equals(req.OutletName, StringComparison.OrdinalIgnoreCase));

        if (outlet != null)
        {
            outlet.IsOnline = req.IsOnline;
            outlet.ConnectionLabel = req.IsOnline ? "Online" : "Offline";
            outlet.ConnectionStatus = req.IsOnline ? "ok" : "bad";
            outlet.PendingSyncCount = req.PendingCount;
            outlet.LastSync = req.IsOnline ? "Baru saja" : "Terputus (Offline)";
            outlet.SatuSehatLabel = req.PendingCount > 0 ? $"{req.PendingCount} antre" : "Terkirim";
            outlet.SatuSehatStatus = req.PendingCount > 0 ? "warn" : "ok";
            outlet.BpjsStatus = req.IsOnline ? "ok" : "warn";
            outlet.BpjsLabel = req.IsOnline
                ? (outlet.Type == "Apotek" ? "PRB aktif" : (outlet.Type == "Klinik Pratama" ? "P-Care aktif" : "VClaim aktif"))
                : (outlet.Type == "Apotek" ? "PRB tertunda" : (outlet.Type == "Klinik Pratama" ? "P-Care tertunda" : "VClaim tertunda"));

            if (req.IsOnline)
            {
                for (int i = 0; i < state.Users.Count; i++)
                {
                    if (state.Users[i].Outlet.Equals(outlet.Name, StringComparison.OrdinalIgnoreCase) &&
                        state.Users[i].SyncStatus != "Tersinkron")
                    {
                        state.Users[i] = state.Users[i] with { SyncStatus = "Tersinkron" };
                    }
                }
            }

            state.Save(stateFile);
        }
        return Results.Ok(new { success = true, masterVersion = state.MasterVersion });
    }
});

app.MapPost("/api/sync/push", (SyncPushBatchRequest batch) =>
{
    lock (syncLock)
    {
        var outlet = state.Outlets.FirstOrDefault(o =>
            o.OutletId.Equals(batch.OutletId, StringComparison.OrdinalIgnoreCase) ||
            o.Name.Equals(batch.OutletName, StringComparison.OrdinalIgnoreCase));

        if (outlet != null)
        {
            outlet.IsOnline = true;
            outlet.ConnectionLabel = "Online";
            outlet.ConnectionStatus = "ok";
            outlet.LastSync = "Baru saja";
            outlet.PendingSyncCount = 0;
            outlet.SatuSehatLabel = "Terkirim";
            outlet.SatuSehatStatus = "ok";
            outlet.BpjsStatus = "ok";
            outlet.BpjsLabel = outlet.Type == "Apotek" ? "PRB aktif" : (outlet.Type == "Klinik Pratama" ? "P-Care aktif" : "VClaim aktif");

            foreach (var item in batch.Items)
            {
                if (item.EntityType is "Pendaftaran" or "Kunjungan" or "Penjualan")
                {
                    outlet.TodayVisits += 1;
                }
                if (item.AmountMillions > 0)
                {
                    outlet.TodayRevenueMillions += item.AmountMillions;
                    state.JournalEntries.Insert(0, new JournalEntryRecord(
                        $"JRN-{DateTime.Now:HHmmss}-{Random.Shared.Next(10, 99)}",
                        DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
                        outlet.Name,
                        item.Summary,
                        $"Rp {(item.AmountMillions * 1_000_000m):N0}",
                        "Tersinkron Otomatis"
                    ));
                }

                state.SyncLogs.Add(new SyncLogEntry(
                    item.Id,
                    DateTime.Now.ToString("HH:mm:ss"),
                    "LOKAL -> CLOUD",
                    outlet.Name,
                    item.EntityType,
                    item.Summary,
                    "Tersinkron"
                ));
            }

            state.Save(stateFile);
        }

        return Results.Ok(new
        {
            acceptedIds = batch.Items.Select(i => i.Id).ToArray(),
            masterVersion = state.MasterVersion
        });
    }
});

app.MapGet("/api/sync/pull", (string? outletName) =>
{
    lock (syncLock)
    {
        var users = string.IsNullOrWhiteSpace(outletName)
            ? state.Users
            : state.Users.Where(u => u.Outlet.Equals(outletName, StringComparison.OrdinalIgnoreCase)).ToList();

        return Results.Ok(new
        {
            masterVersion = state.MasterVersion,
            users,
            inventory = state.InventoryItems
        });
    }
});

app.Run();

record MenuGroup(string Name, string Code, string[] Items);
record UserRecord(string Id, string Name, string Role, string Outlet, string Status, string SyncStatus, string Email, string Nik, string StrSip);
record InventoryItemRecord(string Code, string Name, string Category, int CentralStock, string Unit, string Price, string ExpiredDate);
record JournalEntryRecord(string Code, string Date, string Outlet, string Description, string Amount, string Status);
record SyncLogEntry(string Id, string Timestamp, string Direction, string Outlet, string EntityType, string Summary, string Status);
record CreateUserRequest(string? Name, string? Outlet, string? Role, string? Email, string? Nik, string? StrSip, string? MultiOutlet);
record CreateOutletRequest(string? Type, string? Name, string? Nib, string? Address, string? SatuSehatOrgId, string? SatuSehatLocId, string? BpjsPpkCode, string? AdminEmail);
record OutletStatusUpdate(string OutletId, string OutletName, bool IsOnline, int PendingCount);
record SyncOutboxItemDto(string Id, string EntityType, string Summary, decimal AmountMillions, string CreatedAt);
record SyncPushBatchRequest(string OutletId, string OutletName, List<SyncOutboxItemDto> Items);

class OutletNode
{
    public string OutletId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public bool IsOnline { get; set; } = true;
    public string ConnectionLabel { get; set; } = "Online";
    public string ConnectionStatus { get; set; } = "ok";
    public string LastSync { get; set; } = "Baru saja";
    public string SatuSehatLabel { get; set; } = "Terkirim";
    public string SatuSehatStatus { get; set; } = "ok";
    public string BpjsLabel { get; set; } = "VClaim aktif";
    public string BpjsStatus { get; set; } = "ok";
    public int TodayVisits { get; set; }
    public decimal TodayRevenueMillions { get; set; }
    public int PendingSyncCount { get; set; }
    public string ActivationCode { get; set; } = "";
    public string Address { get; set; } = "";
    public string Nib { get; set; } = "";
}

class CloudState
{
    public int MasterVersion { get; set; } = 1;
    public List<MenuGroup> MenuGroups { get; set; } = [];
    public List<OutletNode> Outlets { get; set; } = [];
    public List<UserRecord> Users { get; set; } = [];
    public List<InventoryItemRecord> InventoryItems { get; set; } = [];
    public List<JournalEntryRecord> JournalEntries { get; set; } = [];
    public List<SyncLogEntry> SyncLogs { get; set; } = [];

    public void Save(string path)
    {
        var json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(path, json);
    }

    public static CloudState LoadOrCreate(string path)
    {
        if (File.Exists(path))
        {
            try
            {
                var existing = JsonSerializer.Deserialize<CloudState>(File.ReadAllText(path));
                if (existing != null && existing.Outlets.Count > 0)
                    return existing;
            }
            catch { }
        }

        var s = new CloudState
        {
            MenuGroups =
            [
                new("Dashboard", "DB", ["Ringkasan Seluruh Outlet", "Kinerja per Outlet", "Status Sinkronisasi", "Status Integrasi", "Notifikasi"]),
                new("Manajemen Outlet", "MO", ["Daftar Outlet", "Tambah Outlet Baru", "Template Modul per Tipe", "Pengaturan Cabang", "Lisensi & Aktivasi", "Arsip Outlet"]),
                new("HR", "HR", ["Data Karyawan", "Manajemen User", "Role & Permission", "Absensi & Jadwal", "STR/SIP & Kompetensi", "Penggajian & Jasa Medis", "Rekrutmen & Kinerja"]),
                new("Keuangan", "KE", ["Kas & Bank", "Penerimaan", "Pengeluaran", "Piutang BPJS & Asuransi", "Hutang Supplier", "Anggaran", "Rekonsiliasi Setoran"]),
                new("Akunting", "AK", ["Chart of Accounts", "Jurnal", "Buku Besar", "Laporan Keuangan", "Konsolidasi Outlet", "Aset Tetap", "Pajak"]),
                new("Purchasing", "PU", ["Permintaan Pembelian", "Purchase Order", "Penerimaan Barang", "Retur Pembelian", "Master Supplier"]),
                new("Inventory", "IN", ["Master Barang (KFA)", "Stok Konsolidasi", "Mutasi Antar Outlet", "Stok Opname", "Batch & Expired", "Gudang Pusat"]),
                new("GA", "GA", ["Aset & Inventaris", "Pemeliharaan & Kalibrasi", "Perizinan Outlet", "Kendaraan", "Vendor Jasa"]),
                new("Marketing", "MK", ["Data Pasien Konsolidasi", "Promo & Paket", "Loyalitas", "Broadcast WhatsApp/SMS", "Survei Kepuasan"]),
                new("Integrasi", "IT", ["SATUSEHAT: Konfigurasi", "SATUSEHAT: Monitoring FHIR", "SATUSEHAT: Mapping Kode", "BPJS: Konfigurasi", "BPJS: Monitoring Klaim", "Sinkronisasi Data"]),
                new("Laporan Konsolidasi", "LP", ["Kunjungan & Pendapatan", "Klaim BPJS", "Stok, SDM, Keuangan", "Laporan Regulasi"]),
                new("Pengaturan Sistem", "PS", ["Master Umum & Tarif", "Keamanan (2FA)", "Audit Trail", "Backup & Restore", "Manajemen Server Lokal"])
            ],
            Outlets =
            [
                new OutletNode
                {
                    OutletId = "klinikutama",
                    Name = "Klinik Utama",
                    Type = "Klinik Utama",
                    IsOnline = true,
                    ConnectionLabel = "Online",
                    ConnectionStatus = "ok",
                    LastSync = "2 menit lalu",
                    SatuSehatLabel = "Terkirim",
                    SatuSehatStatus = "ok",
                    BpjsLabel = "VClaim aktif",
                    BpjsStatus = "ok",
                    TodayVisits = 146,
                    TodayRevenueMillions = 38.2m,
                    PendingSyncCount = 0,
                    ActivationCode = "KLN-UTM1-A9",
                    Address = "Jl. Sudirman No. 10, Jakarta",
                    Nib = "912000112233"
                },
                new OutletNode
                {
                    OutletId = "klinikpratama",
                    Name = "Klinik Pratama",
                    Type = "Klinik Pratama",
                    IsOnline = false,
                    ConnectionLabel = "Offline",
                    ConnectionStatus = "bad",
                    LastSync = "47 menit lalu",
                    SatuSehatLabel = "3 antre",
                    SatuSehatStatus = "warn",
                    BpjsLabel = "P-Care tertunda",
                    BpjsStatus = "warn",
                    TodayVisits = 138,
                    TodayRevenueMillions = 26.5m,
                    PendingSyncCount = 3,
                    ActivationCode = "KLN-PRT2-A9",
                    Address = "Jl. Ahmad Yani No. 45, Bekasi",
                    Nib = "912000445566"
                },
                new OutletNode
                {
                    OutletId = "apotek",
                    Name = "Apotek",
                    Type = "Apotek",
                    IsOnline = true,
                    ConnectionLabel = "Online",
                    ConnectionStatus = "ok",
                    LastSync = "1 menit lalu",
                    SatuSehatLabel = "Terkirim",
                    SatuSehatStatus = "ok",
                    BpjsLabel = "PRB aktif",
                    BpjsStatus = "ok",
                    TodayVisits = 128,
                    TodayRevenueMillions = 21.7m,
                    PendingSyncCount = 0,
                    ActivationCode = "KLN-APT3-A9",
                    Address = "Jl. Gatot Subroto No. 88, Depok",
                    Nib = "912000778899"
                }
            ],
            Users =
            [
                new("USR-01", "Dr. Andi Wijaya", "Dokter", "Klinik Utama", "Aktif", "Tersinkron", "andi@klinik.id", "3171010101850001", "STR-8821921"),
                new("USR-02", "Sari Lestari", "Apoteker", "Apotek", "Aktif", "Tersinkron", "sari@klinik.id", "3171010202900002", "STRA-9912011"),
                new("USR-03", "Rina Putri", "Pendaftaran", "Klinik Pratama", "Aktif", "Menunggu (offline)", "rina@klinik.id", "3275010303950003", "-"),
                new("USR-04", "Budi Santoso", "Kasir", "Klinik Utama", "Nonaktif", "Tersinkron", "budi@klinik.id", "3171010404880004", "-")
            ],
            InventoryItems =
            [
                new("KFA-93001", "Amoxicillin 500mg Kaplet", "Antibiotik", 4500, "Tablet", "Rp 1.500", "2028-05-01"),
                new("KFA-93002", "Paracetamol 500mg Tablet", "Analgesik", 8200, "Tablet", "Rp 800", "2028-11-15"),
                new("KFA-93003", "Cefixime 100mg Kapsul", "Antibiotik", 1800, "Kapsul", "Rp 4.200", "2027-09-20"),
                new("KFA-93004", "Omeprazole 20mg Kapsul", "Gastrointestinal", 3100, "Kapsul", "Rp 2.100", "2028-02-10"),
                new("KFA-93005", "Infus RL 500ml", "Cairan Infus", 950, "Botol", "Rp 18.500", "2027-12-30")
            ],
            JournalEntries =
            [
                new("JRN-0901", "2026-11-27 08:45", "Klinik Utama", "Pendapatan Kasir Rawat Jalan & Inap (Auto-Sync)", "Rp 38.200.000", "Tersinkron Otomatis"),
                new("JRN-0902", "2026-11-27 08:50", "Apotek", "Penjualan Resep & OTC Harian (Auto-Sync)", "Rp 21.700.000", "Tersinkron Otomatis"),
                new("JRN-0903", "2026-11-27 08:00", "Klinik Pratama", "Pendapatan Kasir Pagi (Sebelum Offline)", "Rp 26.500.000", "Tersinkron Otomatis")
            ],
            SyncLogs =
            [
                new("SYN-101", "08:51:10", "LOKAL -> CLOUD", "Apotek", "Penjualan", "128 Transaksi POS & Stok Obat Batch", "Tersinkron"),
                new("SYN-102", "08:50:22", "LOKAL -> CLOUD", "Klinik Utama", "Kunjungan", "146 Kunjungan RME, SEP VClaim & Kasir", "Tersinkron"),
                new("SYN-103", "08:05:14", "CLOUD -> LOKAL", "Klinik Pratama", "UserOutlet", "User Rina Putri menunggu cabang kembali online", "Menunggu (Offline)")
            ]
        };
        s.Save(path);
        return s;
    }
}
