import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { OutletStatusItem } from '../../core/models/erp.models';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { SlideDrawerComponent } from '../../shared/components/slide-drawer.component';
import { TablePagerComponent } from '../../shared/components/table-pager.component';
import { OutletFormComponent } from './forms/outlet-form.component';

interface OutletTemplate {
  outletType: string;
  description: string;
  modules: Array<{ code: string; name: string; enabled: boolean; items: string[] }>;
}

interface LicenseItem {
  licenseId: string;
  outletId: string;
  outletName: string;
  activationCode: string;
  tier: string;
  maxUsers: number;
  validUntil: string;
  deviceFingerprint: string;
  status: string;
}

@Component({
  selector: 'app-outlets-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SlideDrawerComponent, TablePagerComponent, OutletFormComponent],
  template: `
    @if (sub === 'daftar-outlet') {
      <div class="panel">
        <h2>
          Daftar Outlet Aktif
          <span class="sp"></span>
          <input class="input" [(ngModel)]="search" (ngModelChange)="page = 1" placeholder="Cari nama / alamat / kode..." />
          <select class="select" [(ngModel)]="typeFilter" (ngModelChange)="page = 1">
            <option value="Semua">Semua Tipe</option>
            <option value="Klinik Utama (Rawat Inap & Jalan)">Klinik Utama (Rawat Inap &amp; Jalan)</option>
            <option value="Klinik Utama (Rawat Jalan)">Klinik Utama (Rawat Jalan)</option>
            <option value="Klinik Pratama (Rawat Inap & Jalan)">Klinik Pratama (Rawat Inap &amp; Jalan)</option>
            <option value="Klinik Pratama (Rawat Jalan)">Klinik Pratama (Rawat Jalan)</option>
            <option value="Apotek">Apotek</option>
          </select>
          <button class="btn" type="button" (click)="goNewOutlet()">+ Tambah Outlet Baru</button>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Nama Outlet</th>
                <th>Tipe</th>
                <th>Kode Aktivasi</th>
                <th>NIB</th>
                <th>Alamat</th>
                <th>Koneksi</th>
                <th>SATUSEHAT</th>
                <th>BPJS</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (o of pagedOutlets; track o.outletId) {
                <tr>
                  <td><b>{{ o.name }}</b></td>
                  <td>
                    @if (!o.type.includes('Apotek')) {
                      <select
                        class="select"
                        style="min-width:210px;padding:4px 8px;font-size:12px"
                        [ngModel]="resolveOutletType(o)"
                        (ngModelChange)="changeOutletServiceType(o, $event)"
                        aria-label="Tipe layanan klinik"
                      >
                        @if (o.type.includes('Pratama')) {
                          <option value="Klinik Pratama (Rawat Inap & Jalan)">Klinik Pratama (Rawat Inap &amp; Jalan)</option>
                          <option value="Klinik Pratama (Rawat Jalan)">Klinik Pratama (Rawat Jalan)</option>
                        } @else {
                          <option value="Klinik Utama (Rawat Inap & Jalan)">Klinik Utama (Rawat Inap &amp; Jalan)</option>
                          <option value="Klinik Utama (Rawat Jalan)">Klinik Utama (Rawat Jalan)</option>
                        }
                      </select>
                    } @else {
                      <span>{{ o.type }}</span>
                    }
                  </td>
                  <td>
                    <code>{{ o.activationCode }}</code>
                    <button class="ib btn-sm" type="button" (click)="copyCode(o.activationCode || '')">Salin</button>
                  </td>
                  <td>{{ o.nib || '-' }}</td>
                  <td class="wrap-cell">{{ o.address || '-' }}</td>
                  <td><span class="pill" [ngClass]="o.connectionStatus">{{ o.connectionLabel }}</span></td>
                  <td><span class="pill" [ngClass]="o.satuSehatStatus">{{ o.satuSehatLabel }}</span></td>
                  <td><span class="pill" [ngClass]="o.bpjsStatus">{{ o.bpjsLabel }}</span></td>
                  <td>
                    <button class="ib btn-sm" type="button" (click)="detailOutlet = o">Detail</button>
                    <button class="ib btn-sm" type="button" (click)="startEditOutlet(o)">Edit</button>
                    <button class="ib btn-sm danger" type="button" (click)="confirmArchive(o)">Arsipkan</button>
                  </td>
                </tr>
              }
              @if (pagedOutlets.length === 0) {
                <tr><td colspan="9" class="empty">Tidak ada outlet yang sesuai pencarian.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-table-pager [total]="filteredOutlets.length" [(page)]="page" [(pageSize)]="pageSize" />
      </div>

    } @else if (sub === 'tambah-outlet-baru') {
      @if (createdModal) {
        <div class="panel inline-form-panel">
          <h2>Outlet Berhasil Dibuat <span class="sp"></span><button class="ib btn-sm" type="button" (click)="createdModal = null">Tutup</button></h2>
          <div style="padding:14px 18px">
            <p style="margin-top:0">Gunakan kode aktivasi berikut saat pairing aplikasi <b>Server Lokal Cabang</b>:</p>
            <div class="code-block" style="font-size:18px;text-align:center;font-weight:700">{{ createdModal.activationCode }}</div>
          </div>
          <div class="inline-form-actions">
            <button class="ib" type="button" (click)="copyCode(createdModal.activationCode)">Salin Kode</button>
            <button class="btn" type="button" (click)="createdModal = null; router.navigate(['/manajemen-outlet/daftar-outlet'])">Lihat Daftar Outlet</button>
          </div>
        </div>
      }
      <app-outlet-form
        [form]="form"
        [editingOutletId]="editingOutletId"
        [hasExistingSsSecret]="hasExistingSsSecret"
        [maskedSsSecret]="maskedSsSecret"
        [hasExistingBpjsSecret]="hasExistingBpjsSecret"
        [maskedBpjsSecret]="maskedBpjsSecret"
        [hasExistingBpjsUserKey]="hasExistingBpjsUserKey"
        [maskedBpjsUserKey]="maskedBpjsUserKey"
        [ssTestBanner]="ssTestBanner"
        [bpjsTestBanner]="bpjsTestBanner"
        (typeChanged)="onTypeChange($event)"
        (testBridging)="testBridging($event)"
        (resetClicked)="resetForm()"
        (backClicked)="router.navigate(['/manajemen-outlet/daftar-outlet'])"
        (saveClicked)="saveOutlet()"
      />

    } @else if (sub === 'template-modul-per-tipe') {
      <div class="tabs">
        @for (tpl of templates; track tpl.outletType) {
          <button class="tab" type="button" [class.on]="selectedTemplateType === tpl.outletType" (click)="selectedTemplateType = tpl.outletType">
            {{ tpl.outletType }}
          </button>
        }
      </div>

      @if (activeTemplate; as tpl) {
        <div class="panel">
          <h2>
            Blueprint Modul Lokal: {{ tpl.outletType }}
            <span class="sp"></span>
            <button class="btn btn-sm" type="button" (click)="saveTemplate(tpl)">Simpan & Broadcast ke Cabang</button>
          </h2>
          <div class="panel-body">
            <p class="hint-text" style="margin-top:0">{{ tpl.description }}</p>
            <div class="tw">
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Grup Menu Lokal</th>
                    <th>Daftar Sub-Menu</th>
                    <th>Status di Template</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of tpl.modules; track m.code) {
                    <tr>
                      <td><code>{{ m.code }}</code></td>
                      <td><b>{{ m.name }}</b></td>
                      <td class="wrap-cell">{{ m.items.join(', ') }}</td>
                      <td>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                          <input type="checkbox" [(ngModel)]="m.enabled" style="width:auto" />
                          <span class="pill" [ngClass]="m.enabled ? 'ok' : 'warn'">{{ m.enabled ? 'Aktif' : 'Nonaktif' }}</span>
                        </label>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

    } @else if (sub === 'pengaturan-cabang') {
      <div class="panel">
        <h2>
          Pengaturan Operasional Cabang
          <span class="sp"></span>
          <select class="select" [(ngModel)]="selectedSettingOutletId" (ngModelChange)="loadOutletSettings($event)">
            @for (o of activeOutlets; track o.outletId) {
              <option [value]="o.outletId">{{ o.name }} ({{ o.type }})</option>
            }
          </select>
        </h2>
        <div class="form">
          <label>
            Jam Operasional Cabang
            <input [(ngModel)]="branchSettings.operatingHours" />
          </label>
          <label>
            Interval Sinkronisasi (Detik)
            <input type="number" [(ngModel)]="branchSettings.syncIntervalSec" />
          </label>
          <label>
            URL Server Lokal Cabang
            <input [(ngModel)]="branchSettings.localServerUrl" />
          </label>
          <label>
            Kode Prefix Jurnal COA Cabang
            <input [(ngModel)]="branchSettings.coaPrefix" />
          </label>
          <label>
            Auto-Sync Latar Belakang
            <select [(ngModel)]="branchSettings.autoSync">
              <option [ngValue]="true">Aktif (Otomatis)</option>
              <option [ngValue]="false">Manual</option>
            </select>
          </label>
          <label>
            Footer Struk Kasir
            <input [(ngModel)]="branchSettings.receiptFooter" />
          </label>
        </div>
        <div class="row">
          <span class="hint-text">Poli / Layanan Aktif: <b>{{ branchSettings.activePolisText }}</b></span>
          <button class="btn" type="button" (click)="saveOutletSettings()">Simpan Pengaturan Cabang</button>
        </div>
      </div>

    } @else if (sub === 'lisensi-aktivasi') {
      <div class="stats">
        <div class="stat"><span>Total Lisensi Terdaftar</span><b>{{ licenses.length }}</b></div>
        <div class="stat"><span>Lisensi Aktif</span><b>{{ countLicense('Aktif') }}</b></div>
        <div class="stat"><span>Menunggu Aktivasi</span><b>{{ countLicense('Menunggu Aktivasi') }}</b></div>
        <div class="stat"><span>Suspended / Expired</span><b>{{ countLicense('Suspended') }}</b></div>
      </div>

      <div class="panel">
        <h2>Manajemen Lisensi & Aktivasi Server Lokal</h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>ID Lisensi</th>
                <th>Outlet</th>
                <th>Kode Aktivasi</th>
                <th>Paket / Tier</th>
                <th class="num">Maks User</th>
                <th>Berlaku Hingga</th>
                <th>Hardware Fingerprint</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (l of licenses; track l.licenseId) {
                <tr>
                  <td><code>{{ l.licenseId }}</code></td>
                  <td><b>{{ l.outletName }}</b></td>
                  <td><code>{{ l.activationCode }}</code></td>
                  <td>{{ l.tier }}</td>
                  <td class="num">{{ l.maxUsers }}</td>
                  <td>{{ l.validUntil }}</td>
                  <td><code>{{ l.deviceFingerprint }}</code></td>
                  <td>
                    <span class="pill" [ngClass]="l.status === 'Aktif' ? 'ok' : l.status === 'Suspended' ? 'bad' : 'warn'">
                      {{ l.status }}
                    </span>
                  </td>
                  <td>
                    <button class="ib btn-sm" type="button" (click)="regenerateLicense(l)">Regenerate</button>
                    <button class="ib btn-sm" type="button" (click)="toggleSuspendLicense(l)">
                      {{ l.status === 'Suspended' ? 'Aktifkan' : 'Suspend' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'arsip-outlet') {
      <div class="panel">
        <h2>Arsip Outlet (Soft-Deleted · Data Historis Tetap Terjaga)</h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Nama Outlet</th>
                <th>Tipe</th>
                <th>Kode Aktivasi</th>
                <th>Tanggal Arsip</th>
                <th>Alasan Arsip</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (o of archivedOutlets; track o.outletId) {
                <tr>
                  <td><b>{{ o.name }}</b></td>
                  <td>{{ o.type }}</td>
                  <td><code>{{ o.activationCode }}</code></td>
                  <td>{{ o.archivedAt || '-' }}</td>
                  <td class="wrap-cell">{{ o.archiveReason || '-' }}</td>
                  <td>
                    <button class="btn btn-sm" type="button" (click)="restoreOutlet(o)">Pulihkan Outlet</button>
                  </td>
                </tr>
              }
              @if (archivedOutlets.length === 0) {
                <tr><td colspan="6" class="empty">Belum ada outlet yang diarsipkan.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <app-slide-drawer [open]="!!detailOutlet" [title]="detailOutlet?.name || ''" [subtitle]="detailOutlet?.type || ''" (closed)="detailOutlet = null">
      @if (detailOutlet; as o) {
        <div class="row"><span>Outlet ID</span><code>{{ o.outletId }}</code></div>
        <div class="row"><span>Kode Aktivasi</span><code>{{ o.activationCode }}</code></div>
        <div class="row"><span>NIB</span><span>{{ o.nib || '-' }}</span></div>
        <div class="row"><span>Alamat</span><span>{{ o.address || '-' }}</span></div>
        <div class="row"><span>Admin Email</span><span>{{ o.adminEmail || '-' }}</span></div>
        <div class="row"><span>SATUSEHAT</span><span class="pill" [ngClass]="o.satuSehatStatus">{{ o.satuSehatEnv }} · {{ o.satuSehatOrgId || 'Belum Diisi' }}</span></div>
        <div class="row"><span>BPJS Kesehatan</span><span class="pill" [ngClass]="o.bpjsStatus">{{ o.bpjsServiceType }} · PPK {{ o.bpjsPpkCode || '-' }}</span></div>
        <div style="margin-top:16px;display:flex;gap:8px">
          <button class="btn" type="button" (click)="startEditOutlet(o); detailOutlet = null">Edit Konfigurasi</button>
        </div>
      }
    </app-slide-drawer>
  `
})
export class OutletsPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly router = inject(Router);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'daftar-outlet';
  allOutlets: OutletStatusItem[] = [];
  search = '';
  typeFilter = 'Semua';
  page = 1;
  pageSize = 6;
  detailOutlet: OutletStatusItem | null = null;
  createdModal: { activationCode: string } | null = null;

  editingOutletId: string | null = null;
  hasExistingSsSecret = false;
  maskedSsSecret = '';
  editSsSecret = false;
  showSsSecret = false;

  hasExistingBpjsSecret = false;
  maskedBpjsSecret = '';
  editBpjsSecret = false;
  showBpjsSecret = false;

  hasExistingBpjsUserKey = false;
  maskedBpjsUserKey = '';
  editBpjsUserKey = false;
  showBpjsUserKey = false;

  ssTestBanner: { ok: boolean; text: string } | null = null;
  bpjsTestBanner: { ok: boolean; text: string } | null = null;

  form = {
    type: 'Klinik Utama (Rawat Inap & Jalan)',
    name: '',
    nib: '',
    address: '',
    phone: '',
    adminEmail: '',
    satuSehatEnv: 'Sandbox',
    satuSehatOrgId: '',
    satuSehatLocId: '',
    satuSehatClientId: '',
    satuSehatClientSecret: '',
    bpjsServiceType: 'VClaim (FKRTL / Rawat Inap & Jalan)',
    bpjsEnv: 'Development',
    bpjsPpkCode: '',
    bpjsConsId: '',
    bpjsSecretKey: '',
    bpjsUserKey: ''
  };

  templates: OutletTemplate[] = [];
  selectedTemplateType = 'Klinik Utama (Rawat Inap & Jalan)';

  selectedSettingOutletId = 'klinikutama';
  branchSettings = {
    operatingHours: '08:00 - 20:00',
    syncIntervalSec: 15,
    autoSync: true,
    localServerUrl: 'http://localhost:5181',
    coaPrefix: '101',
    receiptFooter: '',
    activePolisText: 'Poli Umum'
  };

  licenses: LicenseItem[] = [];

  get activeOutlets(): OutletStatusItem[] {
    return this.allOutlets.filter((o) => (o.status || 'Aktif') === 'Aktif');
  }

  get archivedOutlets(): OutletStatusItem[] {
    return this.allOutlets.filter((o) => o.status === 'Arsip');
  }

  get filteredOutlets(): OutletStatusItem[] {
    const q = this.search.trim().toLowerCase();
    return this.activeOutlets.filter((o) => {
      const okType = this.typeFilter === 'Semua' || o.type === this.typeFilter;
      const okQ =
        !q ||
        o.name.toLowerCase().includes(q) ||
        (o.address || '').toLowerCase().includes(q) ||
        (o.activationCode || '').toLowerCase().includes(q);
      return okType && okQ;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredOutlets.length / this.pageSize));
  }

  get pagedOutlets(): OutletStatusItem[] {
    const safe = Math.min(this.page, this.totalPages);
    const start = (safe - 1) * this.pageSize;
    return this.filteredOutlets.slice(start, start + this.pageSize);
  }

  get activeTemplate(): OutletTemplate | undefined {
    return this.templates.find((t) => t.outletType === this.selectedTemplateType);
  }

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'daftar-outlet';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    this.http.get<OutletStatusItem[]>(`${this.state.apiBase}/outlets?status=Semua`).subscribe({
      next: (list) => {
        this.allOutlets = list || [];
        if (this.activeOutlets.length > 0 && !this.activeOutlets.some((o) => o.outletId === this.selectedSettingOutletId)) {
          this.selectedSettingOutletId = this.activeOutlets[0].outletId;
        }
        if (this.sub === 'pengaturan-cabang') {
          this.loadOutletSettings(this.selectedSettingOutletId);
        }
      },
      error: () => {}
    });

    if (this.sub === 'template-modul-per-tipe') {
      this.http.get<OutletTemplate[]>(`${this.state.apiBase}/outlet-templates`).subscribe({
        next: (list) => (this.templates = list || [])
      });
    } else if (this.sub === 'lisensi-aktivasi') {
      this.http.get<LicenseItem[]>(`${this.state.apiBase}/licenses`).subscribe({
        next: (list) => (this.licenses = list || [])
      });
    }

    const pendingEdit = this.state.editingOutlet();
    if (this.sub === 'tambah-outlet-baru' && pendingEdit) {
      this.populateFormForEdit(pendingEdit);
      this.state.editingOutlet.set(null);
    }
  }

  goNewOutlet(): void {
    this.resetForm();
    this.router.navigate(['/manajemen-outlet/tambah-outlet-baru']);
  }

  startEditOutlet(o: OutletStatusItem): void {
    this.populateFormForEdit(o);
    this.router.navigate(['/manajemen-outlet/tambah-outlet-baru']);
  }

  private populateFormForEdit(o: OutletStatusItem): void {
    this.editingOutletId = o.outletId;
    this.hasExistingSsSecret = Boolean(o.hasSatuSehatSecret);
    this.maskedSsSecret = o.satuSehatClientSecretMasked || '';
    this.editSsSecret = false;

    this.hasExistingBpjsSecret = Boolean(o.hasBpjsSecret);
    this.maskedBpjsSecret = o.bpjsSecretKeyMasked || '';
    this.editBpjsSecret = false;

    this.hasExistingBpjsUserKey = Boolean(o.hasBpjsUserKey);
    this.maskedBpjsUserKey = o.bpjsUserKeyMasked || '';
    this.editBpjsUserKey = false;

    this.form = {
      type: o.type,
      name: o.name,
      nib: o.nib || '',
      address: o.address || '',
      phone: o.phone || '',
      adminEmail: o.adminEmail || '',
      satuSehatEnv: o.satuSehatEnv || 'Sandbox',
      satuSehatOrgId: o.satuSehatOrgId || '',
      satuSehatLocId: o.satuSehatLocId || '',
      satuSehatClientId: o.satuSehatClientId || '',
      satuSehatClientSecret: '',
      bpjsServiceType: o.bpjsServiceType || 'VClaim (FKRTL / Rawat Inap & Jalan)',
      bpjsEnv: o.bpjsEnv || 'Development',
      bpjsPpkCode: o.bpjsPpkCode || '',
      bpjsConsId: o.bpjsConsId || '',
      bpjsSecretKey: '',
      bpjsUserKey: ''
    };
  }

  resetForm(): void {
    this.editingOutletId = null;
    this.hasExistingSsSecret = false;
    this.hasExistingBpjsSecret = false;
    this.hasExistingBpjsUserKey = false;
    this.ssTestBanner = null;
    this.bpjsTestBanner = null;
    this.form = {
      type: 'Klinik Utama (Rawat Inap & Jalan)',
      name: '',
      nib: '',
      address: '',
      phone: '',
      adminEmail: '',
      satuSehatEnv: 'Sandbox',
      satuSehatOrgId: '',
      satuSehatLocId: '',
      satuSehatClientId: '',
      satuSehatClientSecret: '',
      bpjsServiceType: 'VClaim (FKRTL / Rawat Inap & Jalan)',
      bpjsEnv: 'Development',
      bpjsPpkCode: '',
      bpjsConsId: '',
      bpjsSecretKey: '',
      bpjsUserKey: ''
    };
  }

  onTypeChange(type: string): void {
    this.form.type = type;
    this.form.bpjsServiceType = type.includes('Apotek')
      ? 'Apotek Online / PRB'
      : type.includes('Pratama')
      ? 'P-Care (FKTP)'
      : 'VClaim (FKRTL / Rawat Inap & Jalan)';
  }

  testBridging(target: 'SATUSEHAT' | 'BPJS'): void {
    this.http
      .post<{ ok: boolean; message: string }>(`${this.state.apiBase}/outlets/test-bridging`, { target, ...this.form })
      .subscribe({
        next: (res) => {
          if (target === 'SATUSEHAT') this.ssTestBanner = { ok: true, text: res.message };
          else this.bpjsTestBanner = { ok: true, text: res.message };
        },
        error: (err) => {
          const msg = err?.error?.message || `Gagal tes ${target}`;
          if (target === 'SATUSEHAT') this.ssTestBanner = { ok: false, text: msg };
          else this.bpjsTestBanner = { ok: false, text: msg };
        }
      });
  }

  saveOutlet(): void {
    if (!this.form.name.trim()) {
      this.state.showToast('Nama outlet wajib diisi');
      return;
    }
    if (this.editingOutletId) {
      this.http.put<OutletStatusItem>(`${this.state.apiBase}/outlets/${this.editingOutletId}`, this.form).subscribe({
        next: (updated) => {
          this.state.showToast(`Outlet ${updated.name} berhasil diperbarui`);
          this.state.refreshDashboard();
          this.resetForm();
          this.router.navigate(['/manajemen-outlet/daftar-outlet']);
        }
      });
      return;
    }
    this.http.post<{ outlet: OutletStatusItem; activationCode: string }>(`${this.state.apiBase}/outlets`, this.form).subscribe({
      next: (res) => {
        this.state.refreshDashboard();
        this.resetForm();
        this.createdModal = { activationCode: res.activationCode };
      }
    });
  }

  confirmArchive(o: OutletStatusItem): void {
    this.state.askConfirm({
      title: 'Arsipkan Outlet',
      message: `Outlet "${o.name}" akan dipindahkan ke Arsip Outlet. Histori transaksi dan jurnal tetap aman tersimpan.`,
      confirmLabel: 'Ya, Arsipkan',
      danger: true,
      onConfirm: () => {
        this.http.post(`${this.state.apiBase}/outlets/${o.outletId}/archive`, { reason: 'Dinonaktifkan dari Daftar Outlet' }).subscribe({
          next: () => {
            this.state.showToast(`Outlet ${o.name} diarsipkan`);
            this.state.refreshDashboard();
            this.loadAll();
          }
        });
      }
    });
  }

  restoreOutlet(o: OutletStatusItem): void {
    this.http.post(`${this.state.apiBase}/outlets/${o.outletId}/restore`, {}).subscribe({
      next: () => {
        this.state.showToast(`Outlet ${o.name} dipulihkan ke daftar aktif`);
        this.state.refreshDashboard();
        this.loadAll();
      }
    });
  }

  resolveOutletType(o: OutletStatusItem): string {
    if (o.type.includes('Apotek')) return 'Apotek';
    const isPratama = o.type.includes('Pratama');
    const isRjOnly = o.serviceScope === 'RJ_ONLY' || (o.type.includes('Rawat Jalan') && !o.type.includes('Rawat Inap'));
    if (isPratama) return isRjOnly ? 'Klinik Pratama (Rawat Jalan)' : 'Klinik Pratama (Rawat Inap & Jalan)';
    return isRjOnly ? 'Klinik Utama (Rawat Jalan)' : 'Klinik Utama (Rawat Inap & Jalan)';
  }

  changeOutletServiceType(o: OutletStatusItem, nextType: string): void {
    const serviceScope = nextType.includes('Rawat Jalan') && !nextType.includes('Rawat Inap') ? 'RJ_ONLY' : 'RI_RJ';
    this.http
      .patch<OutletStatusItem>(`${this.state.apiBase}/outlets/${o.outletId}/service-type`, { type: nextType, serviceScope })
      .subscribe({
        next: (updated) => {
          o.type = updated.type;
          o.serviceScope = updated.serviceScope;
          this.state.showToast(`Jenis klinik ${o.name} ditetapkan ke ${updated.type}`);
          this.state.refreshDashboard();
        }
      });
  }

  saveTemplate(tpl: OutletTemplate): void {
    this.http.put(`${this.state.apiBase}/outlet-templates/${encodeURIComponent(tpl.outletType)}`, tpl).subscribe({
      next: () => this.state.showToast(`Template ${tpl.outletType} disimpan & disinkronkan ke cabang`)
    });
  }

  loadOutletSettings(outletId: string): void {
    this.http
      .get<{ operatingHours?: string; syncIntervalSec?: number; autoSync?: boolean; localServerUrl?: string; coaPrefix?: string; receiptFooter?: string; activePolis?: string[] }>(
        `${this.state.apiBase}/outlets/${outletId}/settings`
      )
      .subscribe({
        next: (s) => {
          this.branchSettings = {
            operatingHours: s.operatingHours || '08:00 - 20:00',
            syncIntervalSec: s.syncIntervalSec || 15,
            autoSync: s.autoSync ?? true,
            localServerUrl: s.localServerUrl || 'http://localhost:5181',
            coaPrefix: s.coaPrefix || '101',
            receiptFooter: s.receiptFooter || '',
            activePolisText: (s.activePolis || ['Poli Umum']).join(', ')
          };
        }
      });
  }

  saveOutletSettings(): void {
    const payload = {
      ...this.branchSettings,
      activePolis: this.branchSettings.activePolisText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    };
    this.http.put(`${this.state.apiBase}/outlets/${this.selectedSettingOutletId}/settings`, payload).subscribe({
      next: () => this.state.showToast('Pengaturan cabang berhasil disimpan & dijadwalkan sync')
    });
  }

  countLicense(status: string): number {
    return this.licenses.filter((l) => l.status === status).length;
  }

  regenerateLicense(l: LicenseItem): void {
    this.state.askConfirm({
      title: 'Regenerate Kode Lisensi',
      message: `Kode lama (${l.activationCode}) untuk ${l.outletName} akan diganti. Server lokal harus melakukan aktivasi ulang.`,
      confirmLabel: 'Generate Kode Baru',
      onConfirm: () => {
        this.http.post(`${this.state.apiBase}/licenses/${l.licenseId}/regenerate`, {}).subscribe({
          next: () => {
            this.state.showToast(`Kode aktivasi baru diterbitkan untuk ${l.outletName}`);
            this.loadAll();
          }
        });
      }
    });
  }

  toggleSuspendLicense(l: LicenseItem): void {
    const nextStatus = l.status === 'Suspended' ? 'Aktif' : 'Suspended';
    this.http.put(`${this.state.apiBase}/licenses/${l.licenseId}`, { status: nextStatus }).subscribe({
      next: () => {
        l.status = nextStatus;
        this.state.showToast(`Status lisensi ${l.outletName}: ${nextStatus}`);
      }
    });
  }

  copyCode(code: string): void {
    navigator.clipboard?.writeText(code).catch(() => {});
    this.state.showToast(`Kode aktivasi ${code} disalin`);
  }
}
