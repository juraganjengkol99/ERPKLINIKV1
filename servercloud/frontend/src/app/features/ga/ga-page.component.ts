import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { IdrPipe } from '../../shared/pipes/idr.pipe';
import { AssetFormComponent } from './forms/asset-form.component';
import { MaintenanceFormComponent } from './forms/maintenance-form.component';
import { PermitFormComponent } from './forms/permit-form.component';
import { VehicleFormComponent } from './forms/vehicle-form.component';
import { VendorFormComponent } from './forms/vendor-form.component';

@Component({
  selector: 'app-ga-page',
  standalone: true,
  imports: [CommonModule, FormsModule, IdrPipe, AssetFormComponent, MaintenanceFormComponent, PermitFormComponent, VehicleFormComponent, VendorFormComponent],
  template: `
    @if (sub === 'aset-inventaris') {
      @if (showAssetDrawer) {
        <app-asset-form [model]="assetForm" (submitted)="createAsset()" (cancelled)="showAssetDrawer = false" />
      }
      <div class="panel">
        <h2>
          Aset Medis & Inventaris Fasilitas (Terhubung ke Aset Tetap Akunting)
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showAssetDrawer = true">+ Tambah Aset</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>Kode</th><th>Nama Aset</th><th>Kategori</th><th>Lokasi</th><th>Serial No.</th><th class="num">Nilai Beli</th><th>Kalibrasi</th><th>Kondisi</th></tr></thead>
            <tbody>
              @for (a of assets; track a.code) {
                <tr>
                  <td><code>{{ a.code }}</code></td>
                  <td><b>{{ a.name }}</b></td>
                  <td>{{ a.category }}</td>
                  <td>{{ a.outlet }}</td>
                  <td><code>{{ a.serialNo }}</code></td>
                  <td class="num">{{ a.costRp | idr }}</td>
                  <td>{{ a.calibrationDate }}</td>
                  <td><span class="pill" [ngClass]="a.condition.includes('Baik') ? 'ok' : 'warn'">{{ a.condition }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'pemeliharaan-kalibrasi') {
      @if (showMaintDrawer) {
        <app-maintenance-form [model]="maintForm" [assets]="assets" (submitted)="createMaintenance()" (cancelled)="showMaintDrawer = false" />
      }
      <div class="panel">
        <h2>
          Jadwal Pemeliharaan & Kalibrasi Alat Kesehatan
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showMaintDrawer = true">+ Jadwalkan Kalibrasi</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>ID</th><th>Alat / Aset</th><th>Outlet</th><th>Jenis</th><th>Tanggal</th><th>Vendor</th><th class="num">Biaya</th><th>Sertifikat</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (m of maintenances; track m.id) {
                <tr>
                  <td><code>{{ m.id }}</code></td>
                  <td><b>{{ m.assetName }}</b></td>
                  <td>{{ m.outlet }}</td>
                  <td>{{ m.type }}</td>
                  <td>{{ m.scheduledDate }}</td>
                  <td>{{ m.vendor }}</td>
                  <td class="num">{{ m.costRp | idr }}</td>
                  <td><code>{{ m.certificateNo }}</code></td>
                  <td><span class="pill" [ngClass]="m.status === 'Selesai' ? 'ok' : 'warn'">{{ m.status }}</span></td>
                  <td>
                    @if (m.status !== 'Selesai') {
                      <button class="btn btn-sm" type="button" (click)="completeMaintenance(m)">Selesaikan</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'perizinan-outlet') {
      @if (showPermitDrawer) {
        <app-permit-form [model]="permitForm" (submitted)="createPermit()" (cancelled)="showPermitDrawer = false" />
      }
      <div class="panel">
        <h2>
          Pelacakan Perizinan & Legalitas Cabang (IOK · SIA · Limbah B3)
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showPermitDrawer = true">+ Tambah Izin</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>Outlet</th><th>Nama Dokumen Izin</th><th>No. Izin</th><th>Instansi Penerbit</th><th>Berlaku Hingga</th><th>Status</th></tr></thead>
            <tbody>
              @for (p of permits; track p.id) {
                <tr>
                  <td><b>{{ p.outlet }}</b></td>
                  <td>{{ p.permitName }}</td>
                  <td><code>{{ p.permitNo }}</code></td>
                  <td>{{ p.issuer }}</td>
                  <td>{{ p.expiryDate }}</td>
                  <td><span class="pill" [ngClass]="p.status === 'Aktif' ? 'ok' : 'warn'">{{ p.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'kendaraan') {
      @if (showVehDrawer) {
        <app-vehicle-form [model]="vehForm" (submitted)="createVehicle()" (cancelled)="showVehDrawer = false" />
      }
      <div class="panel">
        <h2>
          Armada Ambulans & Kendaraan Operasional
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showVehDrawer = true">+ Tambah Kendaraan</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>Plat Nomor</th><th>Model / Fungsi</th><th>Cabang</th><th>Exp. STNK</th><th>Exp. KIR</th><th class="num">Odometer</th><th>Servis Terakhir</th><th>Status</th></tr></thead>
            <tbody>
              @for (v of vehicles; track v.id) {
                <tr>
                  <td><code>{{ v.plateNo }}</code></td>
                  <td><b>{{ v.model }}</b></td>
                  <td>{{ v.outlet }}</td>
                  <td>{{ v.stnkExpiry }}</td>
                  <td>{{ v.kirExpiry }}</td>
                  <td class="num">{{ v.odometerKm.toLocaleString('id-ID') }} km</td>
                  <td>{{ v.lastService }}</td>
                  <td><span class="pill ok">{{ v.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'vendor-jasa') {
      @if (showVendorDrawer) {
        <app-vendor-form [model]="vendorForm" (submitted)="createVendor()" (cancelled)="showVendorDrawer = false" />
      }
      <div class="panel">
        <h2>
          Vendor Jasa & Kontrak SLA (Limbah B3 · Kalibrasi · Maintenance)
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showVendorDrawer = true">+ Tambah Vendor Jasa</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>Nama Vendor</th><th>Bidang Layanan</th><th>PIC & Kontak</th><th>SLA</th><th>Akhir Kontrak</th><th>Status</th></tr></thead>
            <tbody>
              @for (v of vendors; track v.id) {
                <tr>
                  <td><b>{{ v.name }}</b></td>
                  <td>{{ v.serviceType }}</td>
                  <td>{{ v.pic }} · {{ v.phone }}</td>
                  <td>{{ v.sla }}</td>
                  <td>{{ v.contractEnd }}</td>
                  <td><span class="pill ok">{{ v.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `
})
export class GaPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'aset-inventaris';
  assets: Array<{ code: string; name: string; category: string; outlet: string; serialNo: string; costRp: number; calibrationDate: string; condition: string }> = [];
  maintenances: Array<{ id: string; assetCode: string; assetName: string; outlet: string; type: string; scheduledDate: string; vendor: string; costRp: number; certificateNo: string; status: string }> = [];
  permits: Array<{ id: string; outlet: string; permitName: string; permitNo: string; issuer: string; expiryDate: string; status: string }> = [];
  vehicles: Array<{ id: string; plateNo: string; model: string; outlet: string; stnkExpiry: string; kirExpiry: string; odometerKm: number; lastService: string; status: string }> = [];
  vendors: Array<{ id: string; name: string; serviceType: string; pic: string; phone: string; contractEnd: string; sla: string; status: string }> = [];

  showAssetDrawer = false;
  assetForm = { name: '', category: 'Alat Medis', outlet: 'Klinik Utama', costRp: 25000000, calibrationDate: '2027-12-01' };
  showMaintDrawer = false;
  maintForm = { assetCode: 'AST-MED-01', type: 'Kalibrasi BPFK', scheduledDate: '2026-12-15', costRp: 1800000 };
  showPermitDrawer = false;
  permitForm = { outlet: 'Klinik Utama', permitName: 'Izin TPS Limbah B3', permitNo: 'B3-2026-099', issuer: 'DLH Provinsi', expiryDate: '2028-12-31' };
  showVehDrawer = false;
  vehForm = { plateNo: 'B 8821 KLP', model: 'Suzuki APV Ambulans', outlet: 'Klinik Pratama', stnkExpiry: '2027-11-30' };
  showVendorDrawer = false;
  vendorForm = { name: '', serviceType: 'Cleaning & Sanitasi Klinik', pic: '', phone: '', sla: 'Harian 2 Shift' };

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'aset-inventaris';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    this.http.get<any[]>(`${this.state.apiBase}/ga/assets`).subscribe({ next: (l) => (this.assets = l || []) });
    if (this.sub === 'pemeliharaan-kalibrasi') {
      this.http.get<any[]>(`${this.state.apiBase}/ga/maintenances`).subscribe({ next: (l) => (this.maintenances = l || []) });
    } else if (this.sub === 'perizinan-outlet') {
      this.http.get<any[]>(`${this.state.apiBase}/ga/permits`).subscribe({ next: (l) => (this.permits = l || []) });
    } else if (this.sub === 'kendaraan') {
      this.http.get<any[]>(`${this.state.apiBase}/ga/vehicles`).subscribe({ next: (l) => (this.vehicles = l || []) });
    } else if (this.sub === 'vendor-jasa') {
      this.http.get<any[]>(`${this.state.apiBase}/ga/vendors`).subscribe({ next: (l) => (this.vendors = l || []) });
    }
  }

  createAsset(): void {
    this.http.post<any>(`${this.state.apiBase}/ga/assets`, this.assetForm).subscribe({
      next: (c) => {
        this.assets = [c, ...this.assets];
        this.showAssetDrawer = false;
        this.state.showToast('Aset ditambahkan & disinkronkan ke Aset Tetap Akunting');
      }
    });
  }

  createMaintenance(): void {
    this.http.post<any>(`${this.state.apiBase}/ga/maintenances`, this.maintForm).subscribe({
      next: (c) => {
        this.maintenances = [c, ...this.maintenances];
        this.showMaintDrawer = false;
        this.state.showToast('Jadwal pemeliharaan/kalibrasi dibuat');
      }
    });
  }

  completeMaintenance(m: { id: string; status: string; certificateNo: string }): void {
    const cert = `CERT-KAL-${Date.now().toString().slice(-4)}`;
    this.http.put(`${this.state.apiBase}/ga/maintenances/${m.id}`, { status: 'Selesai', certificateNo: cert }).subscribe({
      next: () => {
        m.status = 'Selesai';
        m.certificateNo = cert;
        this.state.showToast(`Kalibrasi selesai (Sertifikat ${cert})`);
      }
    });
  }

  createPermit(): void {
    this.http.post<any>(`${this.state.apiBase}/ga/permits`, this.permitForm).subscribe({
      next: (c) => {
        this.permits = [c, ...this.permits];
        this.showPermitDrawer = false;
        this.state.showToast('Dokumen perizinan ditambahkan');
      }
    });
  }

  createVehicle(): void {
    this.http.post<any>(`${this.state.apiBase}/ga/vehicles`, this.vehForm).subscribe({
      next: (c) => {
        this.vehicles = [c, ...this.vehicles];
        this.showVehDrawer = false;
        this.state.showToast('Kendaraan ditambahkan');
      }
    });
  }

  createVendor(): void {
    this.http.post<any>(`${this.state.apiBase}/ga/vendors`, this.vendorForm).subscribe({
      next: (c) => {
        this.vendors = [c, ...this.vendors];
        this.showVendorDrawer = false;
        this.state.showToast('Vendor jasa ditambahkan');
      }
    });
  }
}
