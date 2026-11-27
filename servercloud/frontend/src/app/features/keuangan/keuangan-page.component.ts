import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { IdrPipe } from '../../shared/pipes/idr.pipe';
import { AccountFormComponent } from './forms/account-form.component';
import { TransferFormComponent } from './forms/transfer-form.component';
import { ReceiptFormComponent } from './forms/receipt-form.component';
import { ExpenseFormComponent } from './forms/expense-form.component';
import { BudgetFormComponent } from './forms/budget-form.component';

interface CashAccount {
  id: string;
  name: string;
  type: string;
  outlet: string;
  accountNo: string;
  balanceRp: number;
}

interface CashTx {
  id: string;
  date: string;
  type: string;
  accountId: string;
  outlet: string;
  category: string;
  paymentMethod: string;
  description: string;
  amountRp: number;
  status: string;
}

interface ReceivableItem {
  claimNo: string;
  outlet: string;
  program: string;
  totalCases: number;
  amountMillions: number;
  paidMillions?: number;
  agingDays?: number;
  dueDate?: string;
  status: string;
}

interface PayableItem {
  id: string;
  invoiceNo: string;
  supplier: string;
  grnNo: string;
  dueDate: string;
  totalRp: number;
  paidRp: number;
  agingBucket: string;
  status: string;
}

interface BudgetItem {
  id: string;
  period: string;
  outlet: string;
  accountCode: string;
  budgetRp: number;
  actualRp: number;
}

interface ReconciliationItem {
  id: string;
  date: string;
  outlet: string;
  shift: string;
  localCashRp: number;
  localDigitalRp: number;
  bankMutationRp: number;
  varianceRp: number;
  status: string;
}

@Component({
  selector: 'app-keuangan-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IdrPipe,
    AccountFormComponent,
    TransferFormComponent,
    ReceiptFormComponent,
    ExpenseFormComponent,
    BudgetFormComponent
  ],
  template: `
    @if (sub === 'kas-bank') {
      @if (showAccountDrawer) {
        <app-account-form [model]="accForm" (submitted)="createAccount()" (cancelled)="showAccountDrawer = false" />
      }
      @if (showTransferDrawer) {
        <app-transfer-form [model]="trfForm" [accounts]="accounts" (submitted)="submitTransfer()" (cancelled)="showTransferDrawer = false" />
      }
      <div class="stats">
        <div class="stat"><span>Total Likuiditas Kas & Bank</span><b>{{ totalLiquidity | idr }}</b></div>
        <div class="stat"><span>Jumlah Rekening Aktif</span><b>{{ accounts.length }}</b></div>
        <div class="stat"><span>Transaksi Tercatat</span><b>{{ transactions.length }}</b></div>
      </div>

      <div class="panel">
        <h2>
          Daftar Rekening Kas Cabang & Bank Pusat
          <span class="sp"></span>
          <button class="ib btn-sm" type="button" (click)="showAccountDrawer = true">+ Tambah Rekening</button>
          <button class="btn btn-sm" type="button" (click)="showTransferDrawer = true">Transfer Antar Kas/Bank</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>Nama Rekening</th><th>Tipe</th><th>Outlet</th><th>No. Rekening / Kode</th><th class="num">Saldo Saat Ini</th></tr></thead>
            <tbody>
              @for (a of accounts; track a.id) {
                <tr>
                  <td><b>{{ a.name }}</b></td>
                  <td><span class="pill info">{{ a.type }}</span></td>
                  <td>{{ a.outlet }}</td>
                  <td><code>{{ a.accountNo }}</code></td>
                  <td class="num"><b>{{ a.balanceRp | idr }}</b></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h2>Mutasi Kas & Bank Terbaru</h2>
        <div class="tw">
          <table>
            <thead><tr><th>Tanggal</th><th>Jenis</th><th>Outlet</th><th>Kategori</th><th>Keterangan</th><th class="num">Nominal</th><th>Status</th></tr></thead>
            <tbody>
              @for (t of transactions; track t.id) {
                <tr>
                  <td>{{ t.date }}</td>
                  <td><span class="pill" [ngClass]="t.type === 'Penerimaan' ? 'ok' : t.type === 'Pengeluaran' ? 'bad' : 'info'">{{ t.type }}</span></td>
                  <td>{{ t.outlet }}</td>
                  <td>{{ t.category }}</td>
                  <td class="wrap-cell">{{ t.description }}</td>
                  <td class="num"><b>{{ t.amountRp | idr }}</b></td>
                  <td><span class="pill ok">{{ t.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'penerimaan') {
      @if (showReceiptDrawer) {
        <app-receipt-form [model]="recForm" [accounts]="accounts" (submitted)="createReceipt()" (cancelled)="showReceiptDrawer = false" />
      }
      <div class="panel">
        <h2>
          Arus Kas Masuk (Auto-Sync Kasir Cabang + Penerimaan Manual)
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showReceiptDrawer = true">+ Catat Penerimaan</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>ID</th><th>Tanggal</th><th>Cabang</th><th>Kategori</th><th>Metode</th><th>Keterangan</th><th class="num">Nominal</th><th>Status</th></tr></thead>
            <tbody>
              @for (r of receipts; track r.id) {
                <tr>
                  <td><code>{{ r.id }}</code></td>
                  <td>{{ r.date }}</td>
                  <td><b>{{ r.outlet }}</b></td>
                  <td>{{ r.category }}</td>
                  <td>{{ r.paymentMethod }}</td>
                  <td class="wrap-cell">{{ r.description }}</td>
                  <td class="num"><b>{{ r.amountRp | idr }}</b></td>
                  <td><span class="pill ok">{{ r.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'pengeluaran') {
      @if (showExpenseDrawer) {
        <app-expense-form [model]="expForm" [accounts]="accounts" (submitted)="createExpense()" (cancelled)="showExpenseDrawer = false" />
      }
      <div class="panel">
        <h2>
          Voucher Pengeluaran & Approval Pembayaran
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showExpenseDrawer = true">+ Ajukan Pengeluaran</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>ID</th><th>Tanggal</th><th>Cabang</th><th>Kategori</th><th>Keterangan</th><th class="num">Nominal</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (e of expenses; track e.id) {
                <tr>
                  <td><code>{{ e.id }}</code></td>
                  <td>{{ e.date }}</td>
                  <td>{{ e.outlet }}</td>
                  <td>{{ e.category }}</td>
                  <td class="wrap-cell">{{ e.description }}</td>
                  <td class="num"><b>{{ e.amountRp | idr }}</b></td>
                  <td><span class="pill" [ngClass]="e.status === 'Dibayar' ? 'ok' : 'warn'">{{ e.status }}</span></td>
                  <td>
                    @if (e.status !== 'Dibayar') {
                      <button class="btn btn-sm" type="button" (click)="payExpense(e)">Approve & Bayar</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'piutang-bpjs-asuransi') {
      <div class="panel">
        <h2>Piutang & Penagihan Klaim BPJS / Asuransi (VClaim · P-Care · PRB)</h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. Klaim</th><th>Cabang</th><th>Program</th><th class="num">Berkas</th><th class="num">Tagihan (jt)</th><th class="num">Sudah Cair (jt)</th><th class="num">Aging</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (c of receivables; track c.claimNo) {
                <tr>
                  <td><code>{{ c.claimNo }}</code></td>
                  <td><b>{{ c.outlet }}</b></td>
                  <td>{{ c.program }}</td>
                  <td class="num">{{ c.totalCases }}</td>
                  <td class="num">Rp {{ c.amountMillions.toFixed(1).replace('.', ',') }} jt</td>
                  <td class="num">Rp {{ (c.paidMillions || 0).toFixed(1).replace('.', ',') }} jt</td>
                  <td class="num">{{ c.agingDays || 0 }} hr</td>
                  <td><span class="pill" [ngClass]="c.status === 'Lunas Cair' ? 'ok' : 'info'">{{ c.status }}</span></td>
                  <td>
                    @if (c.status !== 'Lunas Cair') {
                      <button class="btn btn-sm" type="button" (click)="settleClaim(c)">Catat Cair Penuh</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'hutang-supplier') {
      <div class="panel">
        <h2>Hutang Dagang Supplier Farmasi (Auto dari Penerimaan Barang / GRN)</h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. Faktur</th><th>Supplier</th><th>Ref GRN</th><th>Jatuh Tempo</th><th>Aging</th><th class="num">Total Faktur</th><th class="num">Terbayar</th><th class="num">Sisa Hutang</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (ap of payables; track ap.id) {
                <tr>
                  <td><code>{{ ap.invoiceNo }}</code></td>
                  <td><b>{{ ap.supplier }}</b></td>
                  <td><code>{{ ap.grnNo }}</code></td>
                  <td>{{ ap.dueDate }}</td>
                  <td><span class="pill info">{{ ap.agingBucket }}</span></td>
                  <td class="num">{{ ap.totalRp | idr }}</td>
                  <td class="num">{{ ap.paidRp | idr }}</td>
                  <td class="num"><b>{{ (ap.totalRp - ap.paidRp) | idr }}</b></td>
                  <td><span class="pill" [ngClass]="ap.status === 'Lunas' ? 'ok' : 'warn'">{{ ap.status }}</span></td>
                  <td>
                    @if (ap.status !== 'Lunas') {
                      <button class="btn btn-sm" type="button" (click)="paySupplier(ap)">Lunasi</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'anggaran') {
      @if (showBudgetDrawer) {
        <app-budget-form [model]="bdgForm" (submitted)="createBudget()" (cancelled)="showBudgetDrawer = false" />
      }
      <div class="panel">
        <h2>
          Anggaran vs Realisasi Operasional Cabang
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showBudgetDrawer = true">+ Tambah Anggaran</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>Periode</th><th>Outlet</th><th>Pos Akun</th><th class="num">Target Anggaran</th><th class="num">Realisasi</th><th>Serapan</th></tr></thead>
            <tbody>
              @for (b of budgets; track b.id) {
                <tr>
                  <td>{{ b.period }}</td>
                  <td><b>{{ b.outlet }}</b></td>
                  <td>{{ b.accountCode }}</td>
                  <td class="num">{{ b.budgetRp | idr }}</td>
                  <td class="num">{{ b.actualRp | idr }}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <div class="progress-track">
                        <div class="progress-fill" [class.warn]="budgetPct(b) >= 85 && budgetPct(b) <= 100" [class.bad]="budgetPct(b) > 100" [style.width.%]="Math.min(100, budgetPct(b))"></div>
                      </div>
                      <span><b>{{ budgetPct(b) }}%</b></span>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'rekonsiliasi-setoran') {
      <div class="panel">
        <h2>Rekonsiliasi Setoran Tutup Kasir Cabang vs Mutasi Bank Pusat</h2>
        <div class="tw">
          <table>
            <thead><tr><th>Tanggal</th><th>Cabang</th><th>Shift</th><th class="num">Tunai Lokal</th><th class="num">QRIS/EDC</th><th class="num">Mutasi Bank</th><th class="num">Selisih</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (r of reconciliations; track r.id) {
                <tr>
                  <td>{{ r.date }}</td>
                  <td><b>{{ r.outlet }}</b></td>
                  <td>{{ r.shift }}</td>
                  <td class="num">{{ r.localCashRp | idr }}</td>
                  <td class="num">{{ r.localDigitalRp | idr }}</td>
                  <td class="num">{{ r.bankMutationRp | idr }}</td>
                  <td class="num"><span class="pill" [ngClass]="r.varianceRp === 0 ? 'ok' : 'bad'">{{ r.varianceRp | idr }}</span></td>
                  <td><span class="pill" [ngClass]="r.status === 'Sesuai' ? 'ok' : r.status === 'Ada Selisih' ? 'bad' : 'warn'">{{ r.status }}</span></td>
                  <td>
                    @if (r.status !== 'Sesuai') {
                      <button class="btn btn-sm" type="button" (click)="verifyRecon(r)">Verifikasi Cocok</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `
})
export class KeuanganPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;
  readonly Math = Math;

  sub = 'kas-bank';
  accounts: CashAccount[] = [];
  transactions: CashTx[] = [];
  receipts: CashTx[] = [];
  expenses: CashTx[] = [];
  receivables: ReceivableItem[] = [];
  payables: PayableItem[] = [];
  budgets: BudgetItem[] = [];
  reconciliations: ReconciliationItem[] = [];

  showAccountDrawer = false;
  accForm = { name: '', type: 'Bank', outlet: 'Pusat (Cloud VPS)', accountNo: '', balanceRp: 0 };

  showTransferDrawer = false;
  trfForm = { fromAccountId: 'ACC-KU-KAS', toAccountId: 'ACC-HQ-BCA', amountRp: 5000000, description: 'Setoran kas cabang ke rekening pusat' };

  showReceiptDrawer = false;
  recForm = { accountId: 'ACC-HQ-BCA', category: 'Penerimaan Non-Medis', description: 'Pendapatan sewa kantin / mitra', amountRp: 2500000 };

  showExpenseDrawer = false;
  expForm = { accountId: 'ACC-HQ-BCA', outlet: 'Pusat (Cloud VPS)', category: 'Listrik & Internet', description: 'Tagihan utilitas bulanan', amountRp: 3200000 };

  showBudgetDrawer = false;
  bdgForm = { period: '2026-11', outlet: 'Klinik Utama', accountCode: '6101 - Beban Operasional', budgetRp: 25000000 };

  get totalLiquidity(): number {
    return this.accounts.reduce((s, a) => s + Number(a.balanceRp || 0), 0);
  }

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'kas-bank';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    this.http.get<{ accounts: CashAccount[]; transactions: CashTx[] }>(`${this.state.apiBase}/finance/accounts`).subscribe({
      next: (res) => {
        this.accounts = res.accounts || [];
        this.transactions = res.transactions || [];
      }
    });
    if (this.sub === 'penerimaan') {
      this.http.get<CashTx[]>(`${this.state.apiBase}/finance/receipts`).subscribe({ next: (l) => (this.receipts = l || []) });
    } else if (this.sub === 'pengeluaran') {
      this.http.get<CashTx[]>(`${this.state.apiBase}/finance/expenses`).subscribe({ next: (l) => (this.expenses = l || []) });
    } else if (this.sub === 'piutang-bpjs-asuransi') {
      this.http.get<ReceivableItem[]>(`${this.state.apiBase}/finance/receivables`).subscribe({ next: (l) => (this.receivables = l || []) });
    } else if (this.sub === 'hutang-supplier') {
      this.http.get<PayableItem[]>(`${this.state.apiBase}/finance/payables`).subscribe({ next: (l) => (this.payables = l || []) });
    } else if (this.sub === 'anggaran') {
      this.http.get<BudgetItem[]>(`${this.state.apiBase}/finance/budgets`).subscribe({ next: (l) => (this.budgets = l || []) });
    } else if (this.sub === 'rekonsiliasi-setoran') {
      this.http.get<ReconciliationItem[]>(`${this.state.apiBase}/finance/reconciliations`).subscribe({ next: (l) => (this.reconciliations = l || []) });
    }
  }

  createAccount(): void {
    this.http.post<CashAccount>(`${this.state.apiBase}/finance/accounts`, this.accForm).subscribe({
      next: (created) => {
        this.accounts = [...this.accounts, created];
        this.showAccountDrawer = false;
        this.state.showToast('Rekening baru ditambahkan');
      }
    });
  }

  submitTransfer(): void {
    this.http.post(`${this.state.apiBase}/finance/transfers`, this.trfForm).subscribe({
      next: () => {
        this.showTransferDrawer = false;
        this.state.showToast('Transfer antar rekening berhasil');
        this.loadAll();
      },
      error: (err) => this.state.showToast(err?.error?.message || 'Transfer gagal')
    });
  }

  createReceipt(): void {
    this.http.post<CashTx>(`${this.state.apiBase}/finance/receipts`, this.recForm).subscribe({
      next: (created) => {
        this.receipts = [created, ...this.receipts];
        this.showReceiptDrawer = false;
        this.state.showToast('Penerimaan dicatat & dijurnal');
      }
    });
  }

  createExpense(): void {
    this.http.post<CashTx>(`${this.state.apiBase}/finance/expenses`, this.expForm).subscribe({
      next: (created) => {
        this.expenses = [created, ...this.expenses];
        this.showExpenseDrawer = false;
        this.state.showToast('Voucher pengeluaran diajukan');
      }
    });
  }

  payExpense(e: CashTx): void {
    this.http.post<CashTx>(`${this.state.apiBase}/finance/expenses/${e.id}/pay`, {}).subscribe({
      next: (updated) => {
        e.status = updated.status;
        this.state.showToast(`Pengeluaran ${e.id} dibayar & dijurnal`);
      }
    });
  }

  settleClaim(c: ReceivableItem): void {
    this.http.put<ReceivableItem>(`${this.state.apiBase}/finance/receivables/${c.claimNo}`, { paidMillions: c.amountMillions, status: 'Lunas Cair' }).subscribe({
      next: (updated) => {
        c.paidMillions = updated.paidMillions;
        c.status = updated.status;
        this.state.showToast(`Pencairan klaim ${c.claimNo} dicatat ke Kas & Jurnal`);
      }
    });
  }

  paySupplier(ap: PayableItem): void {
    this.http.post<PayableItem>(`${this.state.apiBase}/finance/payables/${ap.id}/pay`, {}).subscribe({
      next: (updated) => {
        ap.paidRp = updated.paidRp;
        ap.status = updated.status;
        this.state.showToast(`Tagihan ${ap.invoiceNo} dilunasi & dijurnal`);
      }
    });
  }

  budgetPct(b: BudgetItem): number {
    if (!b.budgetRp) return 0;
    return Math.round((b.actualRp / b.budgetRp) * 100);
  }

  createBudget(): void {
    this.http.post<BudgetItem>(`${this.state.apiBase}/finance/budgets`, this.bdgForm).subscribe({
      next: (created) => {
        this.budgets = [created, ...this.budgets];
        this.showBudgetDrawer = false;
        this.state.showToast('Anggaran disimpan');
      }
    });
  }

  verifyRecon(r: ReconciliationItem): void {
    const totalLocal = Number(r.localCashRp) + Number(r.localDigitalRp);
    this.http.put<ReconciliationItem>(`${this.state.apiBase}/finance/reconciliations/${r.id}`, { bankMutationRp: totalLocal, status: 'Sesuai' }).subscribe({
      next: (updated) => {
        r.bankMutationRp = updated.bankMutationRp;
        r.varianceRp = updated.varianceRp;
        r.status = updated.status;
        this.state.showToast(`Rekonsiliasi ${r.outlet} (${r.date}) diverifikasi Sesuai`);
      }
    });
  }
}
