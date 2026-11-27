import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TablePagerComponent } from './shared/table-pager.component';
import { filterRows, paginateRows } from './shared/table-filter';
import { PratamaRegisterFormComponent } from './forms/pratama-register-form.component';
import { PratamaSoapFormComponent } from './forms/pratama-soap-form.component';

export interface MenuGroup { name: string; code: string; items: string[]; }
export interface UserOutlet { name: string; role: string; outlet: string; status: string; syncStatus: string; }
export interface SyncOutboxItem { id: string; entityType: string; summary: string; amountMillions: number; createdAt: string; status: 'Menunggu (Offline)' | 'Tersinkron'; }

function buildPratamaMenu(ri: boolean): MenuGroup[] {
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
    { name: 'BPJS Kesehatan', code: 'BP', items: ['Cek Kepesertaan', 'P-Care Kunjungan', 'Rujukan', 'Prolanis & Skrining', 'Log Bridging'] },
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
  imports: [CommonModule, FormsModule, TablePagerComponent, PratamaRegisterFormComponent, PratamaSoapFormComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly localApi = 'http://localhost:5182/api';
  readonly cloudSyncApi = 'http://localhost:5180/api';
  private pollTimer?: ReturnType<typeof setInterval>;

  readonly outletId = 'klinikpratama';
  readonly outletName = 'Klinik Pratama';
  brand = 'Klinik Group';
  where = 'Server lokal · Klinik Pratama';
  serviceMode: 'pratama_ri' | 'pratama_rj' = 'pratama_ri';

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

  tableSearch = '';
  page = 1;
  pageSize = 10;
  drawerMode: string | null = null;
  cloudDisabledCodes = new Set<string>();

  get menuGroups(): MenuGroup[] {
    const raw = buildPratamaMenu(this.serviceMode === 'pratama_ri').filter((g) => !this.cloudDisabledCodes.has(g.code));
    let base = raw;
    if (this.activeRole === 'Dokter') base = raw.filter((g) => ['Dashboard Outlet', 'Rawat Jalan', 'Rawat Inap', 'IGD', 'Rekam Medis', 'SATUSEHAT'].includes(g.name));
    else if (this.activeRole === 'Apoteker / Farmasi') base = raw.filter((g) => ['Dashboard Outlet', 'Farmasi', 'Inventory Outlet'].includes(g.name));
    else if (this.activeRole === 'Kasir') base = raw.filter((g) => ['Dashboard Outlet', 'Kasir', 'Laporan Outlet'].includes(g.name));
    else if (this.activeRole === 'Petugas Pendaftaran') base = raw.filter((g) => ['Dashboard Outlet', 'Pendaftaran', 'BPJS Kesehatan'].includes(g.name));
    const q = this.menuSearch.trim().toLowerCase();
    if (!q) return base;
    return base.map((g) => ({ ...g, items: g.items.filter((i) => i.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0);
  }

  todayRevenueMillions = 26.5;
  patients: Array<{ rmNumber: string; fullName: string; nik: string; bpjsNo: string; ihsId: string; gender: string; address: string }> = [];
  encounters: Array<{ encounterId: string; queueNo: string; rmNumber: string; patientName: string; poliName: string; doctorName: string; payerType: string; sepNo: string; status: string; visitTime: string }> = [];
  soapNotes: Array<{ soapId: number; patientLabel: string; subjective: string; objective: string; icd10Code: string; planNotes: string; prescriptionSummary: string; fhirStatus: string }> = [];
  prescriptions: Array<{ rxNo: string; patientLabel: string; doctorName: string; itemsSummary: string; signa: string; status: string; createdAt: string }> = [];
  invoices: Array<{ invoiceNo: string; patientLabel: string; serviceSummary: string; payerType: string; displayAmount: string; status: string }> = [];
  syncOutbox: SyncOutboxItem[] = [];
  users: UserOutlet[] = [];

  regForm = { name: '', nik: '', bpjsNo: '', poli: 'Poli Umum', doctor: 'Dr. Hendra Kusuma', payer: 'BPJS P-Care' };
  soapForm = { encounterId: '', patientLabel: '', subjective: 'Batuk & pilek 2 hari', objective: 'TD 118/78, S 37.2', icd10: 'J06.9 - ISPA', plan: 'Terapi simtomatik', prescription: 'Paracetamol 500mg (10)' };
  newUser = { name: '', role: 'Dokter', outlet: 'Klinik Pratama' };
  licenseForm = { activationCode: 'KLN-PRT2-A9', status: 'Terverifikasi Lokal' };

  get stats() {
    return [
      { label: 'Pasien hari ini', value: String(this.encounters.length) },
      { label: 'Pendapatan lokal', value: `Rp ${this.todayRevenueMillions.toFixed(1).replace('.', ',')} jt` },
      { label: 'Antrean poli', value: String(this.encounters.filter((e) => e.status === 'Menunggu Poli').length) },
      { label: 'Antre sinkron', value: String(this.pendingOutbox.length) }
    ];
  }
  get pendingOutbox(): SyncOutboxItem[] { return this.syncOutbox.filter((s) => s.status !== 'Tersinkron'); }
  filtered<T>(rows: T[]): T[] { return filterRows(rows, this.tableSearch); }
  paged<T>(rows: T[]): T[] { return paginateRows(this.filtered(rows), this.page, this.pageSize); }

  ngOnInit(): void {
    const cachedScope = typeof localStorage !== 'undefined' ? localStorage.getItem('klinikpratama_service_scope') : null;
    if (cachedScope) this.applyCloudServiceScope(cachedScope, undefined, false);
    this.loadLocalState();
    this.pullFromCloud();
    this.pollTimer = setInterval(() => { if (this.isOnline) this.pullFromCloud(); }, 5000);
  }
  ngOnDestroy(): void { if (this.pollTimer) clearInterval(this.pollTimer); }

  loadLocalState(): void {
    this.http.get<Record<string, unknown>>(`${this.localApi}/state`).subscribe({
      next: (s) => {
        this.isOnline = Boolean(s['isOnline'] ?? true);
        this.todayRevenueMillions = Number(s['todayRevenueMillions'] ?? 26.5);
        this.patients = (s['patients'] as typeof this.patients) || [];
        this.encounters = (s['encounters'] as typeof this.encounters) || [];
        this.soapNotes = (s['soapNotes'] as typeof this.soapNotes) || [];
        this.prescriptions = (s['prescriptions'] as typeof this.prescriptions) || [];
        this.invoices = (s['invoices'] as typeof this.invoices) || [];
        this.syncOutbox = (s['syncOutbox'] as SyncOutboxItem[]) || [];
        this.users = (s['users'] as UserOutlet[]) || [];
        if (typeof s['serviceScope'] === 'string') {
          this.applyCloudServiceScope(s['serviceScope'], String(s['cloudOutletType'] ?? ''), false);
        }
        this.connText = this.isOnline ? 'Terhubung ke VPS' : `Offline (${this.pendingOutbox.length} antre)`;
        this.connStatus = this.isOnline ? 'ok' : 'bad';
      },
      error: () => {}
    });
  }

  private applyCloudServiceScope(scope: string, outletType?: string, notify = true): void {
    const isRjOnly = scope === 'RJ_ONLY' || (Boolean(outletType) && String(outletType).includes('Rawat Jalan') && !String(outletType).includes('Rawat Inap'));
    const nextMode: 'pratama_ri' | 'pratama_rj' = isRjOnly ? 'pratama_rj' : 'pratama_ri';
    const changed = this.serviceMode !== nextMode;
    this.serviceMode = nextMode;
    this.where = nextMode === 'pratama_ri' ? 'Server lokal · Klinik Pratama (RI & RJ)' : 'Server lokal · Klinik Pratama (RJ)';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('klinikpratama_service_scope', isRjOnly ? 'RJ_ONLY' : 'RI_RJ');
    }
    const stillVisible = this.menuGroups.some((g) => g.name === this.selectedGroup && g.items.includes(this.selectedPage));
    if (!stillVisible) {
      const first = this.menuGroups[0];
      if (first) this.selectPage(first.name, first.items[0]);
    }
    if (changed && notify) {
      this.showToast(`Jenis klinik dari Cloud: ${nextMode === 'pratama_ri' ? 'Rawat Inap & Jalan' : 'Rawat Jalan Saja'}`);
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
    this.connText = this.isOnline ? 'Terhubung ke VPS' : `Offline (${this.pendingOutbox.length} antre)`;
    this.connStatus = this.isOnline ? 'ok' : 'bad';
    if (this.isOnline) this.syncNow();
  }

  syncNow(): void {
    this.http.post<{ pushed: number }>(`${this.localApi}/sync/push-now`, {}).subscribe({
      next: (r) => { this.loadLocalState(); this.pullFromCloud(); this.showToast(r.pushed > 0 ? `${r.pushed} data disinkronkan ke Cloud VPS` : 'Sinkronisasi selesai'); }
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
    }>(`${this.cloudSyncApi}/sync/pull?outletId=${this.outletId}&outletName=${encodeURIComponent(this.outletName)}`).subscribe({
      next: (r) => {
        if (r?.masterVersion) this.masterVersion = r.masterVersion;
        if (r?.outletUsers?.length) this.users = r.outletUsers;
        if (r?.templateModules?.length) {
          this.cloudDisabledCodes = new Set(r.templateModules.filter((m) => m.enabled === false).map((m) => m.code));
        }
        const scope = r?.serviceScope || r?.outlet?.serviceScope || '';
        const oType = r?.outletType || r?.outlet?.type || '';
        if (scope || oType) {
          this.applyCloudServiceScope(scope, oType, true);
          this.http.post(`${this.localApi}/config/cloud-profile`, {
            outletType: oType,
            serviceScope: scope || (this.serviceMode === 'pratama_rj' ? 'RJ_ONLY' : 'RI_RJ'),
            masterVersion: this.masterVersion
          }).subscribe({ next: () => {}, error: () => {} });
        }
      },
      error: () => {}
    });
  }

  registerPatient(): void {
    if (!this.regForm.name.trim()) return;
    this.http.post(`${this.localApi}/patients/register`, this.regForm).subscribe({
      next: () => { this.regForm.name = ''; this.drawerMode = null; this.loadLocalState(); if (this.isOnline) this.syncNow(); this.showToast('Pasien terdaftar ke Antrean FKTP'); }
    });
  }

  saveSoap(): void {
    if (!this.soapForm.patientLabel) this.soapForm.patientLabel = this.encounters[0]?.patientName || 'Pasien FKTP';
    this.http.post(`${this.localApi}/clinical/soap`, this.soapForm).subscribe({
      next: () => { this.drawerMode = null; this.loadLocalState(); if (this.isOnline) this.syncNow(); this.showToast('SOAP & Resep FKTP disimpan'); }
    });
  }

  dispenseRx(rxNo: string): void {
    this.http.post(`${this.localApi}/pharmacy/dispense/${rxNo}`, {}).subscribe({
      next: () => { this.loadLocalState(); if (this.isOnline) this.syncNow(); this.showToast(`Resep ${rxNo} diserahkan`); }
    });
  }

  payInvoice(invoiceNo: string): void {
    this.http.post(`${this.localApi}/cashier/pay/${invoiceNo}`, { method: 'Tunai' }).subscribe({
      next: () => { this.loadLocalState(); if (this.isOnline) this.syncNow(); this.showToast(`Tagihan ${invoiceNo} LUNAS`); }
    });
  }

  verifyLicense(): void {
    this.http.post<{ outletName?: string }>(`${this.cloudSyncApi}/outlets/verify-license`, { activationCode: this.licenseForm.activationCode }).subscribe({
      next: (r) => { this.licenseForm.status = `Terverifikasi Resmi (${r.outletName})`; this.showToast('Lisensi aktif'); }
    });
  }

  saveUser(): void {
    this.http.post(`${this.localApi}/users`, this.newUser).subscribe({ next: () => { this.drawerMode = null; this.loadLocalState(); this.showToast('User cabang ditambahkan'); } });
  }

  selectPage(g: string, p: string): void { this.selectedGroup = g; this.selectedPage = p; this.openGroups.add(g); this.tableSearch = ''; this.page = 1; this.sidebarOpen = false; }
  isGroupOpen(g: string): boolean { return this.menuSearch.trim().length > 0 || this.openGroups.has(g); }
  toggleGroup(g: string, e: Event): void { e.preventDefault(); if (this.openGroups.has(g)) this.openGroups.delete(g); else this.openGroups.add(g); }
  toggleTheme(): void { const r = document.documentElement; r.dataset['theme'] = getComputedStyle(r).colorScheme === 'dark' ? 'light' : 'dark'; }
  printPage(): void { window.print(); }
  showToast(msg: string): void { this.toastMessage = msg; this.toastVisible = true; if (this.toastTimeout) clearTimeout(this.toastTimeout); this.toastTimeout = setTimeout(() => (this.toastVisible = false), 2600); }
}
