import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { JournalEntryRecord } from '../../core/models/erp.models';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { IdrPipe } from '../../shared/pipes/idr.pipe';
import { CoaFormComponent } from './forms/coa-form.component';
import { JournalFormComponent } from './forms/journal-form.component';

interface CoaItem {
  code: string;
  name: string;
  category: string;
  parentCode: string;
  normalBalance: string;
  balanceAmount: number;
  balance: string;
}

interface StatementsData {
  incomeStatement: { revenues: CoaItem[]; cogs: CoaItem[]; opex: CoaItem[]; totalRevenue: number; totalCogs: number; totalOpex: number; grossProfit: number; netProfit: number };
  balanceSheet: { assets: CoaItem[]; liabilities: CoaItem[]; equity: CoaItem[]; totalAssets: number; totalLiabilities: number; totalEquity: number };
  trialBalance: CoaItem[];
}

@Component({
  selector: 'app-akunting-page',
  standalone: true,
  imports: [CommonModule, FormsModule, IdrPipe, CoaFormComponent, JournalFormComponent],
  template: `
    @if (sub === 'chart-of-accounts') {
      @if (showCoaDrawer) {
        <app-coa-form [model]="coaForm" (submitted)="createCoa()" (cancelled)="showCoaDrawer = false" />
      }
      <div class="panel">
        <h2>
          Chart of Accounts (COA) Hierarki Klinik & Apotek
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showCoaDrawer = true">+ Tambah Akun COA</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>Kode Akun</th><th>Nama Akun</th><th>Kategori</th><th>Saldo Normal</th><th class="num">Saldo Berjalan</th></tr></thead>
            <tbody>
              @for (a of coa; track a.code) {
                <tr>
                  <td><code>{{ a.code }}</code></td>
                  <td [style.padding-left.px]="a.parentCode ? 28 : 14"><b [style.font-weight]="a.parentCode ? '500' : '700'">{{ a.name }}</b></td>
                  <td>{{ a.category }}</td>
                  <td><span class="pill info">{{ a.normalBalance }}</span></td>
                  <td class="num"><b>{{ a.balanceAmount | idr }}</b></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'jurnal') {
      @if (showJournalDrawer) {
        <app-journal-form [model]="jrnForm" [coa]="coa" (submitted)="createJournal()" (cancelled)="showJournalDrawer = false" />
      }
      <div class="panel">
        <h2>
          Jurnal Umum Double-Entry
          <span class="sp"></span>
          <button class="ib btn-sm" type="button" (click)="state.exportJournalsCsv()">Export CSV</button>
          <button class="btn btn-sm" type="button" (click)="showJournalDrawer = true">+ Buat Jurnal Manual</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. Jurnal</th><th>Tanggal</th><th>Cabang</th><th>Sumber</th><th>Akun Debit</th><th>Akun Kredit</th><th>Keterangan</th><th class="num">Nominal</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (j of journals; track j.code) {
                <tr>
                  <td><code>{{ j.code }}</code></td>
                  <td>{{ j.date }}</td>
                  <td><b>{{ j.outlet }}</b></td>
                  <td><span class="pill info">{{ j.source || 'Auto-Sync' }}</span></td>
                  <td class="wrap-cell">{{ j.accountDebit }}</td>
                  <td class="wrap-cell">{{ j.accountCredit }}</td>
                  <td class="wrap-cell">{{ j.description }}</td>
                  <td class="num"><b>{{ j.amount }}</b></td>
                  <td><span class="pill" [ngClass]="j.status.includes('Dibatalkan') ? 'bad' : 'ok'">{{ j.status }}</span></td>
                  <td>
                    @if (!j.status.includes('Dibatalkan')) {
                      <button class="ib btn-sm danger" type="button" (click)="reverseJournal(j)">Reversal</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'buku-besar') {
      <div class="panel">
        <h2>
          Buku Besar (General Ledger)
          <span class="sp"></span>
          <select class="select" [(ngModel)]="ledgerAccount" (ngModelChange)="loadLedger()">
            @for (a of coa; track a.code) {
              @if (a.code !== '1000') {
                <option [value]="a.code">{{ a.code }} — {{ a.name }}</option>
              }
            }
          </select>
          <select class="select" [(ngModel)]="ledgerOutlet" (ngModelChange)="loadLedger()">
            <option value="Semua">Semua Outlet</option>
            @for (o of state.outlets(); track o.outletId) {
              <option [value]="o.name">{{ o.name }}</option>
            }
          </select>
        </h2>
        <div class="row">
          <span>Akun Dipilih: <b>{{ ledgerData?.account?.code }} — {{ ledgerData?.account?.name }}</b></span>
          <span>Saldo Akhir: <b>{{ (ledgerData?.endingBalance || 0) | idr }}</b></span>
        </div>
        <div class="tw">
          <table>
            <thead><tr><th>Tanggal</th><th>No. Jurnal</th><th>Cabang</th><th>Keterangan</th><th class="num">Debit</th><th class="num">Kredit</th><th class="num">Saldo Berjalan</th></tr></thead>
            <tbody>
              @for (m of ledgerData?.mutations || []; track m.journalCode + m.description) {
                <tr>
                  <td>{{ m.date }}</td>
                  <td><code>{{ m.journalCode }}</code></td>
                  <td>{{ m.outlet }}</td>
                  <td class="wrap-cell">{{ m.description }}</td>
                  <td class="num">{{ m.debit | idr }}</td>
                  <td class="num">{{ m.credit | idr }}</td>
                  <td class="num"><b>{{ m.runningBalance | idr }}</b></td>
                </tr>
              }
              @if ((ledgerData?.mutations || []).length === 0) {
                <tr><td colspan="7" class="empty">Belum ada mutasi pada akun dan filter ini.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'laporan-keuangan') {
      <div class="tabs">
        <button class="tab" type="button" [class.on]="stmtTab === 'pnl'" (click)="stmtTab = 'pnl'">Laba Rugi (P&L)</button>
        <button class="tab" type="button" [class.on]="stmtTab === 'bs'" (click)="stmtTab = 'bs'">Neraca (Balance Sheet)</button>
        <button class="tab" type="button" [class.on]="stmtTab === 'tb'" (click)="stmtTab = 'tb'">Neraca Saldo (Trial Balance)</button>
      </div>

      @if (statements; as st) {
        @if (stmtTab === 'pnl') {
          <div class="panel">
            <h2>Laporan Laba Rugi Konsolidasi (Berbasis General Ledger Nyata)</h2>
            <div class="row"><b>PENDAPATAN USAHA</b><b>{{ st.incomeStatement.totalRevenue | idr }}</b></div>
            @for (r of st.incomeStatement.revenues; track r.code) {
              <div class="row" style="padding-left:32px"><span>{{ r.code }} — {{ r.name }}</span><span>{{ r.balanceAmount | idr }}</span></div>
            }
            <div class="row"><b>BEBAN POKOK (HPP & JASA MEDIS)</b><b>({{ st.incomeStatement.totalCogs | idr }})</b></div>
            <div class="row"><b>LABA KOTOR</b><b>{{ st.incomeStatement.grossProfit | idr }}</b></div>
            <div class="row"><b>BEBAN OPERASIONAL & PENYUSUTAN</b><b>({{ st.incomeStatement.totalOpex | idr }})</b></div>
            <div class="row" style="background:var(--accbg)"><b>LABA BERSIH KONSOLIDASI</b><b style="font-size:16px">{{ st.incomeStatement.netProfit | idr }}</b></div>
          </div>
        } @else if (stmtTab === 'bs') {
          <div class="two">
            <div class="panel">
              <h2>ASET</h2>
              @for (a of st.balanceSheet.assets; track a.code) {
                <div class="row"><span>{{ a.code }} — {{ a.name }}</span><span>{{ (a.normalBalance === 'Kredit' ? -a.balanceAmount : a.balanceAmount) | idr }}</span></div>
              }
              <div class="row" style="background:var(--accbg)"><b>TOTAL ASET</b><b>{{ st.balanceSheet.totalAssets | idr }}</b></div>
            </div>
            <div class="panel">
              <h2>KEWAJIBAN & EKUITAS</h2>
              @for (l of st.balanceSheet.liabilities; track l.code) {
                <div class="row"><span>{{ l.code }} — {{ l.name }}</span><span>{{ l.balanceAmount | idr }}</span></div>
              }
              @for (e of st.balanceSheet.equity; track e.code) {
                <div class="row"><span>{{ e.code }} — {{ e.name }}</span><span>{{ e.balanceAmount | idr }}</span></div>
              }
              <div class="row"><span>Laba Periode Berjalan</span><span>{{ st.incomeStatement.netProfit | idr }}</span></div>
              <div class="row" style="background:var(--accbg)"><b>TOTAL KEWAJIBAN & EKUITAS</b><b>{{ (st.balanceSheet.totalLiabilities + st.balanceSheet.totalEquity) | idr }}</b></div>
            </div>
          </div>
        } @else {
          <div class="panel">
            <h2>Neraca Saldo (Trial Balance)</h2>
            <div class="tw">
              <table>
                <thead><tr><th>Kode</th><th>Nama Akun</th><th>Kategori</th><th class="num">Debit</th><th class="num">Kredit</th></tr></thead>
                <tbody>
                  @for (a of st.trialBalance; track a.code) {
                    <tr>
                      <td><code>{{ a.code }}</code></td>
                      <td>{{ a.name }}</td>
                      <td>{{ a.category }}</td>
                      <td class="num">{{ a.normalBalance === 'Debit' ? (a.balanceAmount | idr) : '-' }}</td>
                      <td class="num">{{ a.normalBalance === 'Kredit' ? (a.balanceAmount | idr) : '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }

    } @else if (sub === 'konsolidasi-outlet') {
      <div class="panel">
        <h2>Matriks Konsolidasi Laba Rugi Lintas Outlet & Eliminasi Antar-Cabang</h2>
        <div class="tw">
          <table>
            <thead><tr><th>Entitas / Cabang</th><th>Tipe</th><th class="num">Pendapatan</th><th class="num">HPP (24%)</th><th class="num">Beban Ops</th><th class="num">Laba Bersih</th></tr></thead>
            <tbody>
              @for (c of consolidationCols; track c.entity) {
                <tr>
                  <td><b>{{ c.entity }}</b></td>
                  <td>{{ c.type }}</td>
                  <td class="num">{{ c.revenue | idr }}</td>
                  <td class="num">{{ c.cogs | idr }}</td>
                  <td class="num">{{ c.opex | idr }}</td>
                  <td class="num"><b>{{ c.netProfit | idr }}</b></td>
                </tr>
              }
              @if (eliminations) {
                <tr style="background:var(--warnbg)">
                  <td><b>{{ eliminations.entity }}</b></td>
                  <td>Eliminasi</td>
                  <td class="num">{{ eliminations.revenue | idr }}</td>
                  <td class="num">{{ eliminations.cogs | idr }}</td>
                  <td class="num">{{ eliminations.opex | idr }}</td>
                  <td class="num"><b>{{ eliminations.netProfit | idr }}</b></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'aset-tetap') {
      <div class="panel">
        <h2>
          Register Aset Tetap & Penyusutan Otomatis
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="runDepreciation()">Jalankan Penyusutan Bulan Ini (2026-11)</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>Kode Aset</th><th>Nama Aset</th><th>Cabang</th><th>Tgl Beli</th><th class="num">Harga Perolehan</th><th class="num">Akum. Penyusutan</th><th class="num">Nilai Buku</th><th class="num">Depresiasi / Bln</th></tr></thead>
            <tbody>
              @for (a of fixedAssets; track a.code) {
                <tr>
                  <td><code>{{ a.code }}</code></td>
                  <td><b>{{ a.name }}</b></td>
                  <td>{{ a.outlet }}</td>
                  <td>{{ a.purchaseDate }}</td>
                  <td class="num">{{ a.costRp | idr }}</td>
                  <td class="num">{{ a.accumulatedDepRp | idr }}</td>
                  <td class="num"><b>{{ a.bookValueRp | idr }}</b></td>
                  <td class="num">{{ a.monthlyDepRp | idr }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'pajak') {
      <div class="panel">
        <h2>Rekapitulasi Perpajakan Klinik & Apotek (PPN · PPh 21 · PPh 23)</h2>
        <div class="tw">
          <table>
            <thead><tr><th>Masa Pajak</th><th>Jenis Pajak</th><th class="num">Dasar Pengenaan (DPP)</th><th class="num">Nominal Pajak</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (t of taxes; track t.id) {
                <tr>
                  <td>{{ t.period }}</td>
                  <td><b>{{ t.taxType }}</b></td>
                  <td class="num">{{ t.baseAmountRp | idr }}</td>
                  <td class="num"><b>{{ t.taxAmountRp | idr }}</b></td>
                  <td><span class="pill" [ngClass]="t.status === 'Sudah Setor' ? 'ok' : 'warn'">{{ t.status }}</span></td>
                  <td>
                    @if (t.status !== 'Sudah Setor') {
                      <button class="btn btn-sm" type="button" (click)="markTaxPaid(t)">Tandai Sudah Setor</button>
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
export class AkuntingPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'chart-of-accounts';
  coa: CoaItem[] = [];
  journals: JournalEntryRecord[] = [];
  showCoaDrawer = false;
  coaForm = { code: '', name: '', category: 'Beban Operasional', normalBalance: 'Debit' };

  showJournalDrawer = false;
  jrnForm = { outlet: 'Pusat (Cloud VPS)', description: 'Penyesuaian akuntansi bulanan', debitCode: '6101', creditCode: '1101', debitAmt: 500000, creditAmt: 500000 };

  ledgerAccount = '1101';
  ledgerOutlet = 'Semua';
  ledgerData: { account: { code: string; name: string }; endingBalance: number; mutations: Array<{ journalCode: string; date: string; outlet: string; description: string; debit: number; credit: number; runningBalance: number }> } | null = null;

  stmtTab: 'pnl' | 'bs' | 'tb' = 'pnl';
  statements: StatementsData | null = null;

  consolidationCols: Array<{ entity: string; type: string; revenue: number; cogs: number; opex: number; netProfit: number }> = [];
  eliminations: { entity: string; revenue: number; cogs: number; opex: number; netProfit: number } | null = null;

  fixedAssets: Array<{ code: string; name: string; outlet: string; purchaseDate: string; costRp: number; accumulatedDepRp: number; bookValueRp: number; monthlyDepRp: number }> = [];
  taxes: Array<{ id: string; period: string; taxType: string; baseAmountRp: number; taxAmountRp: number; status: string }> = [];

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'chart-of-accounts';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    this.http.get<CoaItem[]>(`${this.state.apiBase}/accounting/coa`).subscribe({ next: (l) => (this.coa = l || []) });
    if (this.sub === 'jurnal') {
      this.http.get<JournalEntryRecord[]>(`${this.state.apiBase}/accounting/journals`).subscribe({ next: (l) => (this.journals = l || []) });
    } else if (this.sub === 'buku-besar') {
      this.loadLedger();
    } else if (this.sub === 'laporan-keuangan') {
      this.http.get<StatementsData>(`${this.state.apiBase}/accounting/statements`).subscribe({ next: (res) => (this.statements = res) });
    } else if (this.sub === 'konsolidasi-outlet') {
      this.http
        .get<{
          columns: Array<{ entity: string; type: string; revenue: number; cogs: number; opex: number; netProfit: number }>;
          eliminations: { entity: string; revenue: number; cogs: number; opex: number; netProfit: number } | null;
        }>(`${this.state.apiBase}/accounting/consolidation`)
        .subscribe({
          next: (res) => {
            this.consolidationCols = res.columns || [];
            this.eliminations = res.eliminations || null;
          }
        });
    } else if (this.sub === 'aset-tetap') {
      this.http
        .get<{ assets: Array<{ code: string; name: string; outlet: string; purchaseDate: string; costRp: number; accumulatedDepRp: number; bookValueRp: number; monthlyDepRp: number }> }>(
          `${this.state.apiBase}/accounting/fixed-assets`
        )
        .subscribe({
          next: (res) => (this.fixedAssets = res.assets || [])
        });
    } else if (this.sub === 'pajak') {
      this.http
        .get<Array<{ id: string; period: string; taxType: string; baseAmountRp: number; taxAmountRp: number; status: string }>>(`${this.state.apiBase}/accounting/taxes`)
        .subscribe({ next: (l) => (this.taxes = l || []) });
    }
  }

  loadLedger(): void {
    this.http
      .get<{
        account: { code: string; name: string };
        endingBalance: number;
        mutations: Array<{ journalCode: string; date: string; outlet: string; description: string; debit: number; credit: number; runningBalance: number }>;
      }>(`${this.state.apiBase}/accounting/ledger?accountCode=${this.ledgerAccount}&outlet=${encodeURIComponent(this.ledgerOutlet)}`)
      .subscribe({ next: (res) => (this.ledgerData = res) });
  }

  createCoa(): void {
    this.http.post<CoaItem>(`${this.state.apiBase}/accounting/coa`, this.coaForm).subscribe({
      next: (created) => {
        this.coa = [...this.coa, created];
        this.showCoaDrawer = false;
        this.state.showToast(`Akun ${created.code} ditambahkan`);
      },
      error: (err) => this.state.showToast(err?.error?.message || 'Gagal menambah COA')
    });
  }

  createJournal(): void {
    this.http
      .post<JournalEntryRecord>(`${this.state.apiBase}/accounting/journals`, {
        outlet: this.jrnForm.outlet,
        description: this.jrnForm.description,
        lines: [
          { accountCode: this.jrnForm.debitCode, debit: this.jrnForm.debitAmt, credit: 0 },
          { accountCode: this.jrnForm.creditCode, debit: 0, credit: this.jrnForm.creditAmt }
        ]
      })
      .subscribe({
        next: (created) => {
          this.journals = [created, ...this.journals];
          this.showJournalDrawer = false;
          this.state.showToast(`Jurnal ${created.code} diposting`);
        }
      });
  }

  reverseJournal(j: JournalEntryRecord): void {
    this.state.askConfirm({
      title: 'Konfirmasi Jurnal Pembalik (Reversal)',
      message: `Buat jurnal pembalik untuk membatalkan "${j.code}"?`,
      confirmLabel: 'Ya, Buat Reversal',
      danger: true,
      onConfirm: () => {
        this.http.post(`${this.state.apiBase}/accounting/journals/${j.code}/reverse`, {}).subscribe({
          next: () => {
            this.state.showToast(`Jurnal pembalik untuk ${j.code} berhasil diposting`);
            this.loadAll();
          }
        });
      }
    });
  }

  runDepreciation(): void {
    this.http.post(`${this.state.apiBase}/accounting/depreciation/run`, { period: '2026-11' }).subscribe({
      next: () => {
        this.state.showToast('Penyusutan aset tetap periode 2026-11 diposting ke Jurnal');
        this.loadAll();
      },
      error: (err) => this.state.showToast(err?.error?.message || 'Penyusutan periode ini sudah dijalankan')
    });
  }

  markTaxPaid(t: { id: string; status: string }): void {
    this.http.put(`${this.state.apiBase}/accounting/taxes/${t.id}`, { status: 'Sudah Setor' }).subscribe({
      next: () => {
        t.status = 'Sudah Setor';
        this.state.showToast('Status setoran pajak diperbarui');
      }
    });
  }
}
