using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddHttpClient();

var app = builder.Build();
app.UseCors();

const string OutletId = "klinikpratama";
const string OutletName = "Klinik Pratama";
const string CloudApi = "http://localhost:5180/api";

var dataDir = Path.Combine(app.Environment.ContentRootPath, "Data");
Directory.CreateDirectory(dataDir);
var stateFile = Path.Combine(dataDir, "local_state.json");
var syncLock = new object();
var state = LocalPratamaState.LoadOrCreate(stateFile, OutletId, OutletName);

static List<MenuGroup> BuildMenu(bool rawatInap)
{
    var groups = new List<MenuGroup>
    {
        new("Dashboard Outlet", "DB", ["Ringkasan Hari Ini", "Status Koneksi", "Antrean Sinkronisasi"]),
        new("Pendaftaran", "PD", rawatInap
            ? ["Pasien Baru/Lama", "Verifikasi BPJS", "Validasi NIK & IHS", "Antrean Online", "Rujukan Masuk", "Admisi & SEP"]
            : ["Pasien Baru/Lama", "Verifikasi BPJS", "Validasi NIK & IHS", "Antrean Online", "Rujukan Masuk"]),
        new("Rawat Jalan", "RJ", ["Antrean Poli", "Pemeriksaan SOAP", "Diagnosa & Tindakan", "Resep Elektronik", "Order Lab/Radiologi", "Rujukan Keluar"])
    };
    if (rawatInap)
    {
        groups.Add(new("Rawat Inap", "RI", ["Kamar & Tempat Tidur", "Pasien Rawat Inap", "CPPT & Asuhan", "Visite Dokter", "Pindah Kamar", "Pulang"]));
        groups.Add(new("IGD", "GD", ["Triase", "Penanganan Gawat Darurat"]));
    }
    groups.Add(new("Rekam Medis", "RM", ["RME", "Riwayat Pasien", "Pengkodean Diagnosa", "Resume Medis", "Informed Consent"]));
    if (rawatInap)
    {
        groups.Add(new("Penunjang Medis", "PM", ["Laboratorium", "Radiologi", "Fisioterapi"]));
    }
    groups.AddRange([
        new("Farmasi", "FA", ["Resep Masuk", "Penyerahan Obat", "Stok Farmasi", "Retur & Expired"]),
        new("Kasir", "KS", ["Tagihan Pasien", "Pembayaran & Deposit", "Tutup Kasir", "Refund"]),
        new("BPJS Kesehatan", "BP", ["Cek Kepesertaan", "P-Care Kunjungan", "Rujukan", "Prolanis & Skrining", "Log Bridging"]),
        new("SATUSEHAT", "SS", ["Status Kirim per Pasien", "Antrean Kirim FHIR", "Kirim Ulang Gagal", "Pencocokan IHS Number"]),
        new("Inventory Outlet", "IV", ["Stok Barang", "Permintaan ke Pusat", "Penerimaan Barang", "Mutasi & Opname"]),
        new("Laporan Outlet", "LO", ["Kunjungan & Diagnosa", "Pendapatan", "Laporan BPJS", "Laporan Regulasi"]),
        new("Sinkronisasi", "SY", ["Status Sinkron Cloud", "Log Sinkronisasi", "Sinkron Manual", "Data Tertunda Offline"]),
        new("Pengguna Outlet", "PO", ["Daftar User Outlet", "Permintaan Perubahan Akses"]),
        new("Pengaturan Lokal", "PL", ["Profil Outlet", "Printer & Perangkat", "Backup Lokal", "Versi & Lisensi"])
    ]);
    return groups;
}

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", outlet = OutletId, isOnline = state.IsOnline }));
app.MapGet("/api/outlet-info", () => new
{
    brand = "Klinik Group",
    subtitle = $"Server lokal · {OutletName}",
    outletId = OutletId,
    outletName = OutletName,
    outletType = "pratama",
    outletLabel = state.CloudOutletType,
    cloudOutletType = state.CloudOutletType,
    serviceScope = state.ServiceScope,
    connectionText = state.IsOnline ? "Terhubung ke VPS" : "Mode Offline (Lokal)",
    connectionStatus = state.IsOnline ? "ok" : "bad",
    masterVersion = state.MasterVersion,
    activationCode = state.ActivationCode
});
app.MapGet("/api/menu", (bool? ri) => BuildMenu(ri ?? true));
app.MapGet("/api/state", () => { lock (syncLock) { return Results.Ok(state); } });

app.MapGet("/api/dashboard", () =>
{
    lock (syncLock)
    {
        return Results.Ok(new
        {
            stats = new[]
            {
                new { label = "Pasien hari ini", value = state.Encounters.Count.ToString() },
                new { label = "Pendapatan", value = $"Rp {state.TodayRevenueMillions:0.0} jt".Replace('.', ',') },
                new { label = "Antrean poli", value = state.Encounters.Count(e => e.Status == "Menunggu Poli").ToString() },
                new { label = "Antre sinkron", value = state.SyncOutbox.Count(s => s.Status != "Tersinkron").ToString() }
            },
            connections = new[]
            {
                new { name = "Internet", status = state.IsOnline ? "ok" : "bad", label = state.IsOnline ? "Normal" : "Terputus" },
                new { name = "VPS pusat", status = state.IsOnline ? "ok" : "warn", label = state.IsOnline ? "Terhubung" : "Antre Lokal" },
                new { name = "SATUSEHAT", status = state.IsOnline ? "ok" : "warn", label = state.IsOnline ? "Siap" : "Antre FHIR" },
                new { name = "BPJS P-Care", status = state.IsOnline ? "ok" : "warn", label = state.IsOnline ? "Siap" : "Offline" }
            },
            offlineMessage = "Semua menu tetap berjalan. Data disimpan di server lokal dan dikirim otomatis saat internet kembali."
        });
    }
});

app.MapPost("/api/patients/register", (RegisterPatientDto req) =>
{
    lock (syncLock)
    {
        var rm = $"RM-PRT-{20000 + state.Patients.Count + 1}";
        var qNo = $"P-{10 + state.Encounters.Count + 1:00}";
        var pat = new LocalPatient(rm, req.Name, req.Nik, req.BpjsNo ?? "-", $"IHS-{Random.Shared.Next(100000, 999999)}", req.Gender ?? "L", req.Address ?? "Bekasi");
        state.Patients.Insert(0, pat);
        var enc = new LocalEncounter($"ENC-{DateTime.Now:HHmmss}", qNo, rm, req.Name, req.Poli, req.Doctor, req.Payer, req.Payer.Contains("BPJS") ? $"PCARE-{Random.Shared.Next(1000, 9999)}" : "-", "Menunggu Poli", DateTime.Now.ToString("HH:mm"));
        state.Encounters.Insert(0, enc);
        state.AddOutbox("Pendaftaran", $"Kunjungan P-Care: {req.Name} ({rm}) - {req.Poli}", 0m);
        state.Save(stateFile);
        return Results.Ok(new { patient = pat, encounter = enc });
    }
});

app.MapPost("/api/clinical/soap", (SoapDto req) =>
{
    lock (syncLock)
    {
        var note = new LocalSoapNote(state.SoapNotes.Count + 1, req.EncounterId ?? "", req.PatientLabel, req.Subjective, req.Objective, req.Icd10, req.Plan, req.Prescription ?? "-", state.IsOnline ? "Terkirim FHIR" : "Antre Lokal");
        state.SoapNotes.Insert(0, note);
        if (!string.IsNullOrWhiteSpace(req.Prescription))
        {
            state.Prescriptions.Insert(0, new LocalPrescription($"RX-PRT-{DateTime.Now:HHmmss}", req.PatientLabel, req.Doctor ?? "Dr. Hendra Kusuma", req.Prescription, "KFA-93002", 10, "3x1 Sesudah Makan", "Menunggu Telaah", DateTime.Now.ToString("HH:mm")));
        }
        state.AddOutbox("Rawat Jalan", $"SOAP & Resep FKTP: {req.PatientLabel} ({req.Icd10})", 0m);
        state.Save(stateFile);
        return Results.Ok(note);
    }
});

app.MapPost("/api/pharmacy/dispense/{rxNo}", (string rxNo) =>
{
    lock (syncLock)
    {
        var rx = state.Prescriptions.FirstOrDefault(r => r.RxNo == rxNo);
        if (rx == null) return Results.NotFound();
        if (rx.Status == "Diserahkan") return Results.Ok(rx);
        rx.Status = "Diserahkan";
        var invNo = $"INV-PRT-{200 + state.Invoices.Count + 1}";
        state.Invoices.Insert(0, new LocalInvoice(invNo, rx.PatientLabel, $"Pelayanan FKTP + Obat ({rx.RxNo})", "Umum / P-Care", 0.15m, "Rp 150.000", "Belum Bayar", "-"));
        state.AddOutbox("Farmasi", $"Penyerahan {rx.RxNo} - {rx.PatientLabel}", 0m);
        state.Save(stateFile);
        return Results.Ok(rx);
    }
});

app.MapPost("/api/cashier/pay/{invoiceNo}", (string invoiceNo, PayInvoiceDto req) =>
{
    lock (syncLock)
    {
        var inv = state.Invoices.FirstOrDefault(i => i.InvoiceNo == invoiceNo);
        if (inv == null) return Results.NotFound();
        inv.Status = "Lunas";
        inv.PaidAt = DateTime.Now.ToString("HH:mm:ss");
        inv.PaymentMethod = req.Method ?? "Tunai";
        state.TodayRevenueMillions = Math.Round(state.TodayRevenueMillions + inv.AmountMillions, 2);
        state.AddOutbox("Kasir", $"Pembayaran {inv.InvoiceNo} - {inv.PatientLabel} ({inv.DisplayAmount})", inv.AmountMillions);
        state.Save(stateFile);
        return Results.Ok(inv);
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
        var u = new UserOutlet(req.Name ?? "Staf Pratama", req.Role ?? "Dokter", OutletName, "Aktif", state.IsOnline ? "Tersinkron" : "Menunggu (offline)");
        state.Users.Add(u);
        state.Save(stateFile);
        return Results.Ok(u);
    }
});

app.MapPost("/api/config/cloud-profile", (CloudProfileDto dto) =>
{
    lock (syncLock)
    {
        if (!string.IsNullOrWhiteSpace(dto.OutletType))
            state.CloudOutletType = dto.OutletType;
        if (!string.IsNullOrWhiteSpace(dto.ServiceScope))
            state.ServiceScope = dto.ServiceScope;
        if (dto.MasterVersion.HasValue && dto.MasterVersion.Value > 0)
            state.MasterVersion = dto.MasterVersion.Value;
        state.Save(stateFile);
        return Results.Ok(new { state.CloudOutletType, state.ServiceScope, state.MasterVersion });
    }
});

app.Run();

record MenuGroup(string Name, string Code, string[] Items);
record UserOutlet(string Name, string Role, string Outlet, string Status, string SyncStatus);
record CreateUserRequest(string? Name, string? Outlet, string? Role, string? Email, string? Nik, string? StrSip, string? MultiOutlet);
record RegisterPatientDto(string Name, string Nik, string Poli, string Doctor, string Payer, string? BpjsNo, string? Gender, string? Address);
record SoapDto(string? EncounterId, string PatientLabel, string Subjective, string Objective, string Icd10, string Plan, string? Prescription, string? Doctor);
record PayInvoiceDto(string? Method);
record ToggleOnlineDto(bool IsOnline);
record CloudProfileDto(string? OutletType, string? ServiceScope, int? MasterVersion);

record LocalPatient(string RmNumber, string FullName, string Nik, string BpjsNo, string IhsId, string Gender, string Address);
record LocalEncounter(string EncounterId, string QueueNo, string RmNumber, string PatientName, string PoliName, string DoctorName, string PayerType, string SepNo, string Status, string VisitTime);
record LocalSoapNote(int SoapId, string EncounterId, string PatientLabel, string Subjective, string Objective, string Icd10Code, string PlanNotes, string PrescriptionSummary, string FhirStatus);
class LocalPrescription(string rxNo, string patientLabel, string doctorName, string itemsSummary, string kfaCode, int qty, string signa, string status, string createdAt)
{
    public string RxNo { get; set; } = rxNo;
    public string PatientLabel { get; set; } = patientLabel;
    public string DoctorName { get; set; } = doctorName;
    public string ItemsSummary { get; set; } = itemsSummary;
    public string KfaCode { get; set; } = kfaCode;
    public int Qty { get; set; } = qty;
    public string Signa { get; set; } = signa;
    public string Status { get; set; } = status;
    public string CreatedAt { get; set; } = createdAt;
}
class LocalInvoice(string invoiceNo, string patientLabel, string serviceSummary, string payerType, decimal amountMillions, string displayAmount, string status, string paidAt)
{
    public string InvoiceNo { get; set; } = invoiceNo;
    public string PatientLabel { get; set; } = patientLabel;
    public string ServiceSummary { get; set; } = serviceSummary;
    public string PayerType { get; set; } = payerType;
    public decimal AmountMillions { get; set; } = amountMillions;
    public string DisplayAmount { get; set; } = displayAmount;
    public string Status { get; set; } = status;
    public string PaidAt { get; set; } = paidAt;
    public string PaymentMethod { get; set; } = "-";
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

class LocalPratamaState
{
    public string OutletId { get; set; } = "";
    public string OutletName { get; set; } = "";
    public string CloudOutletType { get; set; } = "Klinik Pratama (Rawat Inap & Jalan)";
    public string ServiceScope { get; set; } = "RI_RJ";
    public string ActivationCode { get; set; } = "KLN-PRT2-A9";
    public int MasterVersion { get; set; } = 1;
    public bool IsOnline { get; set; } = true;
    public decimal TodayRevenueMillions { get; set; } = 26.5m;
    public List<UserOutlet> Users { get; set; } = [];
    public List<LocalPatient> Patients { get; set; } = [];
    public List<LocalEncounter> Encounters { get; set; } = [];
    public List<LocalSoapNote> SoapNotes { get; set; } = [];
    public List<LocalPrescription> Prescriptions { get; set; } = [];
    public List<LocalInvoice> Invoices { get; set; } = [];
    public List<LocalOutboxItem> SyncOutbox { get; set; } = [];

    public void AddOutbox(string entityType, string summary, decimal amountMillions)
    {
        SyncOutbox.Insert(0, new LocalOutboxItem($"SYN-{DateTime.Now:HHmmss}-{Random.Shared.Next(10, 99)}", entityType, summary, amountMillions, DateTime.Now.ToString("HH:mm:ss"), IsOnline ? "Tersinkron" : "Menunggu (Offline)"));
    }

    public void Save(string path) => File.WriteAllText(path, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));

    public static LocalPratamaState LoadOrCreate(string path, string outletId, string outletName)
    {
        if (File.Exists(path))
        {
            try { var s = JsonSerializer.Deserialize<LocalPratamaState>(File.ReadAllText(path)); if (s != null) return s; } catch { }
        }
        var created = new LocalPratamaState
        {
            OutletId = outletId,
            OutletName = outletName,
            Users = [
                new("Dr. Hendra Kusuma", "Dokter", outletName, "Aktif", "Tersinkron"),
                new("Rina Putri", "Pendaftaran", outletName, "Aktif", "Tersinkron")
            ],
            Patients = [new("RM-20014", "Siti Aminah", "3275024508920005", "00088192011", "IHS-100029844", "P", "Bekasi")],
            Encounters = [new("ENC-P01", "P-01", "RM-20014", "Siti Aminah", "Poli Umum", "Dr. Hendra Kusuma", "BPJS P-Care", "PCARE-9012", "Menunggu Poli", "08:25")],
            Prescriptions = [new("RX-PRT-01", "Siti Aminah (RM-20014)", "Dr. Hendra Kusuma", "Paracetamol 500mg (10)", "KFA-93002", 10, "3x1 Sesudah Makan", "Menunggu Telaah", "08:40")],
            Invoices = [new("INV-PRT-108", "Tn. Wahyu", "Pemeriksaan Poli Umum + Obat", "Umum / Mandiri", 0.15m, "Rp 150.000", "Belum Bayar", "-")]
        };
        created.Save(path);
        return created;
    }
}
