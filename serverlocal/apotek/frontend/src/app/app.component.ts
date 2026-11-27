import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TablePagerComponent } from './shared/table-pager.component';
import { filterRows, paginateRows } from './shared/table-filter';
import { ApotekSaleFormComponent } from './forms/apotek-sale-form.component';
import { ApotekNarcoticFormComponent } from './forms/apotek-narcotic-form.component';

export interface MenuGroup { name: string; code: string; items: string[]; }
export interface UserOutlet { name: string; role: string; outlet: string; status: string; syncStatus: string; }
export interface SyncOutboxItem { id: string; entityType: string; summary: string; amountMillions: number; createdAt: string; status: 'Menunggu (Offline)' | 'Tersinkron'; }

const APOTEK_MENU: MenuGroup[] = [
  { name: 'Dashboard Outlet', code: 'DB', items: ['Ringkasan Hari Ini', 'Status Koneksi', 'Antrean Sinkronisasi'] },
  { name: 'Penjualan', code: 'PJ', items: ['Resep', 'Penjualan Bebas (OTC)', 'Retur Penjualan', 'Cek Stok Cepat'] },
  { name: 'Kasir', code: 'KS', items: ['Transaksi', 'Tutup Kasir'] },
  { name: 'Pelayanan Farmasi', code: 'FA', items: ['Telaah Resep', 'Peracikan', 'Etiket & Info Obat', 'Narkotika/Psikotropika'] },
  { name: 'Stok Obat', code: 'SO', items: ['Stok per Batch', 'Penerimaan Barang', 'Permintaan ke Pusat', 'Mutasi & Opname', 'Obat Rusak/Expired'] },
  { name: 'Integrasi', code: 'IT', items: ['SATUSEHAT Medication', 'BPJS PRB'] },
  { name: 'Laporan Apotek', code: 'LA', items: ['Penjualan', 'Stok', 'Laba', 'Narkotika/Psikotropika', 'Obat Terlaris'] },
  { name: 'Sinkronisasi', code: 'SY', items: ['Status Sinkron Cloud', 'Log Sinkronisasi', 'Sinkron Manual', 'Data Tertunda Offline'] },
  { name: 'Pengguna Outlet', code: 'PO', items: ['Daftar User Outlet', 'Permintaan Perubahan Akses'] },
  { name: 'Pengaturan Lokal', code: 'PL', items: ['Profil Outlet', 'Printer & Perangkat', 'Backup Lokal', 'Versi & Lisensi'] }
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, TablePagerComponent, ApotekSaleFormComponent, ApotekNarcoticFormComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly localApi = 'http://localhost:5183/api';
  readonly cloudSyncApi = 'http://localhost:5180/api';
  private pollTimer?: ReturnType<typeof setInterval>;

  readonly outletId = 'apotek';
  readonly outletName = 'Apotek';
  brand = 'Klinik Group';
  where = 'Server lokal · Apotek';

  activeRole = 'Apoteker Penanggung Jawab (Semua Akses)';
  availableRoles = ['Apoteker Penanggung Jawab (Semua Akses)', 'Kasir POS Apotek', 'Petugas Gudang & Stok Obat'];

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

  get menuGroups(): MenuGroup[] {
    let base = APOTEK_MENU;
    if (this.activeRole === 'Kasir POS Apotek') base = APOTEK_MENU.filter((g) => ['Dashboard Outlet', 'Penjualan', 'Kasir', 'Laporan Apotek'].includes(g.name));
    else if (this.activeRole === 'Petugas Gudang & Stok Obat') base = APOTEK_MENU.filter((g) => ['Dashboard Outlet', 'Stok Obat', 'Sinkronisasi'].includes(g.name));
    const q = this.menuSearch.trim().toLowerCase();
    if (!q) return base;
    return base.map((g) => ({ ...g, items: g.items.filter((i) => i.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0);
  }

  todaySalesMillions = 21.7;
  sales: Array<{ trxNo: string; time: string; type: string; buyer: string; items: string; signa: string; displayTotal: string; pharmacist: string; status: string }> = [];
  narcoticRegisters: Array<{ regId: string; date: string; drugName: string; patientName: string; patientAddress: string; doctorName: string; qtyOut: number; remainingStock: number; pharmacist: string }> = [];
  batches: Array<{ code: string; name: string; batchNo: string; expiredDate: string; qty: number; rack: string; isNearExpired: boolean }> = [];
  syncOutbox: SyncOutboxItem[] = [];
  users: UserOutlet[] = [];

  saleForm = { saleType: 'Penjualan Bebas (OTC)', buyerName: 'Pelanggan Umum', itemsSummary: 'Amoxicillin 500mg (10)', kfaCode: 'KFA-93001', qty: 10, totalRp: 35000, signa: '3x1 sesudah makan' };
  narcForm = { drugName: 'Codeine 10mg Tablet', patientName: '', patientAddress: '', doctorName: 'Dr. Andi Wijaya', qtyOut: 10 };
  licenseForm = { activationCode: 'KLN-APT3-A9', status: 'Terverifikasi Lokal' };

  get stats() {
    return [
      { label: 'Transaksi hari ini', value: String(this.sales.length) },
      { label: 'Penjualan', value: `Rp ${this.todaySalesMillions.toFixed(1).replace('.', ',')} jt` },
      { label: 'Obat hampir expired', value: String(this.batches.filter((b) => b.isNearExpired).length) },
      { label: 'Antre sinkron', value: String(this.pendingOutbox.length) }
    ];
  }
  get pendingOutbox(): SyncOutboxItem[] { return this.syncOutbox.filter((s) => s.status !== 'Tersinkron'); }
  filtered<T>(rows: T[]): T[] { return filterRows(rows, this.tableSearch); }
  paged<T>(rows: T[]): T[] { return paginateRows(this.filtered(rows), this.page, this.pageSize); }

  ngOnInit(): void {
    this.loadLocalState();
    this.pullFromCloud();
    this.pollTimer = setInterval(() => { if (this.isOnline) this.pullFromCloud(); }, 5000);
  }
  ngOnDestroy(): void { if (this.pollTimer) clearInterval(this.pollTimer); }

  loadLocalState(): void {
    this.http.get<Record<string, unknown>>(`${this.localApi}/state`).subscribe({
      next: (s) => {
        this.isOnline = Boolean(s['isOnline'] ?? true);
        this.todaySalesMillions = Number(s['todaySalesMillions'] ?? 21.7);
        this.sales = (s['sales'] as typeof this.sales) || [];
        this.narcoticRegisters = (s['narcoticRegisters'] as typeof this.narcoticRegisters) || [];
        this.batches = (s['batches'] as typeof this.batches) || [];
        this.syncOutbox = (s['syncOutbox'] as SyncOutboxItem[]) || [];
        this.users = (s['users'] as UserOutlet[]) || [];
        this.connText = this.isOnline ? 'Terhubung ke VPS' : `Offline (${this.pendingOutbox.length} antre)`;
        this.connStatus = this.isOnline ? 'ok' : 'bad';
      },
      error: () => { }
    });
  }

  onRoleChange(r: string): void {
    this.activeRole = r;
    const first = this.menuGroups[0];
    if (first) this.selectPage(first.name, first.items[0]);
    this.showToast(`Role Apotek: ${r}`);
  }

  toggleOnlineMode(): void {
    this.isOnline = !this.isOnline;
    this.http.post(`${this.localApi}/sync/toggle`, { isOnline: this.isOnline }).subscribe({ next: () => { }, error: () => { } });
    this.http.post(`${this.cloudSyncApi}/sync/status`, { outletId: this.outletId, outletName: this.outletName, isOnline: this.isOnline, pendingCount: this.pendingOutbox.length }).subscribe({ next: () => { }, error: () => { } });
    this.connText = this.isOnline ? 'Terhubung ke VPS' : `Offline (${this.pendingOutbox.length} antre)`;
    this.connStatus = this.isOnline ? 'ok' : 'bad';
    if (this.isOnline) this.syncNow();
  }

  syncNow(): void {
    this.http.post<{ pushed: number }>(`${this.localApi}/sync/push-now`, {}).subscribe({
      next: (r) => { this.loadLocalState(); this.pullFromCloud(); this.showToast(r.pushed > 0 ? `${r.pushed} data Apotek disinkronkan ke Cloud` : 'Sinkronisasi selesai'); }
    });
  }

  pullFromCloud(): void {
    this.http.get<{ masterVersion: number; outletUsers?: UserOutlet[] }>(`${this.cloudSyncApi}/sync/pull?outletId=${this.outletId}&outletName=${encodeURIComponent(this.outletName)}`).subscribe({
      next: (r) => { if (r?.masterVersion) this.masterVersion = r.masterVersion; if (r?.outletUsers?.length) this.users = r.outletUsers; },
      error: () => { }
    });
  }

  submitSale(): void {
    this.http.post(`${this.localApi}/pos/sale`, this.saleForm).subscribe({
      next: () => { this.drawerMode = null; this.loadLocalState(); if (this.isOnline) this.syncNow(); this.showToast('Transaksi POS berhasil dicatat & cetak struk'); }
    });
  }

  submitNarcotic(): void {
    if (!this.narcForm.patientName.trim()) return;
    this.http.post(`${this.localApi}/pharmacy/narcotics`, this.narcForm).subscribe({
      next: () => { this.narcForm.patientName = ''; this.drawerMode = null; this.loadLocalState(); this.showToast('Register SIPNAP Narkotika dicatat'); }
    });
  }

  requestCentralStock(itemCode = 'KFA-93003'): void {
    this.http.post(`${this.cloudSyncApi}/stock-requests`, { outletId: this.outletId, outletName: this.outletName, itemCode, qty: 100 }).subscribe({
      next: () => this.showToast('Permintaan stok dikirim ke Gudang Pusat Cloud VPS')
    });
  }

  verifyLicense(): void {
    this.http.post<{ outletName?: string }>(`${this.cloudSyncApi}/outlets/verify-license`, { activationCode: this.licenseForm.activationCode }).subscribe({
      next: (r) => { this.licenseForm.status = `Terverifikasi Resmi (${r.outletName})`; this.showToast('Lisensi Apotek aktif'); }
    });
  }

  selectPage(g: string, p: string): void { this.selectedGroup = g; this.selectedPage = p; this.openGroups.add(g); this.tableSearch = ''; this.page = 1; this.sidebarOpen = false; }
  isGroupOpen(g: string): boolean { return this.menuSearch.trim().length > 0 || this.openGroups.has(g); }
  toggleGroup(g: string, e: Event): void { e.preventDefault(); if (this.openGroups.has(g)) this.openGroups.delete(g); else this.openGroups.add(g); }
  toggleTheme(): void { const r = document.documentElement; r.dataset['theme'] = getComputedStyle(r).colorScheme === 'dark' ? 'light' : 'dark'; }
  printPage(): void { window.print(); }
  showToast(msg: string): void { this.toastMessage = msg; this.toastVisible = true; if (this.toastTimeout) clearTimeout(this.toastTimeout); this.toastTimeout = setTimeout(() => (this.toastVisible = false), 2600); }
}
