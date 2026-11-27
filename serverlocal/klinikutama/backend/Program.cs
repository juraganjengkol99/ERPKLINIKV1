using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddHttpClient();

var app = builder.Build();
app.UseCors();

const string OutletId = "klinikutama";
const string OutletName = "Klinik Utama";
const string CloudApi = "http://localhost:5180/api";

var dataDir = Path.Combine(app.Environment.ContentRootPath, "Data");
Directory.CreateDirectory(dataDir);
var stateFile = Path.Combine(dataDir, "local_state.json");
var syncLock = new object();
var state = LocalKlinikState.LoadOrCreate(stateFile, OutletId, OutletName, "Klinik Utama (Rawat Inap & Jalan)");

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
        new("BPJS Kesehatan", "BP", rawatInap
            ? ["Cek Kepesertaan", "SEP", "Rujukan VClaim", "Antrean Mobile JKN", "Aplicares", "Log Bridging"]
            : ["Cek Kepesertaan", "SEP", "Rujukan VClaim", "Antrean Mobile JKN", "Log Bridging"]),
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
    outletType = "utama",
    outletLabel = state.OutletLabel,
    cloudOutletType = state.CloudOutletType,
    serviceScope = state.ServiceScope,
    connectionText = state.IsOnline ? "Terhubung ke VPS" : "Mode Offline (Lokal)",
    connectionStatus = state.IsOnline ? "ok" : "bad",
    masterVersion = state.MasterVersion,
    activationCode = state.ActivationCode
});

app.MapGet("/api/menu", (bool? ri) => BuildMenu(ri ?? true));

app.MapGet("/api/state", () =>
{
    lock (syncLock)
    {
        return Results.Ok(state);
    }
});

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
                new { name = "BPJS Kesehatan", status = state.IsOnline ? "ok" : "warn", label = state.IsOnline ? "Siap" : "Offline" }
            },
            offlineMessage = "Semua menu tetap berjalan. Data disimpan di server lokal dan dikirim otomatis saat internet kembali."
        });
    }
});

app.MapPost("/api/patients/register", (RegisterPatientDto req) =>
{
    lock (syncLock)
    {
        var rm = $"RM-{10000 + state.Patients.Count + 1}";
        var qNo = $"A-{10 + state.Encounters.Count + 1:00}";
        var pat = new LocalPatient(rm, req.Name, req.Nik, req.BpjsNo ?? "-", $"IHS-{Random.Shared.Next(100000, 999999)}", req.Gender ?? "L", req.Address ?? "Jakarta");
        state.Patients.Insert(0, pat);
        var enc = new LocalEncounter($"ENC-{DateTime.Now:HHmmss}", qNo, rm, req.Name, req.Poli, req.Doctor, req.Payer, req.Payer.Contains("BPJS") ? $"0112R001{Random.Shared.Next(100, 999)}" : "-", "Menunggu Poli", DateTime.Now.ToString("HH:mm"));
        state.Encounters.Insert(0, enc);
        state.AddOutbox("Pendaftaran", $"Registrasi {req.Name} ({rm}) ke {req.Poli}", 0m);
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
        var enc = state.Encounters.FirstOrDefault(e => e.EncounterId == req.EncounterId);
        if (enc != null) enc.Status = "Selesai Poli";
        if (!string.IsNullOrWhiteSpace(req.Prescription))
        {
            state.Prescriptions.Insert(0, new LocalPrescription($"RX-{DateTime.Now:HHmmss}", req.PatientLabel, req.Doctor ?? "Dr. Andi Wijaya", req.Prescription, req.DrugCode ?? "KFA-93001", req.Qty > 0 ? req.Qty : 10, req.Signa ?? "3x1 Sesudah Makan", "Menunggu Telaah", DateTime.Now.ToString("HH:mm")));
        }
        state.AddOutbox("Rawat Jalan", $"SOAP & Resep: {req.PatientLabel} ({req.Icd10})", 0m);
        state.Save(stateFile);
        return Results.Ok(note);
    }
});

app.MapPost("/api/clinical/inpatient/action", (InpatientActionDto req) =>
{
    lock (syncLock)
    {
        var bed = state.Beds.FirstOrDefault(b => b.BedId == req.BedId);
        if (bed == null) return Results.NotFound();
        if (req.Action == "admit")
        {
            bed.PatientLabel = req.PatientLabel ?? "Pasien Baru RI";
            bed.Diagnosis = req.Diagnosis ?? "Observasi Rawat Inap";
            bed.Dpjp = req.Dpjp ?? "Dr. Andi Wijaya";
            bed.VisiteCount = 1;
            bed.Status = "Terisi";
            state.AddOutbox("Rawat Inap", $"Admisi RI {bed.PatientLabel} ke {bed.RoomName}", 0m);
        }
        else if (req.Action == "visite" && bed.Status == "Terisi")
        {
            bed.VisiteCount += 1;
            state.AddOutbox("Visite Dokter", $"Visite DPJP {bed.Dpjp} untuk {bed.PatientLabel} ({bed.RoomName})", 0m);
        }
        else if (req.Action == "cppt")
        {
            state.CpptRecords.Insert(0, new LocalCppt(state.CpptRecords.Count + 1, bed.PatientLabel, bed.RoomName, req.Profession ?? "Dokter", req.Note ?? "Stabil", bed.Dpjp, DateTime.Now.ToString("HH:mm")));
            state.AddOutbox("Rawat Inap", $"CPPT {bed.PatientLabel} ({bed.RoomName})", 0m);
        }
        else if (req.Action == "discharge" && bed.Status == "Terisi")
        {
            var amt = Math.Round(bed.DailyRateMillions * 2m + bed.VisiteCount * 0.2m, 2);
            var invNo = $"INV-RI-{200 + state.Invoices.Count + 1}";
            state.Invoices.Insert(0, new LocalInvoice(invNo, bed.PatientLabel, $"Rawat Inap {bed.RoomName} + {bed.VisiteCount}x Visite", "Umum / BPJS", amt, $"Rp {(amt * 1_000_000m):N0}", "Belum Bayar", "-"));
            state.AddOutbox("Rawat Inap", $"Pulang RI: {bed.PatientLabel} -> {invNo}", 0m);
            bed.PatientLabel = "-"; bed.Diagnosis = "-"; bed.Dpjp = "-"; bed.VisiteCount = 0; bed.Status = "Cleaning";
        }
        else if (req.Action == "clean")
        {
            bed.Status = "Tersedia";
        }
        state.Save(stateFile);
        return Results.Ok(bed);
    }
});

app.MapPost("/api/clinical/igd", (IgdDto req) =>
{
    lock (syncLock)
    {
        var item = new LocalIgdCase($"IGD-{DateTime.Now:HHmmss}", req.PatientName, req.TriageLevel, req.Complaint, req.Vitals, req.Disposition, DateTime.Now.ToString("HH:mm"));
        state.IgdCases.Insert(0, item);
        state.AddOutbox("IGD", $"Triase {req.TriageLevel}: {req.PatientName} ({req.Disposition})", 0m);
        state.Save(stateFile);
        return Results.Ok(item);
    }
});

app.MapPost("/api/clinical/lab", (LabOrderDto req) =>
{
    lock (syncLock)
    {
        var order = new LocalLabOrder($"LAB-{DateTime.Now:HHmmss}", req.PatientLabel, req.Modality, req.ExamName, req.ResultValue ?? "Menunggu Hasil", req.NormalRef ?? "-", string.IsNullOrWhiteSpace(req.ResultValue) ? "Menunggu Sampel" : "Selesai & Terverifikasi", DateTime.Now.ToString("HH:mm"));
        state.LabOrders.Insert(0, order);
        state.AddOutbox("Penunjang Medis", $"{req.Modality}: {req.ExamName} - {req.PatientLabel}", 0m);
        state.Save(stateFile);
        return Results.Ok(order);
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
        var item = state.Inventory.FirstOrDefault(i => i.Code == rx.KfaCode) ?? state.Inventory.FirstOrDefault();
        if (item != null) item.LocalStock = Math.Max(0, item.LocalStock - rx.Qty);
        var invNo = $"INV-FA-{200 + state.Invoices.Count + 1}";
        state.Invoices.Insert(0, new LocalInvoice(invNo, rx.PatientLabel, $"Jasa Dokter + Obat ({rx.RxNo})", "Umum / Mandiri", 0.35m, "Rp 350.000", "Belum Bayar", "-"));
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
        if (inv.Status == "Lunas") return Results.Ok(inv);
        inv.Status = "Lunas";
        inv.PaidAt = DateTime.Now.ToString("HH:mm:ss");
        inv.PaymentMethod = req.Method ?? "Tunai / QRIS";
        state.TodayRevenueMillions = Math.Round(state.TodayRevenueMillions + inv.AmountMillions, 2);
        state.AddOutbox("Kasir", $"Pembayaran {inv.InvoiceNo} - {inv.PatientLabel} ({inv.DisplayAmount})", inv.AmountMillions);
        state.Save(stateFile);
        return Results.Ok(inv);
    }
});

app.MapPost("/api/inventory/opname", (OpnameDto req) =>
{
    lock (syncLock)
    {
        var item = state.Inventory.FirstOrDefault(i => i.Code == req.Code);
        var sys = item?.LocalStock ?? 0;
        var opn = new LocalOpname($"OPN-{DateTime.Now:HHmmss}", DateTime.Now.ToString("yyyy-MM-dd"), req.Code, item?.Name ?? req.Code, sys, req.PhysicalQty, req.PhysicalQty - sys, req.Reason);
        state.StockOpnames.Insert(0, opn);
        if (item != null) item.LocalStock = req.PhysicalQty;
        state.AddOutbox("Stok Opname", $"Opname {opn.DrugName}: selisih {opn.Difference}", 0m);
        state.Save(stateFile);
        return Results.Ok(opn);
    }
});

app.MapPost("/api/sync/toggle", (ToggleOnlineDto req) =>
{
    lock (syncLock)
    {
        state.IsOnline = req.IsOnline;
        state.Save(stateFile);
        return Results.Ok(new { isOnline = state.IsOnline });
    }
});

app.MapPost("/api/sync/push-now", async (IHttpClientFactory httpFactory) =>
{
    List<LocalOutboxItem> pending;
    lock (syncLock)
    {
        pending = state.SyncOutbox.Where(s => s.Status != "Tersinkron").ToList();
    }
    if (pending.Count == 0) return Results.Ok(new { pushed = 0 });

    try
    {
        var client = httpFactory.CreateClient();
        var resp = await client.PostAsJsonAsync($"{CloudApi}/sync/push", new { outletId = OutletId, outletName = OutletName, items = pending });
        if (resp.IsSuccessStatusCode)
        {
            lock (syncLock)
            {
                foreach (var p in pending) p.Status = "Tersinkron";
                state.IsOnline = true;
                state.LastSyncAt = DateTime.Now.ToString("HH:mm:ss");
                state.Save(stateFile);
            }
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
        var u = new UserOutlet(req.Name ?? "Staf Baru", req.Role ?? "Dokter", OutletName, "Aktif", state.IsOnline ? "Tersinkron" : "Menunggu (offline)");
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
        {
            state.CloudOutletType = dto.OutletType;
            state.OutletLabel = dto.OutletType;
        }
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
record SoapDto(string? EncounterId, string PatientLabel, string Subjective, string Objective, string Icd10, string Plan, string? Prescription, string? Doctor, string? DrugCode, int Qty, string? Signa);
record InpatientActionDto(string BedId, string Action, string? PatientLabel, string? Diagnosis, string? Dpjp, string? Profession, string? Note);
record IgdDto(string PatientName, string TriageLevel, string Complaint, string Vitals, string Disposition);
record LabOrderDto(string PatientLabel, string Modality, string ExamName, string? ResultValue, string? NormalRef);
record PayInvoiceDto(string? Method);
record OpnameDto(string Code, int PhysicalQty, string Reason);
record ToggleOnlineDto(bool IsOnline);
record CloudProfileDto(string? OutletType, string? ServiceScope, int? MasterVersion);

record LocalPatient(string RmNumber, string FullName, string Nik, string BpjsNo, string IhsId, string Gender, string Address);
class LocalEncounter(string encounterId, string queueNo, string rmNumber, string patientName, string poliName, string doctorName, string payerType, string sepNo, string status, string visitTime)
{
    public string EncounterId { get; set; } = encounterId;
    public string QueueNo { get; set; } = queueNo;
    public string RmNumber { get; set; } = rmNumber;
    public string PatientName { get; set; } = patientName;
    public string PoliName { get; set; } = poliName;
    public string DoctorName { get; set; } = doctorName;
    public string PayerType { get; set; } = payerType;
    public string SepNo { get; set; } = sepNo;
    public string Status { get; set; } = status;
    public string VisitTime { get; set; } = visitTime;
}
record LocalSoapNote(int SoapId, string EncounterId, string PatientLabel, string Subjective, string Objective, string Icd10Code, string PlanNotes, string PrescriptionSummary, string FhirStatus);
class LocalBed(string bedId, string roomName, string bedCode, string patientLabel, string diagnosis, string dpjp, decimal dailyRateMillions, int visiteCount, string status)
{
    public string BedId { get; set; } = bedId;
    public string RoomName { get; set; } = roomName;
    public string BedCode { get; set; } = bedCode;
    public string PatientLabel { get; set; } = patientLabel;
    public string Diagnosis { get; set; } = diagnosis;
    public string Dpjp { get; set; } = dpjp;
    public decimal DailyRateMillions { get; set; } = dailyRateMillions;
    public int VisiteCount { get; set; } = visiteCount;
    public string Status { get; set; } = status;
}
record LocalCppt(int CpptId, string PatientLabel, string RoomName, string Profession, string Note, string VerifiedBy, string RecordedAt);
record LocalIgdCase(string CaseId, string PatientName, string TriageLevel, string Complaint, string Vitals, string Disposition, string Time);
record LocalLabOrder(string OrderId, string PatientLabel, string Modality, string ExamName, string ResultValue, string NormalRef, string Status, string OrderedAt);
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
class LocalInventoryItem(string code, string name, string category, int localStock, string unit, string batchNo, string expiredDate)
{
    public string Code { get; set; } = code;
    public string Name { get; set; } = name;
    public string Category { get; set; } = category;
    public int LocalStock { get; set; } = localStock;
    public string Unit { get; set; } = unit;
    public string BatchNo { get; set; } = batchNo;
    public string ExpiredDate { get; set; } = expiredDate;
}
record LocalOpname(string OpnameId, string Date, string Code, string DrugName, int SystemStock, int PhysicalStock, int Difference, string Reason);
class LocalOutboxItem(string id, string entityType, string summary, decimal amountMillions, string createdAt, string status)
{
    public string Id { get; set; } = id;
    public string EntityType { get; set; } = entityType;
    public string Summary { get; set; } = summary;
    public decimal AmountMillions { get; set; } = amountMillions;
    public string CreatedAt { get; set; } = createdAt;
    public string Status { get; set; } = status;
}

class LocalKlinikState
{
    public string OutletId { get; set; } = "";
    public string OutletName { get; set; } = "";
    public string OutletLabel { get; set; } = "";
    public string CloudOutletType { get; set; } = "Klinik Utama (Rawat Inap & Jalan)";
    public string ServiceScope { get; set; } = "RI_RJ";
    public string ActivationCode { get; set; } = "KLN-UTM1-A9";
    public int MasterVersion { get; set; } = 1;
    public bool IsOnline { get; set; } = true;
    public string LastSyncAt { get; set; } = "Baru saja";
    public decimal TodayRevenueMillions { get; set; } = 38.2m;
    public List<UserOutlet> Users { get; set; } = [];
    public List<LocalPatient> Patients { get; set; } = [];
    public List<LocalEncounter> Encounters { get; set; } = [];
    public List<LocalSoapNote> SoapNotes { get; set; } = [];
    public List<LocalBed> Beds { get; set; } = [];
    public List<LocalCppt> CpptRecords { get; set; } = [];
    public List<LocalIgdCase> IgdCases { get; set; } = [];
    public List<LocalLabOrder> LabOrders { get; set; } = [];
    public List<LocalPrescription> Prescriptions { get; set; } = [];
    public List<LocalInvoice> Invoices { get; set; } = [];
    public List<LocalInventoryItem> Inventory { get; set; } = [];
    public List<LocalOpname> StockOpnames { get; set; } = [];
    public List<LocalOutboxItem> SyncOutbox { get; set; } = [];

    public void AddOutbox(string entityType, string summary, decimal amountMillions)
    {
        SyncOutbox.Insert(0, new LocalOutboxItem($"SYN-{DateTime.Now:HHmmss}-{Random.Shared.Next(10, 99)}", entityType, summary, amountMillions, DateTime.Now.ToString("HH:mm:ss"), IsOnline ? "Tersinkron" : "Menunggu (Offline)"));
    }

    public void Save(string path) => File.WriteAllText(path, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));

    public static LocalKlinikState LoadOrCreate(string path, string outletId, string outletName, string label)
    {
        if (File.Exists(path))
        {
            try
            {
                var s = JsonSerializer.Deserialize<LocalKlinikState>(File.ReadAllText(path));
                if (s != null && s.Patients.Count > 0) return s;
            }
            catch { }
        }
        var created = new LocalKlinikState
        {
            OutletId = outletId,
            OutletName = outletName,
            OutletLabel = label,
            Users = [
                new("Dr. Andi Wijaya", "Dokter", outletName, "Aktif", "Tersinkron"),
                new("Sari Lestari", "Apoteker", "Apotek", "Aktif", "Tersinkron"),
                new("Budi Santoso", "Kasir", outletName, "Aktif", "Tersinkron")
            ],
            Patients = [
                new("RM-10001", "Ahmad Fauzi", "3171041205880002", "00012988412", "IHS-100029812", "L", "Jakarta Selatan"),
                new("RM-10002", "Siti Aminah", "3275024508920005", "00088192011", "IHS-100029844", "P", "Bekasi")
            ],
            Encounters = [
                new("ENC-01", "A-01", "RM-10001", "Ahmad Fauzi", "Poli Penyakit Dalam", "Dr. Andi Wijaya", "BPJS Kesehatan (SEP)", "0112R0011126V000413", "Menunggu Poli", "08:30"),
                new("ENC-02", "A-02", "RM-10002", "Siti Aminah", "Poli Umum", "Dr. Hendra Kusuma", "Umum / Mandiri", "-", "Sedang Diperiksa", "08:42")
            ],
            SoapNotes = [
                new(1, "ENC-00", "Ahmad Fauzi (RM-10001)", "Nyeri ulu hati 3 hari", "TD 125/80, N 82, S 36.7", "K29.7 - Gastritis", "Terapi PPI & diet lambung", "Omeprazole 20mg (10)", "Terkirim FHIR")
            ],
            Beds = [
                new("BED-01", "VIP Anggrek", "A-01", "Tn. Rahmat", "Demam Berdarah (DBD)", "Dr. Andi Wijaya", 0.85m, 2, "Terisi"),
                new("BED-02", "Kelas 1 Melati", "M-01", "-", "-", "-", 0.50m, 0, "Tersedia"),
                new("BED-03", "Kelas 2 Mawar", "W-01", "-", "-", "-", 0.35m, 0, "Cleaning")
            ],
            CpptRecords = [
                new(1, "Tn. Rahmat (RM-09912)", "VIP Anggrek", "Dokter", "Trombosit naik ke 118.000, lanjut infus RL 20 tpm", "Dr. Andi Wijaya", "08:15")
            ],
            IgdCases = [
                new("IGD-01", "Tn. Bima Sakti", "Kuning (Urgent)", "Nyeri dada & sesak ringan", "TD 145/90, SpO2 96%, N 98", "Observasi IGD", "08:55")
            ],
            LabOrders = [
                new("LAB-01", "Tn. Rahmat (VIP Anggrek)", "Laboratorium", "Darah Lengkap (Hematologi)", "Hb 13.4 · Trombosit 118.000", "150.000–450.000", "Selesai & Terverifikasi", "08:05")
            ],
            Prescriptions = [
                new("RX-01", "Ahmad Fauzi (RM-10001)", "Dr. Andi Wijaya", "Omeprazole 20mg (10), Paracetamol 500mg (10)", "KFA-93004", 10, "2x1 sebelum makan", "Menunggu Telaah", "08:45")
            ],
            Invoices = [
                new("INV-01", "Ahmad Fauzi (RM-10001)", "Konsultasi Poli Dalam + Obat", "BPJS Kesehatan", 0.25m, "Rp 250.000", "Belum Bayar", "-")
            ],
            Inventory = [
                new("KFA-93001", "Amoxicillin 500mg Kaplet", "Antibiotik", 620, "Tablet", "AMX-2510B", "2027-04-12"),
                new("KFA-93004", "Omeprazole 20mg Kapsul", "Gastrointestinal", 410, "Kapsul", "OMP-2512A", "2028-02-10"),
                new("KFA-93005", "Infus RL 500ml", "Cairan Infus", 180, "Botol", "IRL-2512X", "2026-12-25")
            ]
        };
        created.Save(path);
        return created;
    }
}
