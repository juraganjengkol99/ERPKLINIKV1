import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { SlideDrawerComponent } from '../../shared/components/slide-drawer.component';
import { TablePagerComponent } from '../../shared/components/table-pager.component';
import { filterRows, paginateRows } from '../../shared/utils/table-filter';
import { IdrPipe } from '../../shared/pipes/idr.pipe';
import { PromoFormComponent } from './forms/promo-form.component';

interface PatientItem {
  rm: string;
  name: string;
  nik: string;
  homeOutlet: string;
  lastVisit: string;
  jaminan: string;
  ihs: string;
  phone?: string;
  timeline?: Array<{ date: string; outlet: string; activity: string }>;
}

@Component({
  selector: 'app-marketing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SlideDrawerComponent, TablePagerComponent, IdrPipe, PromoFormComponent],
  template: `
    @if (sub === 'data-pasien-konsolidasi') {
      <div class="panel">
        <h2>
          Indeks Pasien Konsolidasi Lintas Cabang (Master Patient Index)
          <span class="sp"></span>
          <input class="input" [(ngModel)]="patientSearch" placeholder="Cari No. RM / NIK / Nama / IHS..." />
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>No. RM</th><th>Nama Pasien</th><th>NIK</th><th>Cabang Utama</th><th>Kunjungan Terakhir</th><th>Penjamin</th><th>IHS Number</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (p of pagedPatients; track p.rm) {
                <tr>
                  <td><code>{{ p.rm }}</code></td>
                  <td><b>{{ p.name }}</b></td>
                  <td>{{ p.nik }}</td>
                  <td>{{ p.homeOutlet }}</td>
                  <td>{{ p.lastVisit }}</td>
                  <td><span class="pill info">{{ p.jaminan }}</span></td>
                  <td><span class="pill ok">{{ p.ihs }}</span></td>
                  <td><button class="ib btn-sm" type="button" (click)="selectedPatient = p">Timeline Lintas Cabang</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-table-pager [total]="filteredPatients.length" [(page)]="patientPage" [(pageSize)]="pageSize" />
      </div>

    } @else if (sub === 'promo-paket') {
      @if (showPromoDrawer) {
        <app-promo-form [model]="promoForm" (submitted)="createPromo()" (cancelled)="showPromoDrawer = false" />
      }
      <div class="panel">
        <h2>
          Promo, Voucher & Paket MCU (Auto-Sync ke Kasir Cabang)
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="showPromoDrawer = true">+ Buat Promo / Paket</button>
        </h2>
        <div class="tw">
          <table>
            <thead><tr><th>Kode</th><th>Nama Promo / Paket</th><th>Jenis</th><th>Diskon / Harga</th><th>Berlaku di</th><th>Kuota</th><th>Berlaku Sampai</th><th>Status</th></tr></thead>
            <tbody>
              @for (p of promos; track p.id) {
                <tr>
                  <td><code>{{ p.code }}</code></td>
                  <td><b>{{ p.name }}</b></td>
                  <td>{{ p.type }}</td>
                  <td>{{ p.discountType === 'Persen' ? p.discountValue + '%' : (p.discountValue | idr) }}</td>
                  <td class="wrap-cell">{{ p.outlets.join(', ') }}</td>
                  <td>{{ p.quotaUsed }} / {{ p.quotaMax }}</td>
                  <td>{{ p.validUntil }}</td>
                  <td><span class="pill ok">{{ p.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'loyalitas') {
      <div class="two">
        <div class="panel">
          <h2>Daftar Member & Poin Loyalitas Pasien</h2>
          <div class="tw">
            <table>
              <thead><tr><th>RM</th><th>Nama Member</th><th>Tier</th><th class="num">Poin</th><th class="num">Total Transaksi</th><th>Aksi</th></tr></thead>
              <tbody>
                @for (m of loyaltyAccounts; track m.id) {
                  <tr>
                    <td><code>{{ m.rm }}</code></td>
                    <td><b>{{ m.patientName }}</b></td>
                    <td><span class="pill info">{{ m.tier }}</span></td>
                    <td class="num"><b>{{ m.points }} pts</b></td>
                    <td class="num">{{ m.totalSpendRp | idr }}</td>
                    <td><button class="ib btn-sm" type="button" (click)="addBonusPoints(m, 50)">+50 Poin</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <h2>Aturan Perolehan Poin & Tier</h2>
          <div class="form">
            <label>1 Poin setiap Belanja (Rp) <input type="number" [(ngModel)]="loyaltyRules.earnPerRp" /></label>
            <label>Nilai Tukar 1 Poin (Rp) <input type="number" [(ngModel)]="loyaltyRules.pointValueRp" /></label>
            <label>Minimal Poin Tier Gold <input type="number" [(ngModel)]="loyaltyRules.goldMin" /></label>
            <label>Minimal Poin Tier Platinum <input type="number" [(ngModel)]="loyaltyRules.platinumMin" /></label>
          </div>
          <div class="row">
            <span class="hint-text">Berlaku lintas klinik & apotek.</span>
            <button class="btn btn-sm" type="button" (click)="saveLoyaltyRules()">Simpan Aturan</button>
          </div>
        </div>
      </div>

    } @else if (sub === 'broadcast-whatsapp-sms') {
      <div class="two">
        <div class="panel">
          <h2>Buat Kampanye Broadcast WhatsApp / SMS</h2>
          <div class="form" style="grid-template-columns:1fr">
            <label>Judul Kampanye <input [(ngModel)]="brdForm.title" placeholder="Pengingat Vaksinasi Influenza" /></label>
            <label>Channel <select [(ngModel)]="brdForm.channel"><option value="WhatsApp">WhatsApp Official</option><option value="SMS">SMS Gateway</option></select></label>
            <label>Segmen Pasien <select [(ngModel)]="brdForm.segment"><option value="Semua Pasien Aktif">Semua Pasien Aktif</option><option value="Pasien Kronis BPJS">Pasien Kronis BPJS / PRB</option><option value="Pasien Tidak Berkunjung > 6 Bulan">Pasien Tidak Berkunjung > 6 Bulan</option></select></label>
            <label>Template Pesan (variabel: &#123;nama&#125;, &#123;outlet&#125;) <textarea rows="3" [(ngModel)]="brdForm.template"></textarea></label>
            <button class="btn" type="button" (click)="sendBroadcast()">Kirim Broadcast Sekarang</button>
          </div>
        </div>

        <div class="panel">
          <h2>Riwayat Kampanye Terkirim</h2>
          <div class="tw">
            <table>
              <thead><tr><th>Kampanye</th><th>Channel</th><th>Segmen</th><th class="num">Terkirim</th><th>Read Rate</th><th>Status</th></tr></thead>
              <tbody>
                @for (b of broadcasts; track b.id) {
                  <tr>
                    <td><b>{{ b.title }}</b><div class="hint-text">{{ b.scheduledAt }}</div></td>
                    <td><span class="pill info">{{ b.channel }}</span></td>
                    <td>{{ b.segment }}</td>
                    <td class="num">{{ b.sentCount }}</td>
                    <td>{{ b.readRate }}</td>
                    <td><span class="pill ok">{{ b.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

    } @else if (sub === 'survei-kepuasan') {
      <div class="panel">
        <h2>Survei Kepuasan Pasien (CSAT & NPS Lintas Cabang)</h2>
        <div class="tw">
          <table>
            <thead><tr><th>Tanggal</th><th>Cabang</th><th>Poli / Dokter</th><th>Pasien</th><th class="num">Rating</th><th>Ulasan Pasien</th><th>Tindak Lanjut</th><th>Aksi</th></tr></thead>
            <tbody>
              @for (s of surveys; track s.id) {
                <tr>
                  <td>{{ s.date }}</td>
                  <td><b>{{ s.outlet }}</b></td>
                  <td>{{ s.poliDoctor }}</td>
                  <td>{{ s.patientName }}</td>
                  <td class="num"><b>{{ s.rating }} / 5 ★</b></td>
                  <td class="wrap-cell">{{ s.comment }}</td>
                  <td><span class="pill" [ngClass]="s.followUpStatus === 'Selesai' ? 'ok' : 'warn'">{{ s.followUpStatus }}</span></td>
                  <td>
                    @if (s.followUpStatus !== 'Selesai') {
                      <button class="btn btn-sm" type="button" (click)="resolveSurvey(s)">Tandai Ditindaklanjuti</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <app-slide-drawer [open]="!!selectedPatient" [title]="selectedPatient?.name || ''" [subtitle]="'RM: ' + (selectedPatient?.rm || '') + ' · NIK: ' + (selectedPatient?.nik || '')" (closed)="selectedPatient = null">
      @if (selectedPatient; as p) {
        <div class="row"><span>Cabang Terdaftar</span><b>{{ p.homeOutlet }}</b></div>
        <div class="row"><span>No. IHS SATUSEHAT</span><code>{{ p.ihs }}</code></div>
        <div class="row"><span>Penjamin Utama</span><span class="pill info">{{ p.jaminan }}</span></div>
        <h4 style="margin:16px 0 10px">Riwayat Kunjungan Lintas Cabang</h4>
        <div class="timeline">
          @for (t of p.timeline || []; track t.date + t.activity) {
            <div class="timeline-item">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--mut)">
                <b>{{ t.outlet }}</b>
                <span>{{ t.date }}</span>
              </div>
              <div style="margin-top:4px">{{ t.activity }}</div>
            </div>
          }
        </div>
      }
    </app-slide-drawer>
  `
})
export class MarketingPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'data-pasien-konsolidasi';
  patients: PatientItem[] = [];
  patientSearch = '';
  selectedPatient: PatientItem | null = null;

  promos: Array<{ id: string; code: string; name: string; type: string; discountType: string; discountValue: number; outlets: string[]; quotaUsed: number; quotaMax: number; validUntil: string; status: string }> = [];
  showPromoDrawer = false;
  promoForm = { code: '', name: '', type: 'Voucher Promo', discountType: 'Persen', discountValue: 15, validUntil: '2026-12-31' };

  loyaltyRules = { earnPerRp: 10000, pointValueRp: 100, silverMin: 0, goldMin: 500, platinumMin: 2000 };
  loyaltyAccounts: Array<{ id: string; rm: string; patientName: string; tier: string; points: number; totalSpendRp: number }> = [];

  broadcasts: Array<{ id: string; title: string; channel: string; segment: string; sentCount: number; readRate: string; scheduledAt: string; status: string }> = [];
  brdForm = { title: '', channel: 'WhatsApp', segment: 'Semua Pasien Aktif', template: 'Halo {nama}, yuk jaga kesehatan Anda di {outlet}!' };

  surveys: Array<{ id: string; date: string; outlet: string; poliDoctor: string; patientName: string; rating: number; comment: string; followUpStatus: string }> = [];

  patientPage = 1;
  pageSize = 10;

  get filteredPatients(): PatientItem[] {
    return filterRows(this.patients, this.patientSearch);
  }

  get pagedPatients(): PatientItem[] {
    return paginateRows(this.filteredPatients, this.patientPage, this.pageSize);
  }

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'data-pasien-konsolidasi';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    if (this.sub === 'data-pasien-konsolidasi') {
      this.http.get<PatientItem[]>(`${this.state.apiBase}/marketing/patients`).subscribe({ next: (l) => (this.patients = l || []) });
    } else if (this.sub === 'promo-paket') {
      this.http.get<any[]>(`${this.state.apiBase}/marketing/promos`).subscribe({ next: (l) => (this.promos = l || []) });
    } else if (this.sub === 'loyalitas') {
      this.http.get<{ rules: any; accounts: any[] }>(`${this.state.apiBase}/marketing/loyalty`).subscribe({
        next: (res) => {
          this.loyaltyRules = res.rules;
          this.loyaltyAccounts = res.accounts || [];
        }
      });
    } else if (this.sub === 'broadcast-whatsapp-sms') {
      this.http.get<any[]>(`${this.state.apiBase}/marketing/broadcasts`).subscribe({ next: (l) => (this.broadcasts = l || []) });
    } else if (this.sub === 'survei-kepuasan') {
      this.http.get<any[]>(`${this.state.apiBase}/marketing/surveys`).subscribe({ next: (l) => (this.surveys = l || []) });
    }
  }

  createPromo(): void {
    this.http.post<any>(`${this.state.apiBase}/marketing/promos`, this.promoForm).subscribe({
      next: (c) => {
        this.promos = [c, ...this.promos];
        this.showPromoDrawer = false;
        this.state.showToast(`Promo ${c.code} dipublikasikan ke cabang`);
      }
    });
  }

  saveLoyaltyRules(): void {
    this.http.put(`${this.state.apiBase}/marketing/loyalty/rules`, this.loyaltyRules).subscribe({
      next: () => this.state.showToast('Aturan poin loyalitas diperbarui')
    });
  }

  addBonusPoints(m: { id: string; points: number; tier: string }, deltaPoints: number): void {
    this.http.post<{ points: number; tier: string }>(`${this.state.apiBase}/marketing/loyalty/adjust`, { id: m.id, deltaPoints }).subscribe({
      next: (u) => {
        m.points = u.points;
        m.tier = u.tier;
        this.state.showToast(`+${deltaPoints} poin ditambahkan`);
      }
    });
  }

  sendBroadcast(): void {
    this.http.post<any>(`${this.state.apiBase}/marketing/broadcasts`, this.brdForm).subscribe({
      next: (c) => {
        this.broadcasts = [c, ...this.broadcasts];
        this.state.showToast(`Broadcast ${c.channel} dikirim ke ${c.sentCount} pasien`);
      }
    });
  }

  resolveSurvey(s: { id: string; followUpStatus: string }): void {
    this.http.put(`${this.state.apiBase}/marketing/surveys/${s.id}`, { followUpStatus: 'Selesai' }).subscribe({
      next: () => {
        s.followUpStatus = 'Selesai';
        this.state.showToast('Ulasan pasien ditandai telah ditindaklanjuti');
      }
    });
  }
}
