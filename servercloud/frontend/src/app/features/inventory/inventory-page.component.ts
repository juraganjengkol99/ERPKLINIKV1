import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { TablePagerComponent } from '../../shared/components/table-pager.component';
import { filterRows, paginateRows } from '../../shared/utils/table-filter';
import { IdrPipe } from '../../shared/pipes/idr.pipe';
import { KfaFormComponent } from './forms/kfa-form.component';
import { MutationFormComponent } from './forms/mutation-form.component';
import { OpnameFormComponent } from './forms/opname-form.component';

interface InventoryKfaItem {
  code: string;
  name: string;
  category: string;
  dosageForm?: string;
  centralStock: number;
  minStock?: number;
  unit: string;
  price: string;
  hnaPrice?: number;
  hetPrice?: number;
  expiredDate: string;
  isNarcotic?: boolean;
  status?: string;
}

interface ConsolidatedItem extends InventoryKfaItem {
  byLocation: Record<string, number>;
  totalStock: number;
  valuationRp: number;
  isLowStock: boolean;
}

interface BatchItem {
  id: string;
  code: string;
  name: string;
  location: string;
  batchNo: string;
  expiredDate: string;
  qty: number;
  rack: string;
  status: string;
}

interface StockRequestItem {
  reqId: string;
  date: string;
  outletId: string;
  outletName: string;
  itemCode: string;
  itemName: string;
  qty: number;
  status: string;
}

interface MutationItem {
  id: string;
  date: string;
  fromLocation: string;
  toLocation: string;
  itemCode: string;
  itemName: string;
  batchNo: string;
  qty: number;
  status: string;
}

interface OpnameItem {
  id: string;
  date: string;
  location: string;
  code: string;
  name: string;
  systemQty: number;
  physicalQty: number;
  difference: number;
  reason: string;
  status: string;
}

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TablePagerComponent, IdrPipe, KfaFormComponent, MutationFormComponent, OpnameFormComponent],
  template: `
    @if (sub === 'master-barang-kfa') {
      @if (showKfaDrawer) {
        <app-kfa-form [model]="kfaForm" [editing]="!!editingKfaCode" (submitted)="saveKfa()" (cancelled)="showKfaDrawer = false" />
      }
      <div class="panel">
        <h2>
          Master Barang Standar KFA Kemenkes (Auto-Sync ke Cabang)
          <span class="sp"></span>
          <input class="input" [(ngModel)]="kfaSearch" placeholder="Cari kode KFA / nama obat..." />
          <button class="btn" type="button" (click)="openKfaDrawer()">+ Tambah Barang KFA</button>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Kode KFA</th>
                <th>Nama Obat / Alkes</th>
                <th>Kategori & Sediaan</th>
                <th class="num">Stok Pusat</th>
                <th class="num">Min. Stok</th>
                <th class="num">HNA</th>
                <th class="num">HET</th>
                <th>Narkotika</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (item of pagedKfa; track item.code) {
                <tr>
                  <td><code>{{ item.code }}</code></td>
                  <td><b>{{ item.name }}</b></td>
                  <td>{{ item.category }} · {{ item.dosageForm || item.unit }}</td>
                  <td class="num"><b>{{ item.centralStock }}</b> {{ item.unit }}</td>
                  <td class="num">{{ item.minStock || 200 }}</td>
                  <td class="num">{{ (item.hnaPrice || 0) | idr }}</td>
                  <td class="num">{{ (item.hetPrice || 0) | idr }}</td>
                  <td><span class="pill" [ngClass]="item.isNarcotic ? 'bad' : 'info'">{{ item.isNarcotic ? 'Narkotika' : 'Reguler' }}</span></td>
                  <td><button class="ib btn-sm" type="button" (click)="openKfaDrawer(item)">Edit</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-table-pager [total]="filteredKfa.length" [(page)]="kfaPage" [(pageSize)]="pageSize" />
      </div>

    } @else if (sub === 'stok-konsolidasi') {
      <div class="stats">
        <div class="stat"><span>Total SKU KFA</span><b>{{ consolidatedItems.length }}</b></div>
        <div class="stat"><span>Total Valuasi Stok Grup</span><b>{{ totalStockValuation | idr }}</b></div>
        <div class="stat"><span>SKU Di Bawah Minimum</span><b>{{ lowStockCount }}</b></div>
      </div>

      <div class="panel">
        <h2>Matriks Stok Konsolidasi Real-Time (Pusat + Semua Cabang)</h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Kode KFA</th>
                <th>Nama Barang</th>
                @for (loc of consolidatedLocations; track loc) {
                  <th class="num">{{ loc }}</th>
                }
                <th class="num">Total Grup</th>
                <th class="num">Valuasi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (c of consolidatedItems; track c.code) {
                <tr>
                  <td><code>{{ c.code }}</code></td>
                  <td><b>{{ c.name }}</b></td>
                  @for (loc of consolidatedLocations; track loc) {
                    <td class="num">{{ c.byLocation[loc] || 0 }}</td>
                  }
                  <td class="num"><b>{{ c.totalStock }}</b></td>
                  <td class="num">{{ c.valuationRp | idr }}</td>
                  <td>
                    @if (c.isLowStock) {
                      <span class="pill bad">Stok Kritis</span>
                    } @else {
                      <span class="pill ok">Aman</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'mutasi-antar-outlet') {
      @if (showMutationDrawer) {
        <app-mutation-form [model]="mutForm" [outlets]="state.outlets()" [kfaItems]="kfaItems" (submitted)="createMutation()" (cancelled)="showMutationDrawer = false" />
      }
      <div class="tabs">
        <button class="tab" type="button" [class.on]="mutTab === 'requests'" (click)="mutTab = 'requests'">Permintaan Stok Cabang ({{ stockRequests.length }})</button>
        <button class="tab" type="button" [class.on]="mutTab === 'mutations'" (click)="mutTab = 'mutations'">Riwayat Mutasi Antar Outlet</button>
      </div>

      @if (mutTab === 'requests') {
        <div class="panel">
          <h2>Permintaan Distribusi Cabang → Gudang Pusat (Auto-FEFO)</h2>
          <div class="tw">
            <table>
              <thead><tr><th>No. Request</th><th>Tanggal</th><th>Cabang Pemohon</th><th>Kode KFA</th><th>Nama Barang</th><th class="num">Qty</th><th>Status</th><th>Aksi Pusat</th></tr></thead>
              <tbody>
                @for (req of stockRequests; track req.reqId) {
                  <tr>
                    <td><code>{{ req.reqId }}</code></td>
                    <td>{{ req.date }}</td>
                    <td><b>{{ req.outletName }}</b></td>
                    <td><code>{{ req.itemCode }}</code></td>
                    <td>{{ req.itemName }}</td>
                    <td class="num"><b>{{ req.qty }}</b></td>
                    <td><span class="pill" [ngClass]="req.status === 'Dikirim ke Cabang' ? 'ok' : 'warn'">{{ req.status }}</span></td>
                    <td>
                      @if (req.status !== 'Dikirim ke Cabang') {
                        <button class="btn btn-sm" type="button" (click)="approveRequest(req)">Setujui & Kirim FEFO</button>
                      } @else {
                        <span class="pill ok">Terkirim & Tersinkron</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <div class="panel">
          <h2>
            Mutasi Stok Antar Lokasi (Pusat ↔ Cabang)
            <span class="sp"></span>
            <button class="btn btn-sm" type="button" (click)="showMutationDrawer = true">+ Buat Mutasi Stok</button>
          </h2>
          <div class="tw">
            <table>
              <thead><tr><th>No. Mutasi</th><th>Tanggal</th><th>Dari</th><th>Ke</th><th>Barang</th><th>Batch FEFO</th><th class="num">Qty</th><th>Status</th></tr></thead>
              <tbody>
                @for (m of mutations; track m.id) {
                  <tr>
                    <td><code>{{ m.id }}</code></td>
                    <td>{{ m.date }}</td>
                    <td>{{ m.fromLocation }}</td>
                    <td><b>{{ m.toLocation }}</b></td>
                    <td>{{ m.itemName }}</td>
                    <td><code>{{ m.batchNo }}</code></td>
                    <td class="num"><b>{{ m.qty }}</b></td>
                    <td><span class="pill ok">{{ m.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

    } @else if (sub === 'stok-opname') {
      @if (showOpnameDrawer) {
        <app-opname-form [model]="opnForm" [outlets]="state.outlets()" [kfaItems]="kfaItems" (submitted)="createOpname()" (cancelled)="showOpnameDrawer = false" />
      }
      <div class="panel">
        <h2>
          Stok Opname & Penyesuaian Fisik
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showOpnameDrawer = true">+ Input Opname</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. Opname</th><th>Tanggal</th><th>Lokasi</th><th>Barang</th><th class="num">Sistem</th><th class="num">Fisik</th><th class="num">Selisih</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (o of opnames; track o.id) {
                <tr>
                  <td><code>{{ o.id }}</code></td>
                  <td>{{ o.date }}</td>
                  <td>{{ o.location }}</td>
                  <td><b>{{ o.name }}</b></td>
                  <td class="num">{{ o.systemQty }}</td>
                  <td class="num">{{ o.physicalQty }}</td>
                  <td class="num"><span class="pill" [ngClass]="o.difference === 0 ? 'ok' : 'warn'">{{ o.difference }}</span></td>
                  <td class="wrap-cell">{{ o.reason }}</td>
                  <td><span class="pill" [ngClass]="o.status === 'Disetujui' ? 'ok' : 'warn'">{{ o.status }}</span></td>
                  <td>
                    @if (o.status !== 'Disetujui') {
                      <button class="btn btn-sm" type="button" (click)="approveOpname(o)">Approve</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'batch-expired') {
      <div class="stats">
        <div class="stat" style="cursor:pointer" (click)="expFilter = 'all'"><span>Semua Batch Aktif</span><b>{{ batches.length }}</b></div>
        <div class="stat" style="cursor:pointer" (click)="expFilter = 'soon'"><span>Akan Expired (&lt; 90 Hari)</span><b>{{ countNearExpiry() }}</b></div>
        <div class="stat" style="cursor:pointer" (click)="expFilter = 'quarantine'"><span>Karantina / Musnah</span><b>{{ countQuarantine() }}</b></div>
      </div>

      <div class="panel">
        <h2>Tracking Batch & Tanggal Kadaluarsa (FEFO)</h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. Batch</th><th>Kode KFA</th><th>Nama Barang</th><th>Lokasi</th><th>Rak</th><th>Expired Date</th><th class="num">Qty</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (b of filteredBatches; track b.id) {
                <tr>
                  <td><code>{{ b.batchNo }}</code></td>
                  <td><code>{{ b.code }}</code></td>
                  <td><b>{{ b.name }}</b></td>
                  <td>{{ b.location }}</td>
                  <td>{{ b.rack }}</td>
                  <td><span class="pill" [ngClass]="isNearExpiry(b.expiredDate) ? 'bad' : 'ok'">{{ b.expiredDate }}</span></td>
                  <td class="num"><b>{{ b.qty }}</b></td>
                  <td><span class="pill" [ngClass]="b.status === 'Tersedia' ? 'ok' : 'bad'">{{ b.status }}</span></td>
                  <td>
                    @if (b.status !== 'Dimusnahkan') {
                      <button class="ib btn-sm danger" type="button" (click)="quarantineBatch(b)">
                        {{ b.status === 'Tersedia' ? 'Karantina' : 'Musnahkan' }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'gudang-pusat') {
      <div class="two">
        @for (s of coldChainSensors; track s.unit) {
          <div class="panel">
            <h2>Sensor Suhu & Kelembapan: {{ s.unit }}</h2>
            <div class="row"><span>Suhu Terukur</span><b style="font-size:18px">{{ s.tempC }}°C</b></div>
            <div class="row"><span>Rentang Standar</span><span>{{ s.targetRange }} · RH {{ s.humidity }}</span></div>
            <div class="row"><span>Status</span><span class="pill ok">{{ s.status }}</span></div>
          </div>
        }
      </div>

      <div class="panel">
        <h2>Kartu Stok & Pergerakan Gudang Pusat</h2>
        <div class="tw">
          <table>
            <thead><tr><th>Waktu</th><th>Ref</th><th>Kode</th><th>Nama Barang</th><th>Batch</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Saldo Batch</th></tr></thead>
            <tbody>
              @for (m of movements; track m.id) {
                <tr>
                  <td>{{ m.date }}</td>
                  <td>{{ m.refType }} · <code>{{ m.refNo }}</code></td>
                  <td><code>{{ m.code }}</code></td>
                  <td><b>{{ m.name }}</b></td>
                  <td><code>{{ m.batchNo }}</code></td>
                  <td class="num">{{ m.qtyIn }}</td>
                  <td class="num">{{ m.qtyOut }}</td>
                  <td class="num"><b>{{ m.balanceAfter }}</b></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `
})
export class InventoryPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly router = inject(Router);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'master-barang-kfa';
  kfaItems: InventoryKfaItem[] = [];
  kfaSearch = '';
  showKfaDrawer = false;
  editingKfaCode: string | null = null;
  kfaForm = { code: '', name: '', category: 'Antibiotik', unit: 'Tablet', centralStock: 1000, minStock: 300, hnaPrice: 1500, hetPrice: 2000, isNarcotic: false };

  consolidatedLocations: string[] = [];
  consolidatedItems: ConsolidatedItem[] = [];

  mutTab: 'requests' | 'mutations' = 'requests';
  stockRequests: StockRequestItem[] = [];
  mutations: MutationItem[] = [];
  showMutationDrawer = false;
  mutForm = { fromLocation: 'Gudang Pusat', toLocation: 'Klinik Utama', itemCode: 'KFA-93001', qty: 100 };

  opnames: OpnameItem[] = [];
  showOpnameDrawer = false;
  opnForm = { location: 'Gudang Pusat', code: 'KFA-93001', physicalQty: 4500, reason: 'Stok opname bulanan' };

  batches: BatchItem[] = [];
  expFilter: 'all' | 'soon' | 'quarantine' = 'all';

  coldChainSensors: Array<{ unit: string; tempC: number; targetRange: string; humidity: string; status: string }> = [];
  movements: Array<{ id: string; date: string; code: string; name: string; batchNo: string; refType: string; refNo: string; qtyIn: number; qtyOut: number; balanceAfter: number }> = [];

  kfaPage = 1;
  pageSize = 10;

  get filteredKfa(): InventoryKfaItem[] {
    return filterRows(this.kfaItems, this.kfaSearch);
  }

  get pagedKfa(): InventoryKfaItem[] {
    return paginateRows(this.filteredKfa, this.kfaPage, this.pageSize);
  }

  get totalStockValuation(): number {
    return this.consolidatedItems.reduce((s, c) => s + Number(c.valuationRp || 0), 0);
  }

  get lowStockCount(): number {
    return this.consolidatedItems.filter((c) => c.isLowStock).length;
  }

  get filteredBatches(): BatchItem[] {
    return this.batches.filter((b) => {
      if (this.expFilter === 'soon') return this.isNearExpiry(b.expiredDate);
      if (this.expFilter === 'quarantine') return b.status !== 'Tersedia';
      return true;
    });
  }

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'master-barang-kfa';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    this.http.get<InventoryKfaItem[]>(`${this.state.apiBase}/inventory`).subscribe({ next: (l) => (this.kfaItems = l || []) });
    if (this.sub === 'stok-konsolidasi') {
      this.http.get<{ locations: string[]; items: ConsolidatedItem[] }>(`${this.state.apiBase}/inventory/consolidated`).subscribe({
        next: (res) => {
          this.consolidatedLocations = res.locations || [];
          this.consolidatedItems = res.items || [];
        }
      });
    } else if (this.sub === 'mutasi-antar-outlet') {
      this.http.get<{ requests: StockRequestItem[]; mutations: MutationItem[] }>(`${this.state.apiBase}/inventory/mutations`).subscribe({
        next: (res) => {
          this.stockRequests = res.requests || [];
          this.mutations = res.mutations || [];
        }
      });
    } else if (this.sub === 'stok-opname') {
      this.http.get<OpnameItem[]>(`${this.state.apiBase}/inventory/opnames`).subscribe({ next: (l) => (this.opnames = l || []) });
    } else if (this.sub === 'batch-expired') {
      this.http.get<BatchItem[]>(`${this.state.apiBase}/inventory/batches`).subscribe({ next: (l) => (this.batches = l || []) });
    } else if (this.sub === 'gudang-pusat') {
      this.http
        .get<{
          coldChainSensors: Array<{ unit: string; tempC: number; targetRange: string; humidity: string; status: string }>;
          movements: Array<{ id: string; date: string; code: string; name: string; batchNo: string; refType: string; refNo: string; qtyIn: number; qtyOut: number; balanceAfter: number }>;
        }>(`${this.state.apiBase}/inventory/warehouse`)
        .subscribe({
          next: (res) => {
            this.coldChainSensors = res.coldChainSensors || [];
            this.movements = res.movements || [];
          }
        });
    }
  }

  openKfaDrawer(item?: InventoryKfaItem): void {
    this.editingKfaCode = item?.code || null;
    this.kfaForm = item
      ? {
          code: item.code,
          name: item.name,
          category: item.category,
          unit: item.unit,
          centralStock: item.centralStock,
          minStock: item.minStock || 200,
          hnaPrice: item.hnaPrice || 1500,
          hetPrice: item.hetPrice || 2000,
          isNarcotic: Boolean(item.isNarcotic)
        }
      : { code: '', name: '', category: 'Antibiotik', unit: 'Tablet', centralStock: 1000, minStock: 300, hnaPrice: 1500, hetPrice: 2000, isNarcotic: false };
    this.showKfaDrawer = true;
  }

  saveKfa(): void {
    if (this.editingKfaCode) {
      this.http.put<InventoryKfaItem>(`${this.state.apiBase}/inventory/${this.editingKfaCode}`, this.kfaForm).subscribe({
        next: (updated) => {
          this.kfaItems = this.kfaItems.map((x) => (x.code === updated.code ? updated : x));
          this.showKfaDrawer = false;
          this.state.showToast(`Master KFA ${updated.name} diperbarui`);
        }
      });
      return;
    }
    this.http.post<InventoryKfaItem>(`${this.state.apiBase}/inventory`, this.kfaForm).subscribe({
      next: (created) => {
        this.kfaItems = [created, ...this.kfaItems];
        this.showKfaDrawer = false;
        this.state.showToast(`Master KFA ${created.name} ditambahkan & disinkronkan`);
      }
    });
  }

  approveRequest(req: StockRequestItem): void {
    this.http.post(`${this.state.apiBase}/stock-requests/approve`, { reqId: req.reqId }).subscribe({
      next: () => {
        req.status = 'Dikirim ke Cabang';
        this.state.showToast(`Stok ${req.itemName} (${req.qty} unit) dikirim dengan batch FEFO ke ${req.outletName}`);
        this.loadAll();
      }
    });
  }

  createMutation(): void {
    this.http.post<MutationItem>(`${this.state.apiBase}/inventory/mutations`, this.mutForm).subscribe({
      next: (mut) => {
        this.mutations = [mut, ...this.mutations];
        this.showMutationDrawer = false;
        this.state.showToast(`Mutasi ${mut.itemName} ke ${mut.toLocation} dikirim`);
      },
      error: (err) => this.state.showToast(err?.error?.message || 'Gagal membuat mutasi')
    });
  }

  createOpname(): void {
    this.http.post<OpnameItem>(`${this.state.apiBase}/inventory/opnames`, this.opnForm).subscribe({
      next: (opn) => {
        this.opnames = [opn, ...this.opnames];
        this.showOpnameDrawer = false;
        this.state.showToast(`Stok opname ${opn.id} disimpan`);
      }
    });
  }

  approveOpname(o: OpnameItem): void {
    this.http.post<OpnameItem>(`${this.state.apiBase}/inventory/opnames/${o.id}/approve`, {}).subscribe({
      next: (updated) => {
        o.status = updated.status;
        this.state.showToast(`Stok opname ${o.id} disetujui & saldo disesuaikan`);
      }
    });
  }

  isNearExpiry(dateStr: string): boolean {
    const exp = new Date(dateStr).getTime();
    const diffDays = (exp - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays <= 90;
  }

  countNearExpiry(): number {
    return this.batches.filter((b) => this.isNearExpiry(b.expiredDate)).length;
  }

  countQuarantine(): number {
    return this.batches.filter((b) => b.status !== 'Tersedia').length;
  }

  quarantineBatch(b: BatchItem): void {
    this.http.post<BatchItem>(`${this.state.apiBase}/inventory/batches/${b.id}/quarantine`, {}).subscribe({
      next: (updated) => {
        b.status = updated.status;
        this.state.showToast(`Batch ${b.batchNo} diubah statusnya menjadi ${updated.status}`);
      }
    });
  }
}
