using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddHttpClient();

var app = builder.Build();
app.UseCors();

const string OutletId = "apotek";
const string OutletName = "Apotek";
const string CloudApi = "http://localhost:5180/api";

var dataDir = Path.Combine(app.Environment.ContentRootPath, "Data");
Directory.CreateDirectory(dataDir);
var stateFile = Path.Combine(dataDir, "local_state.json");
var syncLock = new object();
var state = LocalApotekState.LoadOrCreate(stateFile, OutletId, OutletName);

var menuGroups = new List<MenuGroup>
{
    new("Dashboard Outlet", "DB", ["Ringkasan Hari Ini", "Status Koneksi", "Antrean Sinkronisasi"]),
    new("Penjualan", "PJ", ["Resep", "Penjualan Bebas (OTC)", "Retur Penjualan", "Cek Stok Cepat"]),
    new("Kasir", "KS", ["Transaksi", "Tutup Kasir"]),
    new("Pelayanan Farmasi", "FA", ["Telaah Resep", "Peracikan", "Etiket & Info Obat", "Narkotika/Psikotropika"]),
    new("Stok Obat", "SO", ["Stok per Batch", "Penerimaan Barang", "Permintaan ke Pusat", "Mutasi & Opname", "Obat Rusak/Expired"]),
    new("Integrasi", "IT", ["SATUSEHAT Medication", "BPJS PRB"]),
    new("Laporan Apotek", "LA", ["Penjualan", "Stok", "Laba", "Narkotika/Psikotropika", "Obat Terlaris"]),
    new("Sinkronisasi", "SY", ["Status Sinkron Cloud", "Log Sinkronisasi", "Sinkron Manual", "Data Tertunda Offline"]),
    new("Pengguna Outlet", "PO", ["Daftar User Outlet", "Permintaan Perubahan Akses"]),
    new("Pengaturan Lokal", "PL", ["Profil Outlet", "Printer & Perangkat", "Backup Lokal", "Versi & Lisensi"])
};

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", outlet = OutletId, isOnline = state.IsOnline }));
app.MapGet("/api/outlet-info", () => new
{
    brand = "Klinik Group",
    subtitle = $"Server lokal · {OutletName}",
    outletId = OutletId,
    outletName = OutletName,
    outletType = "apotek",
    outletLabel = "Apotek",
    connectionText = state.IsOnline ? "Terhubung ke VPS" : "Mode Offline (Lokal)",
    connectionStatus = state.IsOnline ? "ok" : "bad",
    masterVersion = state.MasterVersion,
    activationCode = state.ActivationCode
});
app.MapGet("/api/menu", () => menuGroups);
app.MapGet("/api/state", () => { lock (syncLock) { return Results.Ok(state); } });

app.MapGet("/api/dashboard", () =>
{
    lock (syncLock)
    {
        return Results.Ok(new
        {
            stats = new[]
            {
                new { label = "Transaksi hari ini", value = state.Sales.Count.ToString() },
                new { label = "Penjualan", value = $"Rp {state.TodaySalesMillions:0.0} jt".Replace('.', ',') },
                new { label = "Obat hampir expired", value = state.Batches.Count(b => b.IsNearExpired).ToString() },
                new { label = "Antre sinkron", value = state.SyncOutbox.Count(s => s.Status != "Tersinkron").ToString() }
            },
            connections = new[]
            {
                new { name = "Internet", status = state.IsOnline ? "ok" : "bad", label = state.IsOnline ? "Normal" : "Terputus" },
                new { name = "VPS pusat", status = state.IsOnline ? "ok" : "warn", label = state.IsOnline ? "Terhubung" : "Antre Lokal" },
                new { name = "SATUSEHAT", status = state.IsOnline ? "ok" : "warn", label = state.IsOnline ? "Siap" : "Antre FHIR" },
                new { name = "BPJS PRB", status = state.IsOnline ? "ok" : "warn", label = state.IsOnline ? "Siap" : "Offline" }
            },
            offlineMessage = "Semua menu tetap berjalan. Data disimpan di server lokal dan dikirim otomatis saat internet kembali."
        });
    }
});

app.MapPost("/api/pos/sale", (ApotekSaleDto req) =>
{
    lock (syncLock)
    {
        var amtMillions = Math.Round(req.TotalRp / 1_000_000m, 3);
        var trx = new ApotekSale($"POS-APT-{500 + state.Sales.Count + 1}", DateTime.Now.ToString("HH:mm"), req.SaleType, req.BuyerName, req.ItemsSummary, req.Signa ?? "Sesuai petunjuk", $"Rp {req.TotalRp:N0}", amtMillions, req.Pharmacist ?? "Sari Lestari, S.Farm., Apt.", "Lunas");
        state.Sales.Insert(0, trx);
        state.TodaySalesMillions = Math.Round(state.TodaySalesMillions + amtMillions, 2);
        var batch = state.Batches.FirstOrDefault(b => b.Code == req.KfaCode);
        if (batch != null) batch.Qty = Math.Max(0, batch.Qty - req.Qty);
        state.AddOutbox("Penjualan", $"{trx.TrxNo} ({req.SaleType}) - {req.BuyerName} ({trx.DisplayTotal})", amtMillions);
        state.Save(stateFile);
        return Results.Ok(trx);
    }
});

app.MapPost("/api/pharmacy/narcotics", (NarcoticDto req) =>
{
    lock (syncLock)
    {
        var rec = new NarcoticRegister($"NRK-{DateTime.Now:HHmmss}", DateTime.Now.ToString("yyyy-MM-dd"), req.DrugName, req.PatientName, req.PatientAddress, req.DoctorName, req.QtyOut, Math.Max(0, 120 - req.QtyOut), "Sari Lestari, S.Farm., Apt.");
        state.NarcoticRegisters.Insert(0, rec);
        state.AddOutbox("Narkotika", $"Register SIPNAP {req.DrugName} ({req.QtyOut} tab) - {req.PatientName}", 0m);
        state.Save(stateFile);
        return Results.Ok(rec);
    }
});

app.MapPost("/api/sync/toggle", (ToggleOnlineDto req) => { lock (syncLock) { state.IsOnline = req.IsOnline; state.Save(stateFile); return Results.Ok(new { isOnline = state.IsOnline }); } });
app.MapPost("/api/sync/push-now", async (IHttpClientFactory httpFactory) =>
{
    List<LocalOutboxItem> pending;
    lock (syncLock) { pending = state.SyncOutbox.Where(s => s.Status != "Tersinkron").ToList(); }
    if (pending.Count == 0) return Results.Ok(new { pushed = 0 });
    try
    {
        var client = httpFactory.CreateClient();
        var resp = await client.PostAsJsonAsync($"{CloudApi}/sync/push", new { outletId = OutletId, outletName = OutletName, items = pending });
        if (resp.IsSuccessStatusCode)
        {
            lock (syncLock) { foreach (var p in pending) p.Status = "Tersinkron"; state.IsOnline = true; state.Save(stateFile); }
            return Results.Ok(new { pushed = pending.Count, synced = true });
        }
    }
    catch { }
    return Results.Ok(new { pushed = 0, synced = false });
});

app.MapGet("/api/users", () => state.Users);
app.MapPost("/api/users", (CreateUserRequest req) =>
{
    lock (syncLock)
    {
        var u = new UserOutlet(req.Name ?? "Apoteker Baru", req.Role ?? "Apoteker", OutletName, "Aktif", state.IsOnline ? "Tersinkron" : "Menunggu (offline)");
        state.Users.Add(u);
        state.Save(stateFile);
        return Results.Ok(u);
    }
});

app.Run();

record MenuGroup(string Name, string Code, string[] Items);
record UserOutlet(string Name, string Role, string Outlet, string Status, string SyncStatus);
record CreateUserRequest(string? Name, string? Outlet, string? Role, string? Email, string? Nik, string? StrSip, string? MultiOutlet);
record ApotekSaleDto(string SaleType, string BuyerName, string ItemsSummary, string KfaCode, int Qty, decimal TotalRp, string? Signa, string? Pharmacist);
record NarcoticDto(string DrugName, string PatientName, string PatientAddress, string DoctorName, int QtyOut);
record ToggleOnlineDto(bool IsOnline);

record ApotekSale(string TrxNo, string Time, string Type, string Buyer, string Items, string Signa, string DisplayTotal, decimal AmountMillions, string Pharmacist, string Status);
record NarcoticRegister(string RegId, string Date, string DrugName, string PatientName, string PatientAddress, string DoctorName, int QtyOut, int RemainingStock, string Pharmacist);
class ApotekBatch(string code, string name, string batchNo, string expiredDate, int qty, string rack, bool isNearExpired)
{
    public string Code { get; set; } = code;
    public string Name { get; set; } = name;
    public string BatchNo { get; set; } = batchNo;
    public string ExpiredDate { get; set; } = expiredDate;
    public int Qty { get; set; } = qty;
    public string Rack { get; set; } = rack;
    public bool IsNearExpired { get; set; } = isNearExpired;
}
class LocalOutboxItem(string id, string entityType, string summary, decimal amountMillions, string createdAt, string status)
{
    public string Id { get; set; } = id;
    public string EntityType { get; set; } = entityType;
    public string Summary { get; set; } = summary;
    public decimal AmountMillions { get; set; } = amountMillions;
    public string CreatedAt { get; set; } = createdAt;
    public string Status { get; set; } = status;
}

class LocalApotekState
{
    public string OutletId { get; set; } = "";
    public string OutletName { get; set; } = "";
    public string ActivationCode { get; set; } = "KLN-APT3-A9";
    public int MasterVersion { get; set; } = 1;
    public bool IsOnline { get; set; } = true;
    public decimal TodaySalesMillions { get; set; } = 21.7m;
    public List<UserOutlet> Users { get; set; } = [];
    public List<ApotekSale> Sales { get; set; } = [];
    public List<NarcoticRegister> NarcoticRegisters { get; set; } = [];
    public List<ApotekBatch> Batches { get; set; } = [];
    public List<LocalOutboxItem> SyncOutbox { get; set; } = [];

    public void AddOutbox(string entityType, string summary, decimal amountMillions)
    {
        SyncOutbox.Insert(0, new LocalOutboxItem($"SYN-{DateTime.Now:HHmmss}-{Random.Shared.Next(10, 99)}", entityType, summary, amountMillions, DateTime.Now.ToString("HH:mm:ss"), IsOnline ? "Tersinkron" : "Menunggu (Offline)"));
    }

    public void Save(string path) => File.WriteAllText(path, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));

    public static LocalApotekState LoadOrCreate(string path, string outletId, string outletName)
    {
        if (File.Exists(path))
        {
            try { var s = JsonSerializer.Deserialize<LocalApotekState>(File.ReadAllText(path)); if (s != null) return s; } catch { }
        }
        var created = new LocalApotekState
        {
            OutletId = outletId,
            OutletName = outletName,
            Users = [
                new("Sari Lestari", "Apoteker", outletName, "Aktif", "Tersinkron"),
                new("Dina Kasir", "Kasir", outletName, "Aktif", "Tersinkron")
            ],
            Sales = [
                new("POS-APT-501", "08:40", "Resep Dokter", "Hendra Wijaya", "Amoxicillin 500mg (10), Paracetamol 500mg (10)", "3x1 sesudah makan", "Rp 125.000", 0.125m, "Sari Lestari, S.Farm., Apt.", "Lunas"),
                new("POS-APT-502", "08:49", "Penjualan Bebas (OTC)", "Pelanggan Umum", "Vitamin C 500mg Strip", "1x1 sesudah makan", "Rp 65.000", 0.065m, "Sari Lestari, S.Farm., Apt.", "Lunas")
            ],
            NarcoticRegisters = [
                new("NRK-01", "2026-11-27", "Codeine 10mg Tablet", "Tn. Suryadi", "Jl. Margonda No. 12, Depok", "Dr. Andi Wijaya", 10, 110, "Sari Lestari, S.Farm., Apt.")
            ],
            Batches = [
                new("KFA-93001", "Amoxicillin 500mg Kaplet", "AMX-2511C", "2027-07-19", 880, "APT-B2", false),
                new("KFA-93003", "Cefixime 100mg Kapsul", "CFX-2512K", "2027-01-15", 140, "APT-B1", true),
                new("KFA-93009", "Codeine 10mg Tablet", "CDN-2504N", "2027-01-18", 110, "LEMARI-NARKO", true)
            ]
        };
        created.Save(path);
        return created;
    }
}
