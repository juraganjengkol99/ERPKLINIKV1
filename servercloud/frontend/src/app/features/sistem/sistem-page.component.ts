import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { SlideDrawerComponent } from '../../shared/components/slide-drawer.component';
import { IdrPipe } from '../../shared/pipes/idr.pipe';
import { TariffFormComponent } from './forms/tariff-form.component';

interface TariffItem {
  id: string;
  code: string;
  name: string;
  category: string;
  basePriceRp: number;
  bpjsTariffRp: number;
  applicableTo: string;
  status: string;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorRole: string;
  module: string;
  action: string;
  summary: string;
  diff: unknown;
}

interface BackupSnapshot {
  id: string;
  createdAt: string;
  type: string;
  sizeKb: number;
  dbEngine: string;
  status: string;
}

interface EdgeNode {
  outletId: string;
  outletName: string;
  appVersion: string;
  dbEngine: string;
  masterVersionAck: number;
  cpuLoad: string;
  memoryUsage: string;
  diskFreeGb: number;
  lastHeartbeat: string;
  status: string;
}

@Component({
  selector: 'app-sistem-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SlideDrawerComponent, IdrPipe, TariffFormComponent],
  template: `
    @if (sub === 'master-umum-tarif') {
      <div class="tabs">
        <button class="tab" type="button" [class.on]="generalTab === 'tariffs'" (click)="generalTab = 'tariffs'">Master Tarif Layanan & Kamar</button>
        <button class="tab" type="button" [class.on]="generalTab === 'identity'" (click)="generalTab = 'identity'">Identitas Grup & Referensi Umum</button>
      </div>

      @if (generalTab === 'tariffs') {
        @if (showTariffDrawer) {
          <app-tariff-form [model]="tariffForm" (submitted)="saveTariff()" (cancelled)="showTariffDrawer = false" />
        }
        <div class="panel">
          <h2>
            Master Tarif Tindakan, Konsultasi & Kamar (Auto-Sync ke Cabang)
            <span class="sp"></span>
            <button class="btn btn-sm" type="button" (click)="showTariffDrawer = true">+ Tambah Tarif</button>
          </h2>
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Layanan / Tindakan</th>
                  <th>Kategori</th>
                  <th class="num">Tarif Umum</th>
                  <th class="num">Tarif BPJS</th>
                  <th>Berlaku di</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (t of tariffs; track t.id) {
                  <tr>
                    <td><code>{{ t.code }}</code></td>
                    <td><b>{{ t.name }}</b></td>
                    <td>{{ t.category }}</td>
                    <td class="num"><b>{{ t.basePriceRp | idr }}</b></td>
                    <td class="num">{{ t.bpjsTariffRp | idr }}</td>
                    <td>{{ t.applicableTo }}</td>
                    <td><span class="pill ok">{{ t.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <div class="panel">
          <h2>Identitas Grup & Pengaturan Dasar</h2>
          <div class="form">
            <label>Nama Grup Klinik <input [(ngModel)]="general.groupName" /></label>
            <label>NPWP Badan / Grup <input [(ngModel)]="general.npwpGroup" /></label>
            <label>Telepon Kantor Pusat <input [(ngModel)]="general.hqPhone" /></label>
            <label>Alamat Pusat <input [(ngModel)]="general.hqAddress" /></label>
          </div>
          <div class="row">
            <span class="hint-text">Poliklinik Standar: {{ general.polyclinics.join(', ') }}</span>
            <button class="btn" type="button" (click)="saveGeneralSettings()">Simpan Identitas Grup</button>
          </div>
        </div>
      }

    } @else if (sub === 'keamanan-2fa') {
      <div class="two">
        <div class="panel">
          <h2>Autentikasi Dua Faktor (2FA TOTP) — Akun Anda</h2>
          <div class="panel-body">
            <div class="row" style="padding-left:0;padding-right:0">
              <span>Status 2FA Akun ({{ state.currentUser()?.email }})</span>
              <span class="pill" [ngClass]="state.currentUser()?.twoFaEnabled ? 'ok' : 'warn'">
                {{ state.currentUser()?.twoFaEnabled ? 'Aktif' : 'Belum Aktif' }}
              </span>
            </div>

            @if (!state.currentUser()?.twoFaEnabled) {
              @if (!totpSetup) {
                <button class="btn" type="button" (click)="start2faSetup()">Aktifkan 2FA Sekarang</button>
              } @else {
                <div style="margin-top:12px">
                  <div class="hint-text">Masukkan Secret Key berikut ke Google Authenticator / Authy:</div>
                  <div class="code-block" style="margin:8px 0">Secret: {{ totpSetup.secret }}&#10;OTP Demo Saat Ini: {{ totpSetup.currentDemoCode }}</div>
                  <div style="display:flex;gap:8px;margin-top:10px">
                    <input class="input" [(ngModel)]="totpVerifyCode" placeholder="Kode OTP 6 digit" maxlength="6" />
                    <button class="btn" type="button" (click)="verify2faSetup()">Verifikasi & Aktifkan</button>
                  </div>
                </div>
              }
            } @else {
              <button class="ib danger" type="button" (click)="disable2fa()">Nonaktifkan 2FA</button>
            }
          </div>
        </div>

        <div class="panel">
          <h2>Kebijakan Keamanan Cloud VPS</h2>
          <div class="form">
            <label>
              Wajibkan 2FA untuk Role Admin/Keuangan
              <select [(ngModel)]="securityPolicy.enforceTwoFaForAdmins">
                <option [ngValue]="false">Opsional</option>
                <option [ngValue]="true">Wajib (Enforced)</option>
              </select>
            </label>
            <label>
              Timeout Sesi (Menit)
              <input type="number" [(ngModel)]="securityPolicy.sessionTimeoutMinutes" />
            </label>
            <label>
              IP Allowlist Mode
              <select [(ngModel)]="securityPolicy.ipAllowlistEnabled">
                <option [ngValue]="false">Nonaktif (Semua IP)</option>
                <option [ngValue]="true">Aktif (Whitelist)</option>
              </select>
            </label>
            <label>
              Daftar IP Diizinkan
              <input [(ngModel)]="securityPolicy.allowedIps" />
            </label>
          </div>
          <div class="row">
            <span class="hint-text">Perubahan kebijakan langsung tercatat di Audit Trail.</span>
            <button class="btn" type="button" (click)="saveSecurityPolicy()">Simpan Kebijakan</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <h2>Sesi Login Aktif</h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Role</th>
                <th>Perangkat</th>
                <th>IP</th>
                <th>Waktu Login</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (s of activeSessions; track s.sessionId) {
                <tr>
                  <td><b>{{ s.userName }}</b> ({{ s.userEmail }})</td>
                  <td><span class="pill info">{{ s.role }}</span></td>
                  <td>{{ s.device }}</td>
                  <td><code>{{ s.ip }}</code></td>
                  <td>{{ s.loginAt }}</td>
                  <td><button class="ib btn-sm danger" type="button" (click)="revokeSession(s.sessionId)">Cabut Sesi</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'audit-trail') {
      <div class="panel">
        <h2>
          Audit Trail Sistem (Immutable Log)
          <span class="sp"></span>
          <select class="select" [(ngModel)]="auditModuleFilter" (ngModelChange)="loadAuditTrail()">
            <option value="Semua">Semua Modul</option>
            <option value="Auth">Auth</option>
            <option value="Manajemen Outlet">Manajemen Outlet</option>
            <option value="HR">HR</option>
            <option value="Keuangan">Keuangan</option>
            <option value="Akunting">Akunting</option>
            <option value="Purchasing">Purchasing</option>
            <option value="Inventory">Inventory</option>
            <option value="Integrasi">Integrasi</option>
            <option value="Pengaturan Sistem">Pengaturan Sistem</option>
          </select>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktor</th>
                <th>Role</th>
                <th>Modul</th>
                <th>Aksi</th>
                <th>Ringkasan</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              @for (a of auditTrails; track a.id) {
                <tr>
                  <td>{{ a.timestamp }}</td>
                  <td>{{ a.actorEmail }}</td>
                  <td><span class="pill info">{{ a.actorRole }}</span></td>
                  <td>{{ a.module }}</td>
                  <td><code>{{ a.action }}</code></td>
                  <td class="wrap-cell">{{ a.summary }}</td>
                  <td><button class="ib btn-sm" type="button" (click)="selectedAudit = a">Inspeksi</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'backup-restore') {
      <div class="panel">
        <h2>
          Backup & Restore Database Cloud VPS
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="createBackup()">+ Buat Backup Cloud Sekarang</button>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>ID Snapshot</th>
                <th>Waktu Dibuat</th>
                <th>Tipe</th>
                <th>Engine</th>
                <th class="num">Ukuran</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (b of backups; track b.id) {
                <tr>
                  <td><code>{{ b.id }}</code></td>
                  <td>{{ b.createdAt }}</td>
                  <td>{{ b.type }}</td>
                  <td>{{ b.dbEngine }}</td>
                  <td class="num">{{ b.sizeKb }} KB</td>
                  <td><span class="pill ok">{{ b.status }}</span></td>
                  <td>
                    <button class="ib btn-sm" type="button" (click)="downloadBackup(b.id)">Unduh JSON</button>
                    <button class="ib btn-sm danger" type="button" (click)="confirmRestore(b)">Restore</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'manajemen-server-lokal') {
      <div class="panel">
        <h2>Manajemen Fleet Server Lokal Cabang (Edge Nodes)</h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Cabang</th>
                <th>Versi App</th>
                <th>Database Engine</th>
                <th>Master Ack</th>
                <th>CPU / RAM</th>
                <th>Disk Kosong</th>
                <th>Heartbeat Terakhir</th>
                <th>Status</th>
                <th>Perintah Remote</th>
              </tr>
            </thead>
            <tbody>
              @for (n of edgeNodes; track n.outletId) {
                <tr>
                  <td><b>{{ n.outletName }}</b></td>
                  <td><code>{{ n.appVersion }}</code></td>
                  <td>{{ n.dbEngine }}</td>
                  <td>v{{ n.masterVersionAck }}</td>
                  <td>{{ n.cpuLoad }} / {{ n.memoryUsage }}</td>
                  <td>{{ n.diskFreeGb }} GB</td>
                  <td>{{ n.lastHeartbeat }}</td>
                  <td><span class="pill" [ngClass]="n.status === 'Online' ? 'ok' : 'bad'">{{ n.status }}</span></td>
                  <td>
                    <button class="ib btn-sm" type="button" (click)="sendNodeCommand(n, 'FORCE_SYNC')">Sync</button>
                    <button class="ib btn-sm" type="button" (click)="sendNodeCommand(n, 'PULL_CONFIG')">Push Config</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <app-slide-drawer [open]="!!selectedAudit" title="Detail Audit Trail" [subtitle]="selectedAudit?.id || ''" (closed)="selectedAudit = null">
      @if (selectedAudit; as a) {
        <div class="row"><span>Waktu</span><b>{{ a.timestamp }}</b></div>
        <div class="row"><span>Aktor</span><b>{{ a.actorEmail }} ({{ a.actorRole }})</b></div>
        <div class="row"><span>Modul & Aksi</span><code>{{ a.module }} · {{ a.action }}</code></div>
        <div style="margin-top:12px">
          <div class="hint-text" style="margin-bottom:4px">Ringkasan Aktivitas</div>
          <div class="code-block">{{ a.summary }}</div>
        </div>
        @if (a.diff) {
          <div style="margin-top:12px">
            <div class="hint-text" style="margin-bottom:4px">Perubahan Data (JSON Diff)</div>
            <div class="code-block">{{ a.diff | json }}</div>
          </div>
        }
      }
    </app-slide-drawer>
  `
})
export class SistemPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'master-umum-tarif';
  generalTab: 'tariffs' | 'identity' = 'tariffs';
  general = { groupName: '', npwpGroup: '', hqAddress: '', hqPhone: '', polyclinics: [] as string[] };
  tariffs: TariffItem[] = [];
  showTariffDrawer = false;
  tariffForm = { code: '', name: '', category: 'Tindakan', basePriceRp: 120000, bpjsTariffRp: 85000, applicableTo: 'Semua Klinik' };

  totpSetup: { secret: string; otpauthUri: string; currentDemoCode: string } | null = null;
  totpVerifyCode = '';
  securityPolicy = { enforceTwoFaForAdmins: false, minPasswordLength: 6, sessionTimeoutMinutes: 480, ipAllowlistEnabled: false, allowedIps: '' };
  activeSessions: Array<{ sessionId: string; userEmail: string; userName: string; role: string; device: string; ip: string; loginAt: string }> = [];

  auditModuleFilter = 'Semua';
  auditTrails: AuditEntry[] = [];
  selectedAudit: AuditEntry | null = null;

  backups: BackupSnapshot[] = [];
  edgeNodes: EdgeNode[] = [];

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'master-umum-tarif';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    if (this.sub === 'master-umum-tarif') {
      this.http
        .get<{ general: { groupName: string; npwpGroup: string; hqAddress: string; hqPhone: string; polyclinics: string[] }; tariffs: TariffItem[] }>(
          `${this.state.apiBase}/settings/general`
        )
        .subscribe({
          next: (res) => {
            this.general = res.general;
            this.tariffs = res.tariffs || [];
          }
        });
    } else if (this.sub === 'keamanan-2fa') {
      this.http
        .get<{
          policy: { enforceTwoFaForAdmins: boolean; minPasswordLength: number; sessionTimeoutMinutes: number; ipAllowlistEnabled: boolean; allowedIps: string };
          sessions: Array<{ sessionId: string; userEmail: string; userName: string; role: string; device: string; ip: string; loginAt: string }>;
        }>(`${this.state.apiBase}/settings/security`)
        .subscribe({
          next: (res) => {
            this.securityPolicy = res.policy;
            this.activeSessions = res.sessions || [];
          }
        });
    } else if (this.sub === 'audit-trail') {
      this.loadAuditTrail();
    } else if (this.sub === 'backup-restore') {
      this.http.get<{ snapshots: BackupSnapshot[] }>(`${this.state.apiBase}/settings/backups`).subscribe({
        next: (res) => (this.backups = res.snapshots || [])
      });
    } else if (this.sub === 'manajemen-server-lokal') {
      this.http.get<EdgeNode[]>(`${this.state.apiBase}/settings/edge-nodes`).subscribe({
        next: (list) => (this.edgeNodes = list || [])
      });
    }
  }

  saveGeneralSettings(): void {
    this.http.put(`${this.state.apiBase}/settings/general`, this.general).subscribe({
      next: () => this.state.showToast('Identitas grup berhasil disimpan')
    });
  }

  saveTariff(): void {
    this.http.post<TariffItem>(`${this.state.apiBase}/settings/tariffs`, this.tariffForm).subscribe({
      next: (created) => {
        this.tariffs = [created, ...this.tariffs];
        this.showTariffDrawer = false;
        this.tariffForm = { code: '', name: '', category: 'Tindakan', basePriceRp: 120000, bpjsTariffRp: 85000, applicableTo: 'Semua Klinik' };
        this.state.showToast(`Tarif ${created.name} ditambahkan & dijadwalkan sync ke cabang`);
      }
    });
  }

  start2faSetup(): void {
    this.http.post<{ secret: string; otpauthUri: string; currentDemoCode: string }>(`${this.state.apiBase}/auth/2fa/setup`, {}).subscribe({
      next: (res) => (this.totpSetup = res)
    });
  }

  verify2faSetup(): void {
    this.http.post(`${this.state.apiBase}/auth/2fa/verify`, { code: this.totpVerifyCode }).subscribe({
      next: () => {
        const cur = this.state.currentUser();
        if (cur) this.state.currentUser.set({ ...cur, twoFaEnabled: true });
        this.totpSetup = null;
        this.totpVerifyCode = '';
        this.state.showToast('2FA TOTP berhasil diaktifkan');
      },
      error: (err) => this.state.showToast(err?.error?.message || 'Kode OTP tidak valid')
    });
  }

  disable2fa(): void {
    this.http.post(`${this.state.apiBase}/auth/2fa/disable`, {}).subscribe({
      next: () => {
        const cur = this.state.currentUser();
        if (cur) this.state.currentUser.set({ ...cur, twoFaEnabled: false });
        this.state.showToast('2FA TOTP dinonaktifkan');
      }
    });
  }

  saveSecurityPolicy(): void {
    this.http.put(`${this.state.apiBase}/settings/security`, this.securityPolicy).subscribe({
      next: () => this.state.showToast('Kebijakan keamanan berhasil disimpan')
    });
  }

  revokeSession(sessionId: string): void {
    this.http.delete(`${this.state.apiBase}/auth/sessions/${sessionId}`).subscribe({
      next: () => {
        this.activeSessions = this.activeSessions.filter((s) => s.sessionId !== sessionId);
        this.state.showToast('Sesi login dicabut');
      }
    });
  }

  loadAuditTrail(): void {
    this.http.get<AuditEntry[]>(`${this.state.apiBase}/settings/audit-trail?module=${encodeURIComponent(this.auditModuleFilter)}`).subscribe({
      next: (list) => (this.auditTrails = list || [])
    });
  }

  createBackup(): void {
    this.http.post<BackupSnapshot>(`${this.state.apiBase}/settings/backups`, {}).subscribe({
      next: (snap) => {
        this.backups = [snap, ...this.backups];
        this.state.showToast(`Snapshot backup ${snap.id} berhasil dibuat`);
      }
    });
  }

  downloadBackup(id: string): void {
    this.http.get(`${this.state.apiBase}/settings/backups/${id}/download`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  confirmRestore(b: BackupSnapshot): void {
    this.state.askConfirm({
      title: 'Konfirmasi Pemulihan Snapshot',
      message: `Verifikasi dan pulihkan snapshot "${b.id}" (${b.createdAt})?`,
      confirmLabel: 'Ya, Pulihkan',
      danger: true,
      onConfirm: () => {
        this.http.post<{ message: string }>(`${this.state.apiBase}/settings/backups/${b.id}/restore`, {}).subscribe({
          next: (res) => this.state.showToast(res.message)
        });
      }
    });
  }

  sendNodeCommand(n: EdgeNode, cmd: string): void {
    this.http.post(`${this.state.apiBase}/settings/edge-nodes/${n.outletId}/command`, { command: cmd }).subscribe({
      next: () => {
        this.state.showToast(`Perintah ${cmd} dikirim ke ${n.outletName}`);
        this.loadAll();
      }
    });
  }
}
