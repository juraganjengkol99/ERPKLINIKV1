import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  CLOUD_MENU,
  JournalEntryRecord,
  MenuGroup,
  OutletStatusItem,
  StatItem,
  SyncLogEntry,
  UserOutlet
} from '../models/erp.models';

@Injectable({ providedIn: 'root' })
export class CloudStateService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly apiBase = 'http://localhost:5180/api';

  readonly token = signal<string>('');
  readonly isAuthenticated = signal<boolean>(false);
  readonly currentUser = signal<UserOutlet | null>(null);
  readonly activeRole = signal<string>('Owner / Direktur (Semua Akses)');
  readonly availableRoles = [
    'Owner / Direktur (Semua Akses)',
    'Manajer HR & SDM',
    'Manajer Keuangan & Akunting',
    'Manajer Purchasing & Logistik'
  ];

  readonly stats = signal<StatItem[]>([
    { label: 'Outlet online', value: '2 dari 3' },
    { label: 'Kunjungan hari ini', value: '412' },
    { label: 'Pendapatan hari ini', value: 'Rp 86,4 jt' },
    { label: 'Data menunggu sinkron', value: '3' }
  ]);
  readonly outlets = signal<OutletStatusItem[]>([]);
  readonly syncLogs = signal<SyncLogEntry[]>([]);
  readonly journalEntries = signal<JournalEntryRecord[]>([]);
  readonly unreadNotifications = signal<number>(0);

  readonly connText = computed(() => {
    const list = this.outlets();
    if (list.length === 0) return 'Memuat cabang...';
    const online = list.filter((o) => o.connectionLabel === 'Online').length;
    return `${online}/${list.length} outlet online`;
  });

  readonly connStatus = computed<'ok' | 'warn'>(() => {
    const list = this.outlets();
    if (list.length === 0) return 'warn';
    const online = list.filter((o) => o.connectionLabel === 'Online').length;
    return online === list.length ? 'ok' : 'warn';
  });

  readonly visibleMenuGroups = computed<MenuGroup[]>(() => {
    const role = this.activeRole();
    if (role === 'Manajer HR & SDM') {
      return CLOUD_MENU.filter((g) => ['Dashboard', 'HR', 'Laporan Konsolidasi'].includes(g.name));
    }
    if (role === 'Manajer Keuangan & Akunting') {
      return CLOUD_MENU.filter((g) => ['Dashboard', 'Keuangan', 'Akunting', 'Laporan Konsolidasi'].includes(g.name));
    }
    if (role === 'Manajer Purchasing & Logistik') {
      return CLOUD_MENU.filter((g) => ['Dashboard', 'Purchasing', 'Inventory', 'GA'].includes(g.name));
    }
    return CLOUD_MENU;
  });

  readonly toastMessage = signal<string>('');
  readonly toastVisible = signal<boolean>(false);
  private toastTimer?: ReturnType<typeof setTimeout>;
  private pollTimer?: ReturnType<typeof setInterval>;

  readonly confirmModal = signal<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  readonly editingOutlet = signal<OutletStatusItem | null>(null);

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    const raw = localStorage.getItem('erpklinik_cloud_session_v2');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.user) {
        this.token.set(parsed.token);
        this.currentUser.set(parsed.user);
        this.isAuthenticated.set(true);
        this.activeRole.set(this.mapUserRoleToCloudRole(parsed.user.role));
      }
    } catch {
      localStorage.removeItem('erpklinik_cloud_session_v2');
    }
  }

  mapUserRoleToCloudRole(userRole: string): string {
    if (userRole.includes('Owner') || userRole.includes('Direktur')) return 'Owner / Direktur (Semua Akses)';
    if (userRole.includes('HR')) return 'Manajer HR & SDM';
    if (userRole.includes('Keuangan') || userRole === 'Kasir') return 'Manajer Keuangan & Akunting';
    if (userRole.includes('Purchasing') || userRole === 'Apoteker') return 'Manajer Purchasing & Logistik';
    return 'Owner / Direktur (Semua Akses)';
  }

  setSession(token: string, user: UserOutlet): void {
    this.token.set(token);
    this.currentUser.set(user);
    this.isAuthenticated.set(true);
    this.activeRole.set(this.mapUserRoleToCloudRole(user.role));
    localStorage.setItem('erpklinik_cloud_session_v2', JSON.stringify({ token, user }));
    this.refreshDashboard();
    this.startPolling();
  }

  logout(message = 'Anda telah keluar dari Cloud VPS'): void {
    this.stopPolling();
    localStorage.removeItem('erpklinik_cloud_session_v2');
    this.token.set('');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.showToast(message);
  }

  forceExpireSession(): void {
    this.logout('Sesi login kedaluwarsa. Silakan masuk kembali.');
  }

  startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (this.isAuthenticated()) {
        this.refreshDashboard();
      }
    }, 5000);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  refreshDashboard(): void {
    if (!this.isAuthenticated()) return;
    this.http
      .get<{
        stats: StatItem[];
        outlets: OutletStatusItem[];
        recentSyncLogs?: SyncLogEntry[];
        journalEntries?: JournalEntryRecord[];
        unreadNotifications?: number;
      }>(`${this.apiBase}/dashboard`)
      .subscribe({
        next: (res) => {
          if (!res) return;
          if (res.stats) this.stats.set(res.stats);
          if (res.outlets) this.outlets.set(res.outlets);
          if (res.recentSyncLogs) this.syncLogs.set(res.recentSyncLogs);
          if (res.journalEntries) this.journalEntries.set(res.journalEntries);
          if (res.unreadNotifications !== undefined) this.unreadNotifications.set(res.unreadNotifications);
        },
        error: () => {}
      });
  }

  isOwnerAccount(): boolean {
    const r = this.currentUser()?.role || '';
    return r.includes('Owner') || r.includes('Direktur');
  }

  setPreviewRole(newRole: string): void {
    this.activeRole.set(newRole);
    const first = this.visibleMenuGroups()[0];
    if (first && first.items[0]) {
      this.router.navigate(['/', first.routeBase, first.items[0].slug]);
    }
    this.showToast(`Tampilan menu disesuaikan untuk: ${newRole}`);
  }

  showToast(message: string): void {
    this.toastMessage.set(message);
    this.toastVisible.set(true);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible.set(false), 2800);
  }

  askConfirm(opts: { title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }): void {
    this.confirmModal.set({
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel || 'Ya, Lanjutkan',
      danger: opts.danger,
      onConfirm: opts.onConfirm
    });
  }

  executeConfirm(): void {
    const m = this.confirmModal();
    if (m) {
      m.onConfirm();
      this.confirmModal.set(null);
    }
  }

  exportJournalsCsv(): void {
    const rowsData = this.journalEntries();
    const header = 'No Jurnal,Tanggal,Cabang,Sumber,Akun Debit,Akun Kredit,Keterangan,Nominal,Status\n';
    const rows = rowsData
      .map(
        (j) =>
          `"${j.code}","${j.date}","${j.outlet}","${j.source || 'Auto-Sync'}","${j.accountDebit || ''}","${j.accountCredit || ''}","${j.description.replace(/"/g, '""')}","${j.amount}","${j.status}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jurnal_konsolidasi_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Laporan Jurnal Konsolidasi berhasil diexport ke CSV');
  }
}
