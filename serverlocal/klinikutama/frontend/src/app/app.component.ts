import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TablePagerComponent } from './shared/table-pager.component';
import { filterRows, paginateRows } from './shared/table-filter';
import { PatientRegisterFormComponent } from './forms/patient-register-form.component';
import { SoapFormComponent } from './forms/soap-form.component';
import { IgdFormComponent } from './forms/igd-form.component';
import { LabOrderFormComponent } from './forms/lab-order-form.component';
import { OpnameFormComponent } from './forms/opname-form.component';
import { BranchUserFormComponent } from './forms/branch-user-form.component';

export interface MenuGroup { name: string; code: string; items: string[]; }
export interface UserOutlet { name: string; role: string; outlet: string; status: string; syncStatus: string; }
export interface SyncOutboxItem { id: string; entityType: string; summary: string; amountMillions: number; createdAt: string; status: 'Menunggu (Offline)' | 'Tersinkron'; }

function buildKlinikMenu(ri: boolean): MenuGroup[] {
  return [
    { name: 'Dashboard Outlet', code: 'DB', items: ['Ringkasan Hari Ini', 'Status Koneksi', 'Antrean Sinkronisasi'] },
    { name: 'Pendaftaran', code: 'PD', items: ri ? ['Pasien Baru/Lama', 'Verifikasi BPJS', 'Validasi NIK & IHS', 'Antrean Online', 'Rujukan Masuk', 'Admisi & SEP'] : ['Pasien Baru/Lama', 'Verifikasi BPJS', 'Validasi NIK & IHS', 'Antrean Online', 'Rujukan Masuk'] },
    { name: 'Rawat Jalan', code: 'RJ', items: ['Antrean Poli', 'Pemeriksaan SOAP', 'Diagnosa & Tindakan', 'Resep Elektronik', 'Order Lab/Radiologi', 'Rujukan Keluar'] },
    ...(ri ? [
      { name: 'Rawat Inap', code: 'RI', items: ['Kamar & Tempat Tidur', 'Pasien Rawat Inap', 'CPPT & Asuhan', 'Visite Dokter', 'Pindah Kamar', 'Pulang'] },
      { name: 'IGD', code: 'GD', items: ['Triase', 'Penanganan Gawat Darurat'] }
    ] : []),
    { name: 'Rekam Medis', code: 'RM', items: ['RME', 'Riwayat Pasien', 'Pengkodean Diagnosa', 'Resume Medis', 'Informed Consent'] },
    ...(ri ? [{ name: 'Penunjang Medis', code: 'PM', items: ['Laboratorium', 'Radiologi', 'Fisioterapi'] }] : []),
    { name: 'Farmasi', code: 'FA', items: ['Resep Masuk', 'Penyerahan Obat', 'Stok Farmasi', 'Retur & Expired'] },
    { name: 'Kasir', code: 'KS', items: ['Tagihan Pasien', 'Pembayaran & Deposit', 'Tutup Kasir', 'Refund'] },
    { name: 'BPJS Kesehatan', code: 'BP', items: ri ? ['Cek Kepesertaan', 'SEP', 'Rujukan VClaim', 'Antrean Mobile JKN', 'Aplicares', 'Log Bridging'] : ['Cek Kepesertaan', 'SEP', 'Rujukan VClaim', 'Antrean Mobile JKN', 'Log Bridging'] },
    { name: 'SATUSEHAT', code: 'SS', items: ['Status Kirim per Pasien', 'Antrean Kirim FHIR', 'Kirim Ulang Gagal', 'Pencocokan IHS Number'] },
    { name: 'Inventory Outlet', code: 'IV', items: ['Stok Barang', 'Permintaan ke Pusat', 'Penerimaan Barang', 'Mutasi & Opname'] },
    { name: 'Laporan Outlet', code: 'LO', items: ['Kunjungan & Diagnosa', 'Pendapatan', 'Laporan BPJS', 'Laporan Regulasi'] },
    { name: 'Sinkronisasi', code: 'SY', items: ['Status Sinkron Cloud', 'Log Sinkronisasi', 'Sinkron Manual', 'Data Tertunda Offline'] },
    { name: 'Pengguna Outlet', code: 'PO', items: ['Daftar User Outlet', 'Permintaan Perubahan Akses'] },
    { name: 'Pengaturan Lokal', code: 'PL', items: ['Profil Outlet', 'Printer & Perangkat', 'Backup Lokal', 'Versi & Lisensi'] }
  ];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TablePagerComponent,
    PatientRegisterFormComponent,
    SoapFormComponent,
    IgdFormComponent,
    LabOrderFormComponent,
    OpnameFormComponent,
    BranchUserFormComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly localApi = 'http://localhost:5181/api';
  readonly cloudSyncApi = 'http://localhost:5180/api';
  private pollTimer?: ReturnType<typeof setInterval>;

  readonly outletId = 'klinikutama';
  readonly outletName = 'Klinik Utama';
  brand = 'Klinik Group';
  where = 'Server lokal · Klinik Utama';
  serviceMode: 'utama' | 'utama_rj' = 'utama';

  activeRole = 'Admin Outlet (Semua Akses)';
  availableRoles = ['Admin Outlet (Semua Akses)', 'Dokter', 'Apoteker / Farmasi', 'Kasir', 'Petugas Pendaftaran'];

  isOnline = true;
  connText = 'Terhubung ke VPS';
  connStatus: 'ok' | 'warn' | 'bad' = 'ok';
  masterVersion = 1;

  selectedGroup = 'Dashboard Outlet';
  selectedPage = 'Ringkasan Hari Ini';
  openGroups = new Set<string>(['Dashboard Outlet']);
  menuSearch = '';
  sidebarOpen = false;
  toastMessage = '';
  toastVisible = false;
  private toastTimeout?: ReturnType<typeof setTimeout>;

  // Universal Search & Pagination
  tableSearch = '';
  statusFilter = 'Semua';
  page = 1;
  pageSize = 10;
  drawerMode: string | null = null;
  cloudDisabledCodes = new Set<string>();

  get menuGroups(): MenuGroup[] {
    const raw = buildKlinikMenu(this.serviceMode === 'utama').filter((g) => !this.cloudDisabledCodes.has(g.code));
    let base = raw;
    if (this.activeRole === 'Dokter') base = raw.filter((g) => ['Dashboard Outlet', 'Rawat Jalan', 'Rawat Inap', 'IGD', 'Rekam Medis', 'Penunjang Medis', 'SATUSEHAT'].includes(g.name));
    else if (this.activeRole === 'Apoteker / Farmasi') base = raw.filter((g) => ['Dashboard Outlet', 'Farmasi', 'Inventory Outlet', 'SATUSEHAT'].includes(g.name));
    else if (this.activeRole === 'Kasir') base = raw.filter((g) => ['Dashboard Outlet', 'Kasir', 'Laporan Outlet'].includes(g.name));
    else if (this.activeRole === 'Petugas Pendaftaran') base = raw.filter((g) => ['Dashboard Outlet', 'Pendaftaran', 'BPJS Kesehatan', 'SATUSEHAT'].includes(g.name));

    const q = this.menuSearch.trim().toLowerCase();
    if (!q) return base;
    return base.map((g) => ({ ...g, items: g.items.filter((i) => i.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0);
  }

  todayRevenueMillions = 38.2;
  patients: Array<{ rmNumber: string; fullName: string; nik: string; bpjsNo: string; ihsId: string; gender: string; address: string }> = [];
  encounters: Array<{ encounterId: string; queueNo: string; rmNumber: string; patientName: string; poliName: string; doctorName: string; payerType: string; sepNo: string; status: string; visitTime: string }> = [];
  soapNotes: Array<{ soapId: number; patientLabel: string; subjective: string; objective: string; icd10Code: string; planNotes: string; prescriptionSummary: string; fhirStatus: string }> = [];
  beds: Array<{ bedId: string; roomName: string; bedCode: string; patientLabel: string; diagnosis: string; dpjp: string; dailyRateMillions: number; visiteCount: number; status: string }> = [];
  cpptRecords: Array<{ cpptId: number; patientLabel: string; roomName: string; profession: string; note: string; verifiedBy: string; recordedAt: string }> = [];
  igdCases: Array<{ caseId: string; patientName: string; triageLevel: string; complaint: string; vitals: string; disposition: string; time: string }> = [];
  labOrders: Array<{ orderId: string; patientLabel: string; modality: string; examName: string; resultValue: string; normalRef: string; status: string; orderedAt: string }> = [];
  prescriptions: Array<{ rxNo: string; patientLabel: string; doctorName: string; itemsSummary: string; kfaCode: string; qty: number; signa: string; status: string; createdAt: string }> = [];
  invoices: Array<{ invoiceNo: string; patientLabel: string; serviceSummary: string; payerType: string; amountMillions: number; displayAmount: string; status: string; paidAt: string; paymentMethod?: string }> = [];
  inventory: Array<{ code: string; name: string; category: string; localStock: number; unit: string; batchNo: string; expiredDate: string }> = [];
  stockOpnames: Array<{ opnameId: string; date: string; code: string; drugName: string; systemStock: number; physicalStock: number; difference: number; reason: string }> = [];
  syncOutbox: SyncOutboxItem[] = [];
  users: UserOutlet[] = [];
  branchStockRequests: Array<{ reqId: string; date: string; itemCode: string; itemName: string; qty: number; status: string }> = [];

  // Forms
  regForm = { name: '', nik: '', bpjsNo: '', poli: 'Poli Penyakit Dalam', doctor: 'Dr. Andi Wijaya', payer: 'BPJS Kesehatan (SEP)' };
  soapForm = { encounterId: '', patientLabel: '', subjective: 'Demam 3 hari, nyeri kepala', objective: 'TD 120/80, N 84, S 37.8', icd10: 'J06.9 - ISPA', plan: 'Terapi simtomatik & edukasi', prescription: 'Paracetamol 500mg (10)', signa: '3x1 sesudah makan' };
  igdForm = { patientName: '', triageLevel: 'Kuning (Urgent)', complaint: '', vitals: 'TD 130/85, SpO2 98%', disposition: 'Observasi IGD' };
  labForm = { patientLabel: 'Ahmad Fauzi (RM-10001)', modality: 'Laboratorium', examName: 'Darah Lengkap (Hematologi)', resultValue: '', normalRef: '150.000–450.000' };
  opnameForm = { code: 'KFA-93001', physicalQty: 620, reason: 'Stok opname shift pagi' };
  stockReqForm = { itemCode: 'KFA-93001', qty: 100 };
  newUser = { name: '', role: 'Dokter', outlet: 'Klinik Utama', email: '', nik: '', strSip: '' };
  bpjsCardInput = '00012988412';
  bpjsCheckResult = 'AKTIF · Kelas 1 · Faskes 1: Klinik Pratama Sehat';
  licenseForm = { activationCode: 'KLN-UTM1-A9', status: 'Terverifikasi Lokal', printerName: 'Epson TM-T82 Thermal 80mm' };

  get stats() {
    return [
      { label: 'Pasien hari ini', value: String(this.encounters.length) },
      { label: 'Pendapatan lokal', value: `Rp ${this.todayRevenueMillions.toFixed(1).replace('.', ',')} jt` },
      { label: 'Antrean poli', value: String(this.encounters.filter((e) => e.status === 'Menunggu Poli').length) },
      { label: 'Antre sinkron', value: String(this.pendingOutbox.length) }
    ];
  }

  get pendingOutbox(): SyncOutboxItem[] {
    return this.syncOutbox.filter((s) => s.status !== 'Tersinkron');
  }

  filtered<T>(rows: T[], pred?: (r: T) => boolean): T[] {
    return filterRows(rows, this.tableSearch, pred ? [pred] : []);
  }

  paged<T>(rows: T[], pred?: (r: T) => boolean): T[] {
    return paginateRows(this.filtered(rows, pred), this.page, this.pageSize);
  }

  ngOnInit(): void {
    const cachedScope = typeof localStorage !== 'undefined' ? localStorage.getItem('klinikutama_service_scope') : null;
    if (cachedScope) this.applyCloudServiceScope(cachedScope, undefined, false);
    this.loadLocalState();
    this.pullFromCloud();
    this.pollTimer = setInterval(() => {
      if (this.isOnline) this.pullFromCloud();
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  loadLocalState(): void {
    this.http.get<Record<string, unknown>>(`${this.localApi}/state`).subscribe({
      next: (s: Record<string, unknown>) => {
        this.isOnline = Boolean(s['isOnline'] ?? true);
        this.todayRevenueMillions = Number(s['todayRevenueMillions'] ?? 38.2);
        this.masterVersion = Number(s['masterVersion'] ?? 1);
        this.patients = (s['patients'] as typeof this.patients) || [];
        this.encounters = (s['encounters'] as typeof this.encounters) || [];
        this.soapNotes = (s['soapNotes'] as typeof this.soapNotes) || [];
        this.beds = (s['beds'] as typeof this.beds) || [];
        this.cpptRecords = (s['cpptRecords'] as typeof this.cpptRecords) || [];
        this.igdCases = (s['igdCases'] as typeof this.igdCases) || [];
        this.labOrders = (s['labOrders'] as typeof this.labOrders) || [];
        this.prescriptions = (s['prescriptions'] as typeof this.prescriptions) || [];
        this.invoices = (s['invoices'] as typeof this.invoices) || [];
        this.inventory = (s['inventory'] as typeof this.inventory) || [];
        this.stockOpnames = (s['stockOpnames'] as typeof this.stockOpnames) || [];
        this.syncOutbox = (s['syncOutbox'] as SyncOutboxItem[]) || [];
        this.users = (s['users'] as UserOutlet[]) || [];
        if (typeof s['serviceScope'] === 'string') {
          this.applyCloudServiceScope(s['serviceScope'], String(s['cloudOutletType'] ?? ''), false);
        }
        this.updateConnBanner();
      },
      error: () => {}
    });
  }

  private updateConnBanner(): void {
    this.connText = this.isOnline ? 'Terhubung ke VPS' : `Offline (${this.pendingOutbox.length} antre)`;
    this.connStatus = this.isOnline ? 'ok' : 'bad';
  }

  private applyCloudServiceScope(scope: string, outletType?: string, notify = true): void {
    const isRjOnly = scope === 'RJ_ONLY' || (Boolean(outletType) && String(outletType).includes('Rawat Jalan') && !String(outletType).includes('Rawat Inap'));
    const nextMode: 'utama' | 'utama_rj' = isRjOnly ? 'utama_rj' : 'utama';
    const changed = this.serviceMode !== nextMode;
    this.serviceMode = nextMode;
    this.where = nextMode === 'utama' ? 'Server lokal · Klinik Utama (RI & RJ)' : 'Server lokal · Klinik Utama (RJ)';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('klinikutama_service_scope', isRjOnly ? 'RJ_ONLY' : 'RI_RJ');
    }
    const stillVisible = this.menuGroups.some((g) => g.name === this.selectedGroup && g.items.includes(this.selectedPage));
    if (!stillVisible) {
      const first = this.menuGroups[0];
      if (first) this.selectPage(first.name, first.items[0]);
    }
    if (changed && notify) {
      this.showToast(`Jenis klinik dari Cloud: ${nextMode === 'utama' ? 'Rawat Inap & Jalan' : 'Rawat Jalan Saja'}`);
    }
  }

  onRoleChange(r: string): void {
    this.activeRole = r;
    const first = this.menuGroups[0];
    if (first) this.selectPage(first.name, first.items[0]);
    this.showToast(`Role lokal: ${r}`);
  }

  toggleOnlineMode(): void {
    this.isOnline = !this.isOnline;
    this.http.post(`${this.localApi}/sync/toggle`, { isOnline: this.isOnline }).subscribe({ next: () => {}, error: () => {} });
    this.http.post(`${this.cloudSyncApi}/sync/status`, { outletId: this.outletId, outletName: this.outletName, isOnline: this.isOnline, pendingCount: this.pendingOutbox.length }).subscribe({ next: () => {}, error: () => {} });
    this.updateConnBanner();
    if (this.isOnline) this.syncNow();
    else this.showToast('Mode Offline Aktif — semua transaksi disimpan di server lokal');
  }

  syncNow(): void {
    this.http.post<{ pushed: number; synced: boolean }>(`${this.localApi}/sync/push-now`, {}).subscribe({
      next: (res) => {
        this.loadLocalState();
        this.pullFromCloud();
        this.showToast(res.pushed > 0 ? `${res.pushed} data berhasil disinkronkan ke Cloud VPS` : 'Sinkronisasi Cloud VPS selesai');
      },
      error: () => this.showToast('Cloud VPS belum merespons, data aman di outbox lokal')
    });
  }

  pullFromCloud(): void {
    this.http.get<{
      masterVersion: number;
      outletType?: string;
      serviceScope?: string;
      outlet?: { type?: string; serviceScope?: string };
      templateModules?: Array<{ code: string; enabled: boolean }>;
      outletUsers?: UserOutlet[];
      stockRequests?: Array<{ reqId: string; date: string; itemCode: string; itemName: string; qty: number; status: string }>;
    }>(`${this.cloudSyncApi}/sync/pull?outletId=${this.outletId}&outletName=${encodeURIComponent(this.outletName)}`).subscribe({
      next: (res) => {
        if (res?.masterVersion) this.masterVersion = res.masterVersion;
        if (res?.outletUsers?.length) this.users = res.outletUsers;
        if (res?.stockRequests) this.branchStockRequests = res.stockRequests;
        if (res?.templateModules?.length) {
          this.cloudDisabledCodes = new Set(res.templateModules.filter((m) => m.enabled === false).map((m) => m.code));
        }
        const scope = res?.serviceScope || res?.outlet?.serviceScope || '';
        const oType = res?.outletType || res?.outlet?.type || '';
        if (scope || oType) {
          this.applyCloudServiceScope(scope, oType, true);
          this.http.post(`${this.localApi}/config/cloud-profile`, {
            outletType: oType,
            serviceScope: scope || (this.serviceMode === 'utama_rj' ? 'RJ_ONLY' : 'RI_RJ'),
            masterVersion: this.masterVersion
          }).subscribe({ next: () => {}, error: () => {} });
        }
      },
      error: () => {}
    });
  }

  registerPatient(): void {
    if (!this.regForm.name.trim()) { this.showToast('Nama pasien wajib diisi'); return; }
    this.http.post(`${this.localApi}/patients/register`, this.regForm).subscribe({
      next: () => {
        this.regForm.name = ''; this.regForm.nik = '';
        this.drawerMode = null;
        this.loadLocalState();
        if (this.isOnline) this.syncNow();
        this.showToast('Pasien didaftarkan ke antrean poli & outbox lokal');
      }
    });
  }

  saveSoap(): void {
    if (!this.soapForm.patientLabel) this.soapForm.patientLabel = this.encounters[0]?.patientName || 'Pasien Poli';
    this.http.post(`${this.localApi}/clinical/soap`, this.soapForm).subscribe({
      next: () => {
        this.drawerMode = null;
        this.loadLocalState();
        if (this.isOnline) this.syncNow();
        this.showToast('Pemeriksaan SOAP & e-Resep disimpan');
      }
    });
  }

  bedAction(bedId: string, action: string, extra?: Record<string, string>): void {
    this.http.post(`${this.localApi}/clinical/inpatient/action`, { bedId, action, ...(extra || {}) }).subscribe({
      next: () => {
        this.loadLocalState();
        if (this.isOnline) this.syncNow();
        this.showToast(`Aksi Rawat Inap (${action}) berhasil`);
      }
    });
  }

  saveIgd(): void {
    this.http.post(`${this.localApi}/clinical/igd`, this.igdForm).subscribe({
      next: () => {
        this.igdForm.patientName = ''; this.igdForm.complaint = '';
        this.drawerMode = null;
        this.loadLocalState();
        this.showToast('Kasus IGD dicatat');
      }
    });
  }

  saveLab(): void {
    this.http.post(`${this.localApi}/clinical/lab`, this.labForm).subscribe({
      next: () => {
        this.drawerMode = null;
        this.loadLocalState();
        this.showToast('Order/Hasil Penunjang Medis disimpan');
      }
    });
  }

  dispenseRx(rxNo: string): void {
    this.http.post(`${this.localApi}/pharmacy/dispense/${rxNo}`, {}).subscribe({
      next: () => {
        this.loadLocalState();
        if (this.isOnline) this.syncNow();
        this.showToast(`Resep ${rxNo} diserahkan & tagihan dibuat di Kasir`);
      }
    });
  }

  payInvoice(invoiceNo: string): void {
    this.http.post(`${this.localApi}/cashier/pay/${invoiceNo}`, { method: 'Tunai / QRIS' }).subscribe({
      next: () => {
        this.loadLocalState();
        if (this.isOnline) this.syncNow();
        this.showToast(`Tagihan ${invoiceNo} LUNAS & tercatat di outbox`);
      }
    });
  }

  submitOpname(): void {
    this.http.post(`${this.localApi}/inventory/opname`, this.opnameForm).subscribe({
      next: () => {
        this.drawerMode = null;
        this.loadLocalState();
        this.showToast('Stok opname lokal disimpan');
      }
    });
  }

  requestCentralStock(): void {
    this.http.post(`${this.cloudSyncApi}/stock-requests`, { outletId: this.outletId, outletName: this.outletName, itemCode: this.stockReqForm.itemCode, qty: this.stockReqForm.qty }).subscribe({
      next: () => { this.pullFromCloud(); this.showToast('Permintaan stok dikirim ke Gudang Pusat Cloud VPS'); },
      error: () => this.showToast('Cloud offline — simpan permintaan saat koneksi pulih')
    });
  }

  verifyLicense(): void {
    this.http.post<{ valid: boolean; outletName?: string }>(`${this.cloudSyncApi}/outlets/verify-license`, { activationCode: this.licenseForm.activationCode }).subscribe({
      next: (r) => { this.licenseForm.status = `Terverifikasi Resmi (${r.outletName})`; this.showToast('Lisensi aktif & valid!'); },
      error: () => this.showToast('Kode aktivasi tidak ditemukan di Cloud VPS')
    });
  }

  saveUser(): void {
    this.http.post(`${this.localApi}/users`, this.newUser).subscribe({
      next: () => { this.drawerMode = null; this.loadLocalState(); this.showToast('User cabang ditambahkan'); }
    });
  }

  selectPage(groupName: string, pageName: string): void {
    this.selectedGroup = groupName;
    this.selectedPage = pageName;
    this.openGroups.add(groupName);
    this.tableSearch = '';
    this.statusFilter = 'Semua';
    this.page = 1;
    this.sidebarOpen = false;
  }

  isGroupOpen(g: string): boolean { return this.menuSearch.trim().length > 0 || this.openGroups.has(g); }
  toggleGroup(g: string, e: Event): void { e.preventDefault(); if (this.openGroups.has(g)) this.openGroups.delete(g); else this.openGroups.add(g); }
  toggleTheme(): void { const r = document.documentElement; r.dataset['theme'] = getComputedStyle(r).colorScheme === 'dark' ? 'light' : 'dark'; }
  printPage(): void { window.print(); }
  showToast(msg: string): void {
    this.toastMessage = msg; this.toastVisible = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => (this.toastVisible = false), 2600);
  }
}
