import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationItem, OutletStatusItem, SyncLogEntry } from '../../core/models/erp.models';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { BarChartDatum, SvgBarChartComponent } from '../../shared/components/svg-bar-chart.component';
import { SlideDrawerComponent } from '../../shared/components/slide-drawer.component';
import { TablePagerComponent } from '../../shared/components/table-pager.component';
import { filterRows, paginateRows } from '../../shared/utils/table-filter';
import { IdrPipe } from '../../shared/pipes/idr.pipe';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SvgBarChartComponent, SlideDrawerComponent, TablePagerComponent, IdrPipe],
  template: `
    @if (sub === 'ringkasan-seluruh-outlet') {
      <div class="stats">
        @for (s of state.stats(); track s.label) {
          <div class="stat">
            <span>{{ s.label }}</span>
            <b>{{ s.value }}</b>
          </div>
        }
      </div>

      <div class="two">
        <div class="panel">
          <h2>Pendapatan Hari Ini per Outlet (Rp Juta)</h2>
          <app-svg-bar-chart [data]="revenueChartData" />
        </div>

        <div class="panel">
          <h2>
            Perlu Tindakan Pusat
            <span class="sp"></span>
            <button class="ib btn-sm" type="button" (click)="router.navigate(['/dashboard/notifikasi'])">Semua Notifikasi</button>
          </h2>
          @for (act of actionItems; track act.label) {
            <div class="row">
              <span>{{ act.label }}</span>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="pill" [ngClass]="act.severity">{{ act.count }} item</span>
                <button class="ib btn-sm" type="button" (click)="router.navigateByUrl(act.route)">Buka</button>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="panel">
        <h2>
          Status Outlet (Monitoring Real-Time)
          <span class="sp"></span>
          <input class="input" [(ngModel)]="outletSearch" (ngModelChange)="outletPage = 1" placeholder="Cari outlet / tipe..." />
          <select class="select" [(ngModel)]="outletConnFilter" (ngModelChange)="outletPage = 1">
            <option value="Semua">Semua Koneksi</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
          </select>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Tipe</th>
                <th>Koneksi</th>
                <th>Sinkron Terakhir</th>
                <th class="num">Kunjungan</th>
                <th class="num">Pendapatan</th>
                <th>SATUSEHAT</th>
                <th>BPJS</th>
                <th>Simulasi</th>
              </tr>
            </thead>
            <tbody>
              @for (o of pagedOutlets; track o.outletId) {
                <tr>
                  <td><b>{{ o.name }}</b></td>
                  <td>{{ o.type }}</td>
                  <td><span class="pill" [ngClass]="o.connectionStatus">{{ o.connectionLabel }}</span></td>
                  <td>{{ o.lastSync }}</td>
                  <td class="num">{{ o.todayVisits ?? 0 }}</td>
                  <td class="num">Rp {{ (o.todayRevenueMillions ?? 0).toFixed(1).replace('.', ',') }} jt</td>
                  <td><span class="pill" [ngClass]="o.satuSehatStatus">{{ o.satuSehatLabel }}</span></td>
                  <td><span class="pill" [ngClass]="o.bpjsStatus">{{ o.bpjsLabel }}</span></td>
                  <td>
                    <button class="ib btn-sm" type="button" (click)="toggleOutletOnline(o)">
                      {{ o.connectionLabel === 'Online' ? 'Set Offline' : 'Set Online' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-table-pager [total]="filteredOutlets.length" [(page)]="outletPage" [(pageSize)]="pageSize" />
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" type="button" (click)="router.navigate(['/manajemen-outlet/tambah-outlet-baru'])">+ Tambah Outlet Baru</button>
        <button class="ib" type="button" (click)="router.navigate(['/inventory/mutasi-antar-outlet'])">Kelola Mutasi Stok</button>
      </div>

    } @else if (sub === 'kinerja-per-outlet') {
      <div class="panel">
        <h2>
          Benchmark & Kinerja Operasional per Outlet
          <span class="sp"></span>
          <select class="select" [(ngModel)]="perfRange" (ngModelChange)="loadPerformance()">
            <option value="today">Hari Ini</option>
            <option value="7d">7 Hari Terakhir</option>
            <option value="30d">30 Hari Terakhir</option>
          </select>
        </h2>
        <div class="two" style="padding:16px">
          <div class="panel" style="margin:0">
            <h2>Komparasi Omzet Cabang</h2>
            <app-svg-bar-chart [data]="perfRevenueChart" />
          </div>
          <div class="panel" style="margin:0">
            <h2>Komparasi Volume Kunjungan / Transaksi</h2>
            <app-svg-bar-chart [data]="perfVisitChart" />
          </div>
        </div>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Tipe</th>
                <th class="num">Kunjungan / Trx</th>
                <th class="num">Total Omzet</th>
                <th class="num">Rata-rata / Pasien</th>
                <th>Indikator SLA Operasional</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (r of perfRows; track r.outletId) {
                <tr>
                  <td><b>{{ r.name }}</b></td>
                  <td>{{ r.type }}</td>
                  <td class="num">{{ r.visits }}</td>
                  <td class="num"><b>Rp {{ r.revenueMillions.toFixed(2).replace('.', ',') }} jt</b></td>
                  <td class="num">{{ r.avgTicketRp | idr }}</td>
                  <td><span class="pill info">{{ r.operationalRate }}</span></td>
                  <td><span class="pill" [ngClass]="r.isOnline ? 'ok' : 'bad'">{{ r.isOnline ? 'Online' : 'Offline' }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'status-sinkronisasi') {
      <div class="stats">
        <div class="stat"><span>Master Version Pusat</span><b>v{{ hubMasterVersion }}</b></div>
        <div class="stat"><span>Koneksi MySQL Cloud</span><b>{{ mysqlConnected ? 'Terhubung' : 'Fallback JSON' }}</b></div>
        <div class="stat"><span>Node Cabang Online</span><b>{{ state.connText() }}</b></div>
        <div class="stat"><span>Log Sinkronisasi Tercatat</span><b>{{ state.syncLogs().length }}</b></div>
      </div>

      <div class="panel">
        <h2>
          Topologi Sinkronisasi Cabang (Cloud VPS ⇄ Server Lokal)
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="broadcastMaster()">Broadcast Master v{{ hubMasterVersion }}</button>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Cabang</th>
                <th>Versi App Lokal</th>
                <th>Master Ack</th>
                <th>Heartbeat Terakhir</th>
                <th>Status Node</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (n of edgeNodes; track n.outletId) {
                <tr>
                  <td><b>{{ n.outletName }}</b></td>
                  <td><code>{{ n.appVersion }}</code></td>
                  <td>v{{ n.masterVersionAck }}</td>
                  <td>{{ n.lastHeartbeat }}</td>
                  <td><span class="pill" [ngClass]="n.status === 'Online' ? 'ok' : 'bad'">{{ n.status }}</span></td>
                  <td>
                    <button class="ib btn-sm" type="button" (click)="forceSyncNode(n.outletId)">Force Pull/Sync</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h2>
          Log Sinkronisasi Dua Arah
          <span class="sp"></span>
          <input class="input" [(ngModel)]="syncSearch" (ngModelChange)="syncPage = 1" placeholder="Filter cabang / modul / ringkasan..." />
          <select class="select" [(ngModel)]="syncDirFilter" (ngModelChange)="syncPage = 1">
            <option value="Semua">Semua Arah</option>
            <option value="LOKAL -> CLOUD">LOKAL -> CLOUD</option>
            <option value="CLOUD -> LOKAL">CLOUD -> LOKAL</option>
          </select>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Waktu</th>
                <th>Arah</th>
                <th>Cabang</th>
                <th>Modul</th>
                <th>Ringkasan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (log of pagedSyncLogs; track log.id + log.timestamp) {
                <tr style="cursor:pointer" (click)="selectedLog = log">
                  <td><code>{{ log.id }}</code></td>
                  <td>{{ log.timestamp }}</td>
                  <td><span class="pill info">{{ log.direction }}</span></td>
                  <td>{{ log.outlet }}</td>
                  <td>{{ log.entityType }}</td>
                  <td class="wrap-cell">{{ log.summary }}</td>
                  <td><span class="pill" [ngClass]="log.status.includes('Tersinkron') || log.status === 'Aktif' ? 'ok' : 'warn'">{{ log.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-table-pager [total]="filteredSyncLogs.length" [(page)]="syncPage" [(pageSize)]="pageSize" />
      </div>

    } @else if (sub === 'status-integrasi') {
      <div class="two">
        <div class="panel">
          <h2>
            Kesehatan SATUSEHAT (Kemenkes FHIR R4)
            <span class="sp"></span>
            <button class="ib btn-sm" type="button" (click)="router.navigate(['/integrasi/satusehat-monitoring-fhir'])">Inspeksi FHIR</button>
          </h2>
          <div class="row"><span>Payload FHIR Terkirim</span><span class="pill ok">{{ integrationHealth.fhirSent }} OK</span></div>
          <div class="row"><span>Payload Gagal / Antre</span><span class="pill" [ngClass]="integrationHealth.fhirFailed > 0 ? 'bad' : 'ok'">{{ integrationHealth.fhirFailed }} Item</span></div>
          @for (o of state.outlets(); track o.outletId) {
            <div class="row">
              <div>
                <b>{{ o.name }}</b>
                <div class="hint-text">Org ID: {{ o.satuSehatOrgId || '-' }} · {{ o.satuSehatEnv || 'Sandbox' }}</div>
              </div>
              <span class="pill" [ngClass]="o.satuSehatStatus">{{ o.satuSehatLabel }}</span>
            </div>
          }
        </div>

        <div class="panel">
          <h2>
            Kesehatan BPJS Kesehatan (VClaim / P-Care / PRB)
            <span class="sp"></span>
            <button class="ib btn-sm" type="button" (click)="router.navigate(['/integrasi/bpjs-monitoring-klaim'])">Monitoring Klaim</button>
          </h2>
          <div class="row"><span>Log Bridging Sukses</span><span class="pill ok">{{ integrationHealth.bpjsOk }} Sukses</span></div>
          <div class="row"><span>Antrean / Tertunda</span><span class="pill" [ngClass]="integrationHealth.bpjsPending > 0 ? 'warn' : 'ok'">{{ integrationHealth.bpjsPending }} Item</span></div>
          @for (o of state.outlets(); track o.outletId) {
            <div class="row">
              <div>
                <b>{{ o.name }}</b>
                <div class="hint-text">PPK: {{ o.bpjsPpkCode || '-' }} · {{ o.bpjsServiceType || o.type }}</div>
              </div>
              <span class="pill" [ngClass]="o.bpjsStatus">{{ o.bpjsLabel }}</span>
            </div>
          }
        </div>
      </div>

    } @else if (sub === 'notifikasi') {
      <div class="panel">
        <h2>
          Pusat Notifikasi & Peringatan Sistem
          <span class="sp"></span>
          <button class="ib btn-sm" type="button" (click)="markAllRead()">Tandai Semua Dibaca</button>
        </h2>
        <div class="toolbar">
          <button class="tab" [class.on]="notifFilter === 'all'" type="button" (click)="notifFilter = 'all'">Semua ({{ notifications.length }})</button>
          <button class="tab" [class.on]="notifFilter === 'unread'" type="button" (click)="notifFilter = 'unread'">Belum Dibaca ({{ unreadCount }})</button>
          <button class="tab" [class.on]="notifFilter === 'critical'" type="button" (click)="notifFilter = 'critical'">Kritis</button>
        </div>
        @for (n of filteredNotifications; track n.id) {
          <div class="row" [style.opacity]="n.isRead ? 0.72 : 1">
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="pill" [ngClass]="n.severity === 'critical' ? 'bad' : n.severity === 'warn' ? 'warn' : 'info'">
                  {{ n.severity === 'critical' ? 'Kritis' : n.severity === 'warn' ? 'Peringatan' : 'Info' }}
                </span>
                <b>{{ n.title }}</b>
                @if (!n.isRead) {
                  <span class="pill info">Baru</span>
                }
              </div>
              <div class="hint-text" style="margin-top:4px">{{ n.message }} · {{ n.createdAt }}</div>
            </div>
            <div style="display:flex;gap:6px;flex:none">
              @if (!n.isRead) {
                <button class="ib btn-sm" type="button" (click)="markRead(n)">Tandai Baca</button>
              }
              <button class="btn btn-sm" type="button" (click)="goNotification(n)">Tindak Lanjuti</button>
            </div>
          </div>
        }
        @if (filteredNotifications.length === 0) {
          <div class="empty">Tidak ada notifikasi pada kategori ini.</div>
        }
      </div>
    }

    <app-slide-drawer [open]="!!selectedLog" title="Detail Log Sinkronisasi" [subtitle]="selectedLog?.id || ''" (closed)="selectedLog = null">
      @if (selectedLog) {
        <div class="row"><span>Waktu</span><b>{{ selectedLog.timestamp }}</b></div>
        <div class="row"><span>Arah</span><span class="pill info">{{ selectedLog.direction }}</span></div>
        <div class="row"><span>Cabang</span><b>{{ selectedLog.outlet }}</b></div>
        <div class="row"><span>Entitas / Modul</span><b>{{ selectedLog.entityType }}</b></div>
        <div class="row"><span>Status</span><span class="pill ok">{{ selectedLog.status }}</span></div>
        <div style="margin-top:14px">
          <div class="hint-text" style="margin-bottom:6px">Ringkasan Payload</div>
          <div class="code-block">{{ selectedLog.summary }}</div>
        </div>
      }
    </app-slide-drawer>
  `
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly router = inject(Router);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'ringkasan-seluruh-outlet';
  actionItems: Array<{ label: string; count: number; route: string; severity: string }> = [];

  perfRange = 'today';
  perfRows: Array<{
    outletId: string;
    name: string;
    type: string;
    visits: number;
    revenueMillions: number;
    avgTicketRp: number;
    operationalRate: string;
    isOnline: boolean;
  }> = [];

  hubMasterVersion = 1;
  mysqlConnected = false;
  edgeNodes: Array<{ outletId: string; outletName: string; appVersion: string; masterVersionAck: number; lastHeartbeat: string; status: string }> = [];
  outletSearch = '';
  outletConnFilter = 'Semua';
  outletPage = 1;
  syncSearch = '';
  syncDirFilter = 'Semua';
  syncPage = 1;
  pageSize = 10;
  selectedLog: SyncLogEntry | null = null;

  get filteredOutlets(): OutletStatusItem[] {
    return filterRows(this.state.outlets(), this.outletSearch, [
      (o) => this.outletConnFilter === 'Semua' || o.connectionLabel === this.outletConnFilter
    ]);
  }

  get pagedOutlets(): OutletStatusItem[] {
    return paginateRows(this.filteredOutlets, this.outletPage, this.pageSize);
  }

  integrationHealth = { fhirSent: 0, fhirFailed: 0, bpjsOk: 0, bpjsPending: 0 };
  notifications: NotificationItem[] = [];
  notifFilter: 'all' | 'unread' | 'critical' = 'all';

  get revenueChartData(): BarChartDatum[] {
    return this.state.outlets().map((o) => ({
      label: o.name,
      value: Number(o.todayRevenueMillions || 0),
      displayValue: `Rp ${(o.todayRevenueMillions ?? 0).toFixed(1).replace('.', ',')} jt`,
      tone: o.isOnline ? 'acc' : 'warn'
    }));
  }

  get perfRevenueChart(): BarChartDatum[] {
    return this.perfRows.map((r) => ({
      label: r.name,
      value: r.revenueMillions,
      displayValue: `Rp ${r.revenueMillions.toFixed(1).replace('.', ',')} jt`,
      tone: 'acc'
    }));
  }

  get perfVisitChart(): BarChartDatum[] {
    return this.perfRows.map((r) => ({
      label: r.name,
      value: r.visits,
      displayValue: `${r.visits} trx`,
      tone: 'ok'
    }));
  }

  get filteredSyncLogs(): SyncLogEntry[] {
    return filterRows(this.state.syncLogs(), this.syncSearch, [
      (l) => this.syncDirFilter === 'Semua' || l.direction === this.syncDirFilter
    ]);
  }

  get pagedSyncLogs(): SyncLogEntry[] {
    return paginateRows(this.filteredSyncLogs, this.syncPage, this.pageSize);
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.isRead).length;
  }

  get filteredNotifications(): NotificationItem[] {
    return this.notifications.filter((n) => {
      if (this.notifFilter === 'unread') return !n.isRead;
      if (this.notifFilter === 'critical') return n.severity === 'critical';
      return true;
    });
  }

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'ringkasan-seluruh-outlet';
      this.loadForSub();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadForSub(): void {
    this.state.refreshDashboard();
    if (this.sub === 'ringkasan-seluruh-outlet') {
      this.http
        .get<{ actionItems: Array<{ label: string; count: number; route: string; severity: string }> }>(`${this.state.apiBase}/dashboard/summary`)
        .subscribe({
          next: (res) => (this.actionItems = res.actionItems || []),
          error: () => {}
        });
    } else if (this.sub === 'kinerja-per-outlet') {
      this.loadPerformance();
    } else if (this.sub === 'status-sinkronisasi') {
      this.http
        .get<{
          masterVersion: number;
          mysqlConnected: boolean;
          nodes: Array<{ outletId: string; outletName: string; appVersion: string; masterVersionAck: number; lastHeartbeat: string; status: string }>;
        }>(`${this.state.apiBase}/sync/hub-status`)
        .subscribe({
          next: (res) => {
            this.hubMasterVersion = res.masterVersion;
            this.mysqlConnected = res.mysqlConnected;
            this.edgeNodes = res.nodes || [];
          },
          error: () => {}
        });
    } else if (this.sub === 'status-integrasi') {
      this.http
        .get<{ fhirSummary: { sent: number; failed: number }; bpjsSummary: { success: number; pending: number } }>(
          `${this.state.apiBase}/integrations/health`
        )
        .subscribe({
          next: (res) => {
            this.integrationHealth = {
              fhirSent: res.fhirSummary?.sent || 0,
              fhirFailed: res.fhirSummary?.failed || 0,
              bpjsOk: res.bpjsSummary?.success || 0,
              bpjsPending: res.bpjsSummary?.pending || 0
            };
          },
          error: () => {}
        });
    } else if (this.sub === 'notifikasi') {
      this.http.get<NotificationItem[]>(`${this.state.apiBase}/notifications`).subscribe({
        next: (list) => (this.notifications = list || []),
        error: () => {}
      });
    }
  }

  loadPerformance(): void {
    this.http
      .get<{
        rows: Array<{
          outletId: string;
          name: string;
          type: string;
          visits: number;
          revenueMillions: number;
          avgTicketRp: number;
          operationalRate: string;
          isOnline: boolean;
        }>;
      }>(`${this.state.apiBase}/dashboard/performance?range=${this.perfRange}`)
      .subscribe({
        next: (res) => (this.perfRows = res.rows || []),
        error: () => {}
      });
  }

  toggleOutletOnline(o: OutletStatusItem): void {
    const targetOnline = o.connectionLabel !== 'Online';
    this.http
      .post(`${this.state.apiBase}/sync/status`, {
        outletId: o.outletId,
        outletName: o.name,
        isOnline: targetOnline,
        pendingCount: targetOnline ? 0 : 2
      })
      .subscribe({
        next: () => {
          this.state.refreshDashboard();
          this.state.showToast(`Status ${o.name} diubah ke ${targetOnline ? 'Online' : 'Offline'}`);
        }
      });
  }

  broadcastMaster(): void {
    this.http.post<{ masterVersion: number }>(`${this.state.apiBase}/sync/broadcast-master`, {}).subscribe({
      next: (res) => {
        this.hubMasterVersion = res.masterVersion;
        this.state.showToast(`Master data v${res.masterVersion} berhasil di-broadcast ke semua cabang`);
        this.loadForSub();
      }
    });
  }

  forceSyncNode(outletId: string): void {
    this.http.post(`${this.state.apiBase}/settings/edge-nodes/${outletId}/command`, { command: 'FORCE_SYNC' }).subscribe({
      next: () => {
        this.state.showToast('Perintah Force Sync dikirim ke server lokal cabang');
        this.loadForSub();
      }
    });
  }

  markRead(n: NotificationItem): void {
    this.http.put(`${this.state.apiBase}/notifications/${n.id}/read`, {}).subscribe({
      next: () => {
        n.isRead = true;
        this.state.refreshDashboard();
      }
    });
  }

  markAllRead(): void {
    this.http.post(`${this.state.apiBase}/notifications/read-all`, {}).subscribe({
      next: () => {
        this.notifications.forEach((n) => (n.isRead = true));
        this.state.refreshDashboard();
        this.state.showToast('Semua notifikasi ditandai sudah dibaca');
      }
    });
  }

  goNotification(n: NotificationItem): void {
    if (!n.isRead) this.markRead(n);
    this.router.navigateByUrl(n.targetRoute || '/dashboard/ringkasan-seluruh-outlet');
  }
}
