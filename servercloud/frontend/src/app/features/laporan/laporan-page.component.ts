import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { OutletStatusItem } from '../../core/models/erp.models';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { BarChartDatum, SvgBarChartComponent } from '../../shared/components/svg-bar-chart.component';
import { IdrPipe } from '../../shared/pipes/idr.pipe';

interface ExecutiveReport {
  visitsRevenue: {
    totalVisits: number;
    totalRevenueMillions: number;
    payerMix: Array<{ payer: string; sharePercent: number; visits: number }>;
    byOutlet: OutletStatusItem[];
  };
  bpjsClaims: Array<{ claimNo: string; outlet: string; program: string; totalCases: number; amountMillions: number; paidMillions?: number; status: string }>;
  scorecard: { totalStockValueRp: number; hrCompliancePercent: number; totalDoctorFeesMillions: number; cashBalanceRp: number };
  regulatory: {
    topDiseases: Array<{ icd10: string; name: string; cases: number; outlets: string }>;
    sipnapSummary: Array<{ code: string; name: string; centralStock: number; unit: string; status: string }>;
    sirsRlSummary: Array<{ code: string; title: string; value: string }>;
  };
}

@Component({
  selector: 'app-laporan-page',
  standalone: true,
  imports: [CommonModule, SvgBarChartComponent, IdrPipe],
  template: `
    @if (data; as d) {
      @if (sub === 'kunjungan-pendapatan') {
        <div class="stats">
          <div class="stat"><span>Total Kunjungan / Trx</span><b>{{ d.visitsRevenue.totalVisits }}</b></div>
          <div class="stat"><span>Total Pendapatan Grup</span><b>Rp {{ d.visitsRevenue.totalRevenueMillions.toFixed(1).replace('.', ',') }} jt</b></div>
          <div class="stat"><span>Outlet Aktif</span><b>{{ d.visitsRevenue.byOutlet.length }}</b></div>
        </div>

        <div class="two">
          <div class="panel">
            <h2>Komparasi Pendapatan per Cabang</h2>
            <app-svg-bar-chart [data]="revenueBars" />
          </div>
          <div class="panel">
            <h2>Komposisi Penjamin Pasien</h2>
            <app-svg-bar-chart [data]="payerBars" />
          </div>
        </div>

      } @else if (sub === 'klaim-bpjs') {
        <div class="panel">
          <h2>Laporan Konsolidasi Realisasi Klaim BPJS Kesehatan</h2>
          <div class="tw">
            <table>
              <thead><tr><th>No. Klaim</th><th>Cabang</th><th>Program</th><th class="num">Kasus</th><th class="num">Diajukan</th><th class="num">Cair</th><th>Status</th></tr></thead>
              <tbody>
                @for (c of d.bpjsClaims; track c.claimNo) {
                  <tr>
                    <td><code>{{ c.claimNo }}</code></td>
                    <td><b>{{ c.outlet }}</b></td>
                    <td>{{ c.program }}</td>
                    <td class="num">{{ c.totalCases }}</td>
                    <td class="num">Rp {{ c.amountMillions.toFixed(1).replace('.', ',') }} jt</td>
                    <td class="num">Rp {{ (c.paidMillions || 0).toFixed(1).replace('.', ',') }} jt</td>
                    <td><span class="pill info">{{ c.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

      } @else if (sub === 'stok-sdm-keuangan') {
        <div class="stats">
          <div class="stat"><span>Valuasi Stok Gudang Pusat</span><b>{{ d.scorecard.totalStockValueRp | idr }}</b></div>
          <div class="stat"><span>Kepatuhan STR/SIP SDM</span><b>{{ d.scorecard.hrCompliancePercent }}%</b></div>
          <div class="stat"><span>Total Jasa Medis Dokter</span><b>Rp {{ d.scorecard.totalDoctorFeesMillions.toFixed(2).replace('.', ',') }} jt</b></div>
          <div class="stat"><span>Likuiditas Kas & Bank</span><b>{{ d.scorecard.cashBalanceRp | idr }}</b></div>
        </div>

        <div class="panel">
          <h2>Executive Scorecard Lintas Cabang</h2>
          <div class="tw">
            <table>
              <thead><tr><th>Cabang</th><th>Tipe</th><th class="num">Kunjungan</th><th class="num">Pendapatan</th><th>Status Koneksi</th></tr></thead>
              <tbody>
                @for (o of d.visitsRevenue.byOutlet; track o.outletId) {
                  <tr>
                    <td><b>{{ o.name }}</b></td>
                    <td>{{ o.type }}</td>
                    <td class="num">{{ o.todayVisits ?? 0 }}</td>
                    <td class="num"><b>Rp {{ (o.todayRevenueMillions ?? 0).toFixed(2).replace('.', ',') }} jt</b></td>
                    <td><span class="pill" [ngClass]="o.connectionStatus">{{ o.connectionLabel }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

      } @else if (sub === 'laporan-regulasi') {
        <div class="panel">
          <h2>Ringkasan Laporan SIRS RL Kemenkes</h2>
          @for (rl of d.regulatory.sirsRlSummary; track rl.code) {
            <div class="row">
              <div><b>{{ rl.code }}</b> — {{ rl.title }}</div>
              <span class="pill info">{{ rl.value }}</span>
            </div>
          }
        </div>

        <div class="two">
          <div class="panel">
            <h2>10 Besar Penyakit (ICD-10 Konsolidasi)</h2>
            <div class="tw">
              <table>
                <thead><tr><th>ICD-10</th><th>Diagnosa</th><th class="num">Kasus</th></tr></thead>
                <tbody>
                  @for (td of d.regulatory.topDiseases; track td.icd10) {
                    <tr><td><code>{{ td.icd10 }}</code></td><td class="wrap-cell">{{ td.name }}</td><td class="num"><b>{{ td.cases }}</b></td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <h2>Pelaporan Narkotika & Psikotropika (SIPNAP)</h2>
            <div class="tw">
              <table>
                <thead><tr><th>Kode KFA</th><th>Nama Obat</th><th class="num">Stok Pusat</th><th>Status</th></tr></thead>
                <tbody>
                  @for (s of d.regulatory.sipnapSummary; track s.code) {
                    <tr><td><code>{{ s.code }}</code></td><td><b>{{ s.name }}</b></td><td class="num">{{ s.centralStock }} {{ s.unit }}</td><td><span class="pill ok">{{ s.status }}</span></td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    }
  `
})
export class LaporanPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'kunjungan-pendapatan';
  data: ExecutiveReport | null = null;

  get revenueBars(): BarChartDatum[] {
    return (this.data?.visitsRevenue.byOutlet || []).map((o) => ({
      label: o.name,
      value: Number(o.todayRevenueMillions || 0),
      displayValue: `Rp ${(o.todayRevenueMillions || 0).toFixed(1).replace('.', ',')} jt`,
      tone: 'acc'
    }));
  }

  get payerBars(): BarChartDatum[] {
    return (this.data?.visitsRevenue.payerMix || []).map((p) => ({
      label: p.payer,
      value: p.sharePercent,
      displayValue: `${p.sharePercent}% (${p.visits})`,
      tone: 'ok'
    }));
  }

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'kunjungan-pendapatan';
      this.http.get<ExecutiveReport>(`${this.state.apiBase}/reports/executive`).subscribe({
        next: (res) => (this.data = res)
      });
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }
}
