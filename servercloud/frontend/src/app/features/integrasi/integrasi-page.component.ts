import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { OutletStatusItem, SyncLogEntry } from '../../core/models/erp.models';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { SlideDrawerComponent } from '../../shared/components/slide-drawer.component';
import { MappingFormComponent } from './forms/mapping-form.component';

interface FhirLog {
  id: string;
  timestamp: string;
  outlet: string;
  resourceType: string;
  patientLabel: string;
  httpStatus: number;
  status: string;
  payloadJson: unknown;
  responseMessage: string;
}

interface CodeMapping {
  id: string;
  standard: string;
  localCode: string;
  localName: string;
  standardCode: string;
  standardDisplay: string;
  status: string;
}

interface BpjsLog {
  id: string;
  timestamp: string;
  outlet: string;
  service: string;
  refNo: string;
  responseCode: string;
  message: string;
  status: string;
}

interface BpjsClaim {
  claimNo: string;
  outlet: string;
  program: string;
  totalCases: number;
  amountMillions: number;
  status: string;
}

@Component({
  selector: 'app-integrasi-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SlideDrawerComponent, MappingFormComponent],
  template: `
    @if (sub === 'satusehat-konfigurasi') {
      <div class="panel">
        <h2>Konfigurasi Terpusat Bridging SATUSEHAT (Kemenkes FHIR R4)</h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Environment</th>
                <th>Organization ID</th>
                <th>Location ID</th>
                <th>Client ID</th>
                <th>Secret</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (o of outlets; track o.outletId) {
                <tr>
                  <td><b>{{ o.name }}</b></td>
                  <td><span class="pill info">{{ o.satuSehatEnv || 'Sandbox' }}</span></td>
                  <td><code>{{ o.satuSehatOrgId || '-' }}</code></td>
                  <td><code>{{ o.satuSehatLocId || '-' }}</code></td>
                  <td><code>{{ o.satuSehatClientId || '-' }}</code></td>
                  <td>{{ o.hasSatuSehatSecret ? o.satuSehatClientSecretMasked : 'Belum diisi' }}</td>
                  <td><span class="pill" [ngClass]="o.satuSehatStatus">{{ o.satuSehatLabel }}</span></td>
                  <td>
                    <button class="ib btn-sm" type="button" (click)="testOutletBridging(o, 'SATUSEHAT')">Test OAuth2</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'satusehat-monitoring-fhir') {
      <div class="stats">
        <div class="stat"><span>Total Payload FHIR</span><b>{{ fhirLogs.length }}</b></div>
        <div class="stat"><span>Terkirim (200 OK)</span><b>{{ countFhir('Terkirim') }}</b></div>
        <div class="stat"><span>Gagal / Perlu Retry</span><b>{{ fhirLogs.length - countFhir('Terkirim') }}</b></div>
      </div>

      <div class="panel">
        <h2>
          Monitoring Transmisi Resource FHIR R4
          <span class="sp"></span>
          <select class="select" [(ngModel)]="fhirStatusFilter">
            <option value="Semua">Semua Status</option>
            <option value="Terkirim">Terkirim</option>
            <option value="Gagal">Gagal / Antre</option>
          </select>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Waktu</th>
                <th>Outlet</th>
                <th>Resource</th>
                <th>Pasien / Subjek</th>
                <th>HTTP</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (f of filteredFhirLogs; track f.id) {
                <tr>
                  <td><code>{{ f.id }}</code></td>
                  <td>{{ f.timestamp }}</td>
                  <td><b>{{ f.outlet }}</b></td>
                  <td><span class="pill info">{{ f.resourceType }}</span></td>
                  <td>{{ f.patientLabel }}</td>
                  <td><code>{{ f.httpStatus }}</code></td>
                  <td><span class="pill" [ngClass]="f.status === 'Terkirim' ? 'ok' : 'bad'">{{ f.status }}</span></td>
                  <td>
                    <button class="ib btn-sm" type="button" (click)="selectedFhir = f">Inspeksi JSON</button>
                    @if (f.status !== 'Terkirim') {
                      <button class="btn btn-sm" type="button" (click)="retryFhir(f)">Kirim Ulang</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'satusehat-mapping-kode') {
      @if (showAddMapDrawer || !!editingMap) {
        <app-mapping-form [model]="mapForm" [editing]="!!editingMap" (submitted)="saveMapping()" (cancelled)="closeMapDrawer()" />
      }
      @if (unmappedCount > 0) {
        <div class="banner warn">
          <span>Terdapat <b>{{ unmappedCount }} kode lokal</b> yang belum dipetakan ke standar Kemenkes (KFA / ICD / LOINC).</span>
          <button class="ib btn-sm" type="button" (click)="onlyUnmapped = !onlyUnmapped">{{ onlyUnmapped ? 'Tampilkan Semua' : 'Filter Belum Terpetakan' }}</button>
        </div>
      }
      <div class="panel">
        <h2>
          Mapping Kode Terminologi Standar (KFA · ICD-10 · ICD-9-CM · LOINC)
          <span class="sp"></span>
          <select class="select" [(ngModel)]="mapStandardFilter">
            <option value="Semua">Semua Standar</option>
            <option value="KFA">KFA</option>
            <option value="ICD-10">ICD-10</option>
            <option value="ICD-9-CM">ICD-9-CM</option>
            <option value="LOINC">LOINC</option>
          </select>
          <button class="btn btn-sm" type="button" (click)="showAddMapDrawer = true">+ Tambah Mapping</button>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Standar</th>
                <th>Kode Lokal</th>
                <th>Nama Tindakan / Item Lokal</th>
                <th>Kode Standar</th>
                <th>Display Standar</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (m of filteredMappings; track m.id) {
                <tr>
                  <td><span class="pill info">{{ m.standard }}</span></td>
                  <td><code>{{ m.localCode }}</code></td>
                  <td><b>{{ m.localName }}</b></td>
                  <td><code>{{ m.standardCode || '-' }}</code></td>
                  <td class="wrap-cell">{{ m.standardDisplay || '-' }}</td>
                  <td><span class="pill" [ngClass]="m.status === 'Terpetakan' ? 'ok' : 'warn'">{{ m.status }}</span></td>
                  <td><button class="ib btn-sm" type="button" (click)="openEditMap(m)">Petakan</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'bpjs-konfigurasi') {
      <div class="panel">
        <h2>Konfigurasi Bridging BPJS Kesehatan (VClaim · P-Care · Antrol · PRB)</h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Layanan</th>
                <th>Environment</th>
                <th>Kode PPK</th>
                <th>Cons ID</th>
                <th>Secret & User Key</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (o of outlets; track o.outletId) {
                <tr>
                  <td><b>{{ o.name }}</b></td>
                  <td>{{ o.bpjsServiceType || '-' }}</td>
                  <td><span class="pill info">{{ o.bpjsEnv || 'Development' }}</span></td>
                  <td><code>{{ o.bpjsPpkCode || '-' }}</code></td>
                  <td><code>{{ o.bpjsConsId || '-' }}</code></td>
                  <td>{{ o.hasBpjsSecret ? o.bpjsSecretKeyMasked : 'Belum diisi' }}</td>
                  <td><span class="pill" [ngClass]="o.bpjsStatus">{{ o.bpjsLabel }}</span></td>
                  <td><button class="ib btn-sm" type="button" (click)="testOutletBridging(o, 'BPJS')">Test Ping BPJS</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'bpjs-monitoring-klaim') {
      <div class="tabs">
        <button class="tab" type="button" [class.on]="bpjsTab === 'claims'" (click)="bpjsTab = 'claims'">Monitoring Klaim & Berkas</button>
        <button class="tab" type="button" [class.on]="bpjsTab === 'logs'" (click)="bpjsTab = 'logs'">Log Bridging SEP / P-Care / Antrol</button>
      </div>

      @if (bpjsTab === 'claims') {
        <div class="panel">
          <h2>Rekapitulasi Klaim BPJS Kesehatan Lintas Cabang</h2>
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>No. Klaim</th>
                  <th>Cabang</th>
                  <th>Program BPJS</th>
                  <th class="num">Berkas</th>
                  <th class="num">Nilai Pengajuan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (c of bpjsClaims; track c.claimNo) {
                  <tr>
                    <td><code>{{ c.claimNo }}</code></td>
                    <td><b>{{ c.outlet }}</b></td>
                    <td>{{ c.program }}</td>
                    <td class="num">{{ c.totalCases }}</td>
                    <td class="num"><b>Rp {{ c.amountMillions.toFixed(1).replace('.', ',') }} jt</b></td>
                    <td><span class="pill info">{{ c.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <div class="panel">
          <h2>Log Bridging & Antrean Online (Antrol Task ID)</h2>
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Cabang</th>
                  <th>Layanan</th>
                  <th>Referensi</th>
                  <th>Pesan Respon</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                @for (l of bpjsLogs; track l.id) {
                  <tr>
                    <td>{{ l.timestamp }}</td>
                    <td><b>{{ l.outlet }}</b></td>
                    <td>{{ l.service }}</td>
                    <td><code>{{ l.refNo }}</code></td>
                    <td class="wrap-cell">{{ l.message }}</td>
                    <td><span class="pill" [ngClass]="l.status === 'Sukses' ? 'ok' : 'warn'">{{ l.status }}</span></td>
                    <td>
                      @if (l.status !== 'Sukses') {
                        <button class="btn btn-sm" type="button" (click)="retryBpjs(l)">Retry</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

    } @else if (sub === 'sinkronisasi-data') {
      <div class="panel">
        <h2>
          Konsol Operasi Sync Hub (Cloud VPS ⇄ Server Lokal Cabang)
          <span class="sp"></span>
          <span class="pill info">Master Version: v{{ masterVersion }}</span>
          <button class="btn btn-sm" type="button" (click)="broadcastMaster()">Broadcast Master ke Cabang</button>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Arah</th>
                <th>Cabang</th>
                <th>Modul</th>
                <th>Ringkasan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (log of syncLogs; track log.id + log.timestamp) {
                <tr>
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
      </div>
    }

    <app-slide-drawer [open]="!!selectedFhir" title="Inspektor Payload FHIR R4" [subtitle]="selectedFhir?.resourceType || ''" (closed)="selectedFhir = null">
      @if (selectedFhir; as f) {
        <div class="row"><span>Outlet</span><b>{{ f.outlet }}</b></div>
        <div class="row"><span>Subjek</span><b>{{ f.patientLabel }}</b></div>
        <div class="row"><span>Status HTTP</span><span class="pill" [ngClass]="f.httpStatus === 200 ? 'ok' : 'bad'">{{ f.httpStatus }}</span></div>
        <div style="margin-top:12px">
          <div class="hint-text" style="margin-bottom:4px">Respon Kemenkes SATUSEHAT</div>
          <div class="code-block">{{ f.responseMessage }}</div>
        </div>
        <div style="margin-top:12px">
          <div class="hint-text" style="margin-bottom:4px">JSON Payload FHIR</div>
          <div class="code-block">{{ f.payloadJson | json }}</div>
        </div>
      }
    </app-slide-drawer>
  `
})
export class IntegrasiPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'satusehat-konfigurasi';
  outlets: OutletStatusItem[] = [];
  fhirLogs: FhirLog[] = [];
  fhirStatusFilter = 'Semua';
  selectedFhir: FhirLog | null = null;

  mappings: CodeMapping[] = [];
  mapStandardFilter = 'Semua';
  onlyUnmapped = false;
  showAddMapDrawer = false;
  editingMap: CodeMapping | null = null;
  mapForm = { standard: 'ICD-10', localCode: '', localName: '', standardCode: '', standardDisplay: '' };

  bpjsTab: 'claims' | 'logs' = 'claims';
  bpjsClaims: BpjsClaim[] = [];
  bpjsLogs: BpjsLog[] = [];

  masterVersion = 1;
  syncLogs: SyncLogEntry[] = [];

  get filteredFhirLogs(): FhirLog[] {
    if (this.fhirStatusFilter === 'Semua') return this.fhirLogs;
    if (this.fhirStatusFilter === 'Terkirim') return this.fhirLogs.filter((f) => f.status === 'Terkirim');
    return this.fhirLogs.filter((f) => f.status !== 'Terkirim');
  }

  get unmappedCount(): number {
    return this.mappings.filter((m) => m.status !== 'Terpetakan').length;
  }

  get filteredMappings(): CodeMapping[] {
    return this.mappings.filter((m) => {
      const okStd = this.mapStandardFilter === 'Semua' || m.standard === this.mapStandardFilter;
      const okUnmapped = !this.onlyUnmapped || m.status !== 'Terpetakan';
      return okStd && okUnmapped;
    });
  }

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'satusehat-konfigurasi';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    this.http.get<OutletStatusItem[]>(`${this.state.apiBase}/outlets?status=Aktif`).subscribe({
      next: (list) => (this.outlets = list || [])
    });
    if (this.sub === 'satusehat-monitoring-fhir') {
      this.http.get<FhirLog[]>(`${this.state.apiBase}/integrations/satusehat/logs`).subscribe({
        next: (list) => (this.fhirLogs = list || [])
      });
    } else if (this.sub === 'satusehat-mapping-kode') {
      this.http.get<CodeMapping[]>(`${this.state.apiBase}/integrations/mappings`).subscribe({
        next: (list) => (this.mappings = list || [])
      });
    } else if (this.sub === 'bpjs-monitoring-klaim') {
      this.http.get<{ claims: BpjsClaim[]; logs: BpjsLog[] }>(`${this.state.apiBase}/integrations/bpjs/monitoring`).subscribe({
        next: (res) => {
          this.bpjsClaims = res.claims || [];
          this.bpjsLogs = res.logs || [];
        }
      });
    } else if (this.sub === 'sinkronisasi-data') {
      this.http.get<{ masterVersion: number; logs: SyncLogEntry[] }>(`${this.state.apiBase}/sync/hub-status`).subscribe({
        next: (res) => {
          this.masterVersion = res.masterVersion;
          this.syncLogs = res.logs || [];
        }
      });
    }
  }

  countFhir(status: string): number {
    return this.fhirLogs.filter((f) => f.status === status).length;
  }

  testOutletBridging(o: OutletStatusItem, target: 'SATUSEHAT' | 'BPJS'): void {
    this.http
      .post<{ message: string }>(`${this.state.apiBase}/outlets/test-bridging`, { target, ...o })
      .subscribe({
        next: (res) => this.state.showToast(res.message),
        error: (err) => this.state.showToast(err?.error?.message || `Gagal test ${target}`)
      });
  }

  retryFhir(f: FhirLog): void {
    this.http.post<FhirLog>(`${this.state.apiBase}/integrations/satusehat/retry/${f.id}`, {}).subscribe({
      next: (updated) => {
        this.fhirLogs = this.fhirLogs.map((x) => (x.id === updated.id ? updated : x));
        this.state.showToast(`Payload FHIR ${updated.resourceType} berhasil dikirim ulang`);
      }
    });
  }

  retryBpjs(l: BpjsLog): void {
    this.http.post<BpjsLog>(`${this.state.apiBase}/integrations/bpjs/retry/${l.id}`, {}).subscribe({
      next: (updated) => {
        this.bpjsLogs = this.bpjsLogs.map((x) => (x.id === updated.id ? updated : x));
        this.state.showToast(`Bridging BPJS ${updated.refNo} berhasil dikirim ulang`);
      }
    });
  }

  openEditMap(m: CodeMapping): void {
    this.editingMap = m;
    this.mapForm = {
      standard: m.standard,
      localCode: m.localCode,
      localName: m.localName,
      standardCode: m.standardCode,
      standardDisplay: m.standardDisplay
    };
  }

  closeMapDrawer(): void {
    this.showAddMapDrawer = false;
    this.editingMap = null;
    this.mapForm = { standard: 'ICD-10', localCode: '', localName: '', standardCode: '', standardDisplay: '' };
  }

  saveMapping(): void {
    if (this.editingMap) {
      this.http.put<CodeMapping>(`${this.state.apiBase}/integrations/mappings/${this.editingMap.id}`, this.mapForm).subscribe({
        next: (updated) => {
          this.mappings = this.mappings.map((x) => (x.id === updated.id ? updated : x));
          this.closeMapDrawer();
          this.state.showToast('Mapping kode berhasil diperbarui');
        }
      });
      return;
    }
    this.http.post<CodeMapping>(`${this.state.apiBase}/integrations/mappings`, this.mapForm).subscribe({
      next: (created) => {
        this.mappings = [created, ...this.mappings];
        this.closeMapDrawer();
        this.state.showToast('Mapping kode baru ditambahkan');
      }
    });
  }

  broadcastMaster(): void {
    this.http.post<{ masterVersion: number }>(`${this.state.apiBase}/sync/broadcast-master`, {}).subscribe({
      next: (res) => {
        this.masterVersion = res.masterVersion;
        this.state.showToast(`Master Data v${res.masterVersion} di-broadcast ke semua cabang`);
        this.loadAll();
      }
    });
  }
}
