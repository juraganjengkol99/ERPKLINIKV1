import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { SlideDrawerComponent } from '../../shared/components/slide-drawer.component';
import { IdrPipe } from '../../shared/pipes/idr.pipe';
import { PrFormComponent } from './forms/pr-form.component';
import { PoFormComponent } from './forms/po-form.component';
import { ReturnFormComponent } from './forms/return-form.component';
import { SupplierFormComponent } from './forms/supplier-form.component';

interface SupplierItem {
  id: string;
  name: string;
  npwp: string;
  pbfLicense: string;
  pic: string;
  phone: string;
  email: string;
  paymentTerms: string;
  status: string;
}

interface PrItem {
  id: string;
  date: string;
  requestedBy: string;
  itemCode: string;
  itemName: string;
  qty: number;
  reason: string;
  status: string;
}

interface PoItem {
  poNumber: string;
  orderDate?: string;
  supplierId?: string;
  supplier: string;
  items: string;
  totalRp: number;
  total: string;
  target: string;
  status: string;
  lines?: Array<{ code: string; name: string; qty: number; priceRp: number }>;
}

interface GrnItem {
  grnNo: string;
  poNumber: string;
  supplier: string;
  invoiceNo: string;
  receivedDate: string;
  dueDate: string;
  totalRp: number;
  status: string;
}

interface ReturnItem {
  id: string;
  date: string;
  supplier: string;
  grnNo: string;
  itemName: string;
  batchNo: string;
  qty: number;
  reason: string;
  resolution: string;
  status: string;
}

@Component({
  selector: 'app-purchasing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SlideDrawerComponent, IdrPipe, PrFormComponent, PoFormComponent, ReturnFormComponent, SupplierFormComponent],
  template: `
    @if (sub === 'permintaan-pembelian') {
      @if (showPrDrawer) {
        <app-pr-form [model]="prForm" (submitted)="createPr()" (cancelled)="showPrDrawer = false" />
      }
      <div class="panel">
        <h2>
          Permintaan Pembelian (Purchase Requisition)
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showPrDrawer = true">+ Buat PR Baru</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. PR</th><th>Tanggal</th><th>Pemohon</th><th>Kode KFA</th><th>Nama Item</th><th class="num">Qty</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (pr of prs; track pr.id) {
                <tr>
                  <td><code>{{ pr.id }}</code></td>
                  <td>{{ pr.date }}</td>
                  <td>{{ pr.requestedBy }}</td>
                  <td><code>{{ pr.itemCode }}</code></td>
                  <td><b>{{ pr.itemName }}</b></td>
                  <td class="num">{{ pr.qty }}</td>
                  <td class="wrap-cell">{{ pr.reason }}</td>
                  <td><span class="pill" [ngClass]="pr.status === 'Sudah Jadi PO' ? 'ok' : 'warn'">{{ pr.status }}</span></td>
                  <td>
                    @if (pr.status !== 'Sudah Jadi PO') {
                      <button class="btn btn-sm" type="button" (click)="convertPrToPo(pr)">Konversi ke PO</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'purchase-order') {
      @if (showPoDrawer) {
        <app-po-form [model]="poForm" [suppliers]="suppliers" [outlets]="state.outlets()" (submitted)="createPo()" (cancelled)="showPoDrawer = false" />
      }
      <div class="panel">
        <h2>
          Daftar Purchase Order (PO) ke PBF & Supplier
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showPoDrawer = true">+ Buat PO Baru</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. PO</th><th>Tanggal</th><th>Supplier</th><th>Item</th><th>Tujuan</th><th class="num">Total (Inc. PPN)</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (po of pos; track po.poNumber) {
                <tr>
                  <td><b>{{ po.poNumber }}</b></td>
                  <td>{{ po.orderDate || '-' }}</td>
                  <td>{{ po.supplier }}</td>
                  <td class="wrap-cell">{{ po.items }}</td>
                  <td>{{ po.target }}</td>
                  <td class="num"><b>{{ po.totalRp | idr }}</b></td>
                  <td><span class="pill" [ngClass]="po.status.includes('Diterima') ? 'ok' : po.status === 'Menunggu Approval' ? 'warn' : 'info'">{{ po.status }}</span></td>
                  <td>
                    @if (po.status === 'Menunggu Approval') {
                      <button class="btn btn-sm" type="button" (click)="approvePo(po, 'Dikirim')">Approve & Kirim</button>
                    }
                    <button class="ib btn-sm" type="button" (click)="detailPo = po">Detail</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'penerimaan-barang') {
      <div class="panel">
        <h2>Terima Barang dari PO Aktif (GRN → Batch Inventory + Hutang Supplier + Jurnal)</h2>
        <div class="form">
          <label>
            Pilih PO Siap Diterima
            <select [(ngModel)]="grnForm.poNumber">
              @for (po of receivablePos; track po.poNumber) {
                <option [value]="po.poNumber">{{ po.poNumber }} — {{ po.supplier }} ({{ po.total }})</option>
              }
            </select>
          </label>
          <label>No. Faktur Supplier <input [(ngModel)]="grnForm.invoiceNo" placeholder="FAK-2026-0091" /></label>
          <label>Jatuh Tempo Faktur <input type="date" [(ngModel)]="grnForm.dueDate" /></label>
          <label>
            &nbsp;
            <button class="btn" type="button" [disabled]="receivablePos.length === 0" (click)="submitGrn()">Proses Penerimaan (GRN)</button>
          </label>
        </div>
      </div>

      <div class="panel">
        <h2>Riwayat Goods Receipt Note (GRN)</h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. GRN</th><th>No. PO</th><th>Supplier</th><th>No. Faktur</th><th>Tgl Terima</th><th>Jatuh Tempo</th><th class="num">Total Faktur</th><th>Status</th></tr></thead>
            <tbody>
              @for (g of grns; track g.grnNo) {
                <tr>
                  <td><code>{{ g.grnNo }}</code></td>
                  <td><code>{{ g.poNumber }}</code></td>
                  <td><b>{{ g.supplier }}</b></td>
                  <td>{{ g.invoiceNo }}</td>
                  <td>{{ g.receivedDate }}</td>
                  <td>{{ g.dueDate }}</td>
                  <td class="num"><b>{{ g.totalRp | idr }}</b></td>
                  <td><span class="pill ok">{{ g.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'retur-pembelian') {
      @if (showReturnDrawer) {
        <app-return-form [model]="retForm" (submitted)="createReturn()" (cancelled)="showReturnDrawer = false" />
      }
      <div class="panel">
        <h2>
          Retur Pembelian ke Supplier
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showReturnDrawer = true">+ Buat Retur</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. Retur</th><th>Tanggal</th><th>Supplier</th><th>Barang</th><th>Batch</th><th class="num">Qty</th><th>Alasan</th><th>Penyelesaian</th><th>Status</th></tr></thead>
            <tbody>
              @for (r of returns; track r.id) {
                <tr>
                  <td><code>{{ r.id }}</code></td>
                  <td>{{ r.date }}</td>
                  <td>{{ r.supplier }}</td>
                  <td><b>{{ r.itemName }}</b></td>
                  <td><code>{{ r.batchNo }}</code></td>
                  <td class="num">{{ r.qty }}</td>
                  <td class="wrap-cell">{{ r.reason }}</td>
                  <td>{{ r.resolution }}</td>
                  <td><span class="pill info">{{ r.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'master-supplier') {
      @if (showSupplierDrawer) {
        <app-supplier-form [model]="supForm" (submitted)="createSupplier()" (cancelled)="showSupplierDrawer = false" />
      }
      <div class="panel">
        <h2>
          Direktori Master Supplier & PBF Farmasi
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showSupplierDrawer = true">+ Tambah Supplier</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>ID</th><th>Nama PT / Supplier</th><th>No. Izin PBF</th><th>NPWP</th><th>PIC & Kontak</th><th>Termin</th><th>Status</th></tr></thead>
            <tbody>
              @for (s of suppliers; track s.id) {
                <tr>
                  <td><code>{{ s.id }}</code></td>
                  <td><b>{{ s.name }}</b></td>
                  <td><code>{{ s.pbfLicense }}</code></td>
                  <td>{{ s.npwp }}</td>
                  <td>{{ s.pic }} · {{ s.phone }}</td>
                  <td><span class="pill info">{{ s.paymentTerms }}</span></td>
                  <td><span class="pill ok">{{ s.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <app-slide-drawer [open]="!!detailPo" [title]="'Detail ' + (detailPo?.poNumber || '')" [subtitle]="detailPo?.supplier || ''" (closed)="detailPo = null">
      @if (detailPo; as po) {
        <div class="row"><span>Tujuan</span><b>{{ po.target }}</b></div>
        <div class="row"><span>Status</span><span class="pill info">{{ po.status }}</span></div>
        <div class="row"><span>Total (+PPN)</span><b>{{ po.totalRp | idr }}</b></div>
        <div class="tw" style="margin-top:12px">
          <table>
            <thead><tr><th>Kode</th><th>Item</th><th class="num">Qty</th><th class="num">Harga</th></tr></thead>
            <tbody>
              @for (l of po.lines || []; track l.code) {
                <tr><td><code>{{ l.code }}</code></td><td>{{ l.name }}</td><td class="num">{{ l.qty }}</td><td class="num">{{ l.priceRp | idr }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-slide-drawer>
  `
})
export class PurchasingPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'permintaan-pembelian';
  prs: PrItem[] = [];
  pos: PoItem[] = [];
  grns: GrnItem[] = [];
  returns: ReturnItem[] = [];
  suppliers: SupplierItem[] = [];

  showPrDrawer = false;
  prForm = { itemCode: 'KFA-93005', qty: 500, reason: 'Penambahan buffer stok Gudang Pusat' };

  showPoDrawer = false;
  detailPo: PoItem | null = null;
  poForm = { supplierId: 'SUP-01', target: 'Gudang Pusat', itemCode: 'KFA-93001', itemName: 'Amoxicillin 500mg Kaplet', qty: 1000, priceRp: 1200 };

  grnForm = { poNumber: '', invoiceNo: '', dueDate: '2026-12-27' };

  showReturnDrawer = false;
  retForm = { supplier: 'PT Kimia Farma Trading', itemCode: 'KFA-93001', itemName: 'Amoxicillin 500mg Kaplet', batchNo: 'AMX-2601A', qty: 20, reason: 'Kemasan rusak' };

  showSupplierDrawer = false;
  supForm = { name: '', pbfLicense: '', npwp: '', pic: '', phone: '', paymentTerms: 'TOP 30' };

  get receivablePos(): PoItem[] {
    return this.pos.filter((p) => p.status === 'Disetujui' || p.status === 'Dikirim');
  }

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'permintaan-pembelian';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    this.http.get<SupplierItem[]>(`${this.state.apiBase}/purchasing/suppliers`).subscribe({ next: (l) => (this.suppliers = l || []) });
    this.http.get<PrItem[]>(`${this.state.apiBase}/purchasing/prs`).subscribe({ next: (l) => (this.prs = l || []) });
    this.http.get<PoItem[]>(`${this.state.apiBase}/purchasing/pos`).subscribe({
      next: (l) => {
        this.pos = l || [];
        if (this.receivablePos.length > 0 && !this.grnForm.poNumber) {
          this.grnForm.poNumber = this.receivablePos[0].poNumber;
        }
      }
    });
    this.http.get<GrnItem[]>(`${this.state.apiBase}/purchasing/receipts`).subscribe({ next: (l) => (this.grns = l || []) });
    this.http.get<ReturnItem[]>(`${this.state.apiBase}/purchasing/returns`).subscribe({ next: (l) => (this.returns = l || []) });
  }

  createPr(): void {
    this.http.post<PrItem>(`${this.state.apiBase}/purchasing/prs`, this.prForm).subscribe({
      next: (created) => {
        this.prs = [created, ...this.prs];
        this.showPrDrawer = false;
        this.state.showToast(`PR ${created.id} dibuat`);
      }
    });
  }

  convertPrToPo(pr: PrItem): void {
    this.http.post<PoItem>(`${this.state.apiBase}/purchasing/prs/${pr.id}/convert-po`, {}).subscribe({
      next: (po) => {
        pr.status = 'Sudah Jadi PO';
        this.pos = [po, ...this.pos];
        this.state.showToast(`PR ${pr.id} dikonversi menjadi ${po.poNumber}`);
      }
    });
  }

  createPo(): void {
    this.http
      .post<PoItem>(`${this.state.apiBase}/purchasing/pos`, {
        supplierId: this.poForm.supplierId,
        target: this.poForm.target,
        lines: [{ code: this.poForm.itemCode, name: this.poForm.itemName, qty: this.poForm.qty, priceRp: this.poForm.priceRp }]
      })
      .subscribe({
        next: (created) => {
          this.pos = [created, ...this.pos];
          this.showPoDrawer = false;
          this.state.showToast(`PO ${created.poNumber} dibuat`);
        }
      });
  }

  approvePo(po: PoItem, status: string): void {
    this.http.post<PoItem>(`${this.state.apiBase}/purchasing/pos/${po.poNumber}/approve`, { status }).subscribe({
      next: (updated) => {
        po.status = updated.status;
        this.state.showToast(`PO ${po.poNumber} disetujui & dikirim ke supplier`);
      }
    });
  }

  submitGrn(): void {
    this.http.post<GrnItem>(`${this.state.apiBase}/purchasing/receipts`, this.grnForm).subscribe({
      next: (grn) => {
        this.grns = [grn, ...this.grns];
        this.state.showToast(`GRN ${grn.grnNo} berhasil! Stok batch & Hutang Supplier otomatis tercatat.`);
        this.loadAll();
      }
    });
  }

  createReturn(): void {
    this.http.post<ReturnItem>(`${this.state.apiBase}/purchasing/returns`, this.retForm).subscribe({
      next: (created) => {
        this.returns = [created, ...this.returns];
        this.showReturnDrawer = false;
        this.state.showToast(`Retur ${created.id} dibuat & stok batch dikurangi`);
      }
    });
  }

  createSupplier(): void {
    this.http.post<SupplierItem>(`${this.state.apiBase}/purchasing/suppliers`, this.supForm).subscribe({
      next: (created) => {
        this.suppliers = [created, ...this.suppliers];
        this.showSupplierDrawer = false;
        this.state.showToast(`Supplier ${created.name} ditambahkan`);
      }
    });
  }
}
