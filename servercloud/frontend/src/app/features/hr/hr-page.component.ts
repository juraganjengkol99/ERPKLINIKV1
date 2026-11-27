import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserOutlet } from '../../core/models/erp.models';
import { CloudStateService } from '../../core/services/cloud-state.service';
import { TablePagerComponent } from '../../shared/components/table-pager.component';
import { filterRows, paginateRows } from '../../shared/utils/table-filter';
import { IdrPipe } from '../../shared/pipes/idr.pipe';
import { EmployeeFormComponent } from './forms/employee-form.component';
import { UserFormComponent } from './forms/user-form.component';
import { ScheduleFormComponent } from './forms/schedule-form.component';
import { CredentialFormComponent } from './forms/credential-form.component';
import { JobFormComponent } from './forms/job-form.component';

interface EmployeeItem {
  id: string;
  nip: string;
  name: string;
  nik: string;
  department: string;
  position: string;
  employmentStatus: string;
  outlet: string;
  joinDate: string;
  phone: string;
  bankAccount: string;
  baseSalary: number;
  status: string;
}

interface RolePermDef {
  role: string;
  scope: string;
  modules: string;
  status: string;
  matrix: Record<string, Record<string, boolean>>;
}

interface ScheduleItem {
  id: string;
  staffName: string;
  role: string;
  outlet: string;
  poli: string;
  day: string;
  shift: string;
  quota: number;
  status: string;
}

interface CredentialItem {
  id: string;
  staffName: string;
  profession: string;
  outlet: string;
  strNo: string;
  sipNo: string;
  expiryDate: string;
  ihsId: string;
  skpPoints: number;
  status: string;
}

interface PayrollItem {
  id: string;
  period: string;
  staffName: string;
  outlet: string;
  baseSalary: number;
  medicalFee: number;
  allowance: number;
  taxPph21: number;
  netPay: number;
  status: string;
}

interface DoctorFeeItem {
  doctorName: string;
  outlet: string;
  strSip: string;
  patientsCount: number;
  visiteCount: number;
  feeMillions: number;
  status: string;
}

interface FeeRuleItem {
  id: string;
  serviceCategory: string;
  outlet: string;
  sharePercent: number;
  fixedPerVisit: number;
  visiteRate: number;
}

@Component({
  selector: 'app-hr-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TablePagerComponent,
    IdrPipe,
    EmployeeFormComponent,
    UserFormComponent,
    ScheduleFormComponent,
    CredentialFormComponent,
    JobFormComponent
  ],
  template: `
    @if (sub === 'data-karyawan') {
      @if (showEmpDrawer) {
        <app-employee-form [model]="empForm" [outlets]="state.outlets()" [editing]="!!editingEmpId" (submitted)="saveEmployee()" (cancelled)="showEmpDrawer = false" />
      }
      <div class="stats">
        <div class="stat"><span>Total Karyawan</span><b>{{ employees.length }}</b></div>
        <div class="stat"><span>Karyawan Tetap</span><b>{{ countEmpStatus('Tetap') }}</b></div>
        <div class="stat"><span>Dokter / Mitra</span><b>{{ countEmpStatus('Mitra') }}</b></div>
        <div class="stat"><span>Status Aktif</span><b>{{ countEmpActive() }}</b></div>
      </div>

      <div class="panel">
        <h2>
          Direktori Data Karyawan Grup
          <span class="sp"></span>
          <input class="input" [(ngModel)]="empSearch" placeholder="Cari NIP / nama / jabatan..." />
          <button class="btn" type="button" (click)="openEmpDrawer()">+ Tambah Karyawan</button>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>NIP</th>
                <th>Nama Lengkap</th>
                <th>Departemen & Jabatan</th>
                <th>Status Kerja</th>
                <th>Outlet Utama</th>
                <th class="num">Gaji Pokok</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (e of pagedEmployees; track e.id) {
                <tr>
                  <td><code>{{ e.nip }}</code></td>
                  <td><b>{{ e.name }}</b></td>
                  <td>{{ e.department }} · {{ e.position }}</td>
                  <td><span class="pill info">{{ e.employmentStatus }}</span></td>
                  <td>{{ e.outlet }}</td>
                  <td class="num">{{ e.baseSalary | idr }}</td>
                  <td><span class="pill" [ngClass]="e.status === 'Aktif' ? 'ok' : 'bad'">{{ e.status }}</span></td>
                  <td><button class="ib btn-sm" type="button" (click)="openEmpDrawer(e)">Edit</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-table-pager [total]="filteredEmployees.length" [(page)]="empPage" [(pageSize)]="pageSize" />
      </div>

    } @else if (sub === 'manajemen-user') {
      @if (showUserDrawer) {
        <app-user-form [model]="userForm" [outlets]="state.outlets()" [editing]="!!editingUserId" (toggleOutlet)="toggleAllowedOutlet($event)" (submitted)="saveUser()" (cancelled)="showUserDrawer = false" />
      }
      <div class="panel">
        <h2>
          Manajemen Akun Login & Sinkronisasi Server Lokal
          <span class="sp"></span>
          <input class="input" [(ngModel)]="userSearch" placeholder="Cari nama / email / role..." />
          <select class="select" [(ngModel)]="userOutletFilter">
            <option value="Semua">Semua Outlet</option>
            @for (o of state.outlets(); track o.outletId) {
              <option [value]="o.name">{{ o.name }}</option>
            }
          </select>
          <button class="btn" type="button" (click)="openUserDrawer()">+ Buat User Baru</button>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Role</th>
                <th>Akses Outlet</th>
                <th>Email</th>
                <th>STR / SIP</th>
                <th>Status</th>
                <th>Sinkron Lokal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (u of pagedUsers; track u.id) {
                <tr>
                  <td><b>{{ u.name }}</b></td>
                  <td>{{ u.role }}</td>
                  <td class="wrap-cell">{{ (u.allowedOutlets || [u.outlet]).join(', ') }}</td>
                  <td>{{ u.email || '-' }}</td>
                  <td><code>{{ u.strSip || '-' }}</code></td>
                  <td><span class="pill" [ngClass]="u.status === 'Aktif' ? 'ok' : 'bad'">{{ u.status }}</span></td>
                  <td><span class="pill" [ngClass]="u.syncStatus === 'Tersinkron' ? 'ok' : 'warn'">{{ u.syncStatus }}</span></td>
                  <td>
                    <button class="ib btn-sm" type="button" (click)="openUserDrawer(u)">Edit</button>
                    <button class="ib btn-sm" type="button" (click)="resetPassword(u)">Reset PW</button>
                    <button class="ib btn-sm" type="button" (click)="toggleUserStatus(u)">{{ u.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan' }}</button>
                    <button class="ib btn-sm danger" type="button" (click)="confirmDeleteUser(u)">Hapus</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-table-pager [total]="filteredUsers.length" [(page)]="userPage" [(pageSize)]="pageSize" />
      </div>

    } @else if (sub === 'role-permission') {
      <div class="two">
        <div class="panel">
          <h2>Daftar Role (Cloud VPS & Cabang)</h2>
          @for (r of roles; track r.role) {
            <div
              class="row"
              style="cursor:pointer"
              [style.background]="selectedRole?.role === r.role ? 'var(--accbg)' : 'transparent'"
              (click)="selectedRole = r">
              <div>
                <b>{{ r.role }}</b>
                <div class="hint-text">{{ r.scope }}</div>
              </div>
              <span class="pill info">{{ r.status }}</span>
            </div>
          }
        </div>

        @if (selectedRole; as sr) {
          <div class="panel">
            <h2>
              Matriks Izin: {{ sr.role }}
              <span class="sp"></span>
              <button class="btn btn-sm" type="button" (click)="saveRoleMatrix(sr)">Simpan & Sync RBAC</button>
            </h2>
            <div class="tw">
              <table>
                <thead>
                  <tr>
                    <th>Modul</th>
                    <th>Lihat</th>
                    <th>Tambah</th>
                    <th>Ubah</th>
                    <th>Hapus</th>
                    <th>Approve</th>
                    <th>Ekspor</th>
                  </tr>
                </thead>
                <tbody>
                  @for (code of moduleCodes; track code) {
                    <tr>
                      <td><b>{{ code }}</b></td>
                      @for (act of permActions; track act) {
                        <td>
                          <input type="checkbox" [(ngModel)]="sr.matrix[code][act]" [disabled]="sr.role === 'Owner / Direktur'" />
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>

    } @else if (sub === 'absensi-jadwal') {
      <div class="tabs">
        <button class="tab" type="button" [class.on]="schedTab === 'schedules'" (click)="schedTab = 'schedules'">Jadwal Praktik & Shift</button>
        <button class="tab" type="button" [class.on]="schedTab === 'attendance'" (click)="schedTab = 'attendance'">Log Absensi Harian</button>
        <button class="tab" type="button" [class.on]="schedTab === 'leaves'" (click)="schedTab = 'leaves'">Pengajuan Cuti ({{ leaves.length }})</button>
      </div>

      @if (schedTab === 'schedules') {
        @if (showScheduleDrawer) {
          <app-schedule-form [model]="schedForm" (submitted)="saveSchedule()" (cancelled)="showScheduleDrawer = false" />
        }
        <div class="panel">
          <h2>
            Jadwal Praktik Dokter & Shift SDM Lintas Cabang
            <span class="sp"></span>
            <button class="btn btn-sm" type="button" (click)="showScheduleDrawer = true">+ Tambah Jadwal</button>
          </h2>
          <div class="tw">
            <table>
              <thead>
                <tr><th>Nama SDM</th><th>Role</th><th>Outlet</th><th>Poli / Unit</th><th>Hari</th><th>Jam Shift</th><th class="num">Kuota</th><th>Status</th></tr>
              </thead>
              <tbody>
                @for (s of schedules; track s.id) {
                  <tr>
                    <td><b>{{ s.staffName }}</b></td>
                    <td>{{ s.role }}</td>
                    <td>{{ s.outlet }}</td>
                    <td>{{ s.poli }}</td>
                    <td>{{ s.day }}</td>
                    <td>{{ s.shift }}</td>
                    <td class="num">{{ s.quota || '-' }}</td>
                    <td><span class="pill ok">{{ s.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (schedTab === 'attendance') {
        <div class="panel">
          <h2>Presensi Harian Tersinkron dari Server Lokal</h2>
          <div class="tw">
            <table>
              <thead><tr><th>Tanggal</th><th>Nama</th><th>Outlet</th><th>Jam Masuk</th><th>Jam Pulang</th><th>Status</th></tr></thead>
              <tbody>
                @for (a of attendance; track a.id) {
                  <tr>
                    <td>{{ a.date }}</td>
                    <td><b>{{ a.staffName }}</b></td>
                    <td>{{ a.outlet }}</td>
                    <td><code>{{ a.checkIn }}</code></td>
                    <td><code>{{ a.checkOut }}</code></td>
                    <td><span class="pill" [ngClass]="a.status === 'Hadir' ? 'ok' : 'warn'">{{ a.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <div class="panel">
          <h2>Persetujuan Cuti & Izin SDM</h2>
          <div class="tw">
            <table>
              <thead><tr><th>Nama</th><th>Outlet</th><th>Jenis</th><th>Tanggal</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                @for (lv of leaves; track lv.id) {
                  <tr>
                    <td><b>{{ lv.staffName }}</b></td>
                    <td>{{ lv.outlet }}</td>
                    <td>{{ lv.leaveType }}</td>
                    <td>{{ lv.dateRange }}</td>
                    <td class="wrap-cell">{{ lv.reason }}</td>
                    <td><span class="pill" [ngClass]="lv.status === 'Disetujui' ? 'ok' : lv.status === 'Ditolak' ? 'bad' : 'warn'">{{ lv.status }}</span></td>
                    <td>
                      @if (lv.status === 'Menunggu Approval') {
                        <button class="btn btn-sm" type="button" (click)="decideLeave(lv, 'Disetujui')">Setujui</button>
                        <button class="ib btn-sm danger" type="button" (click)="decideLeave(lv, 'Ditolak')">Tolak</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

    } @else if (sub === 'str-sip-kompetensi') {
      @if (showCredDrawer) {
        <app-credential-form [model]="credForm" [editing]="!!editingCredId" (submitted)="saveCredential()" (cancelled)="showCredDrawer = false" />
      }
      <div class="stats">
        <div class="stat"><span>Total Tenaga Medis</span><b>{{ credentials.length }}</b></div>
        <div class="stat"><span>Legalitas Aktif</span><b>{{ countCred('Aktif') }}</b></div>
        <div class="stat"><span>Segera Perpanjang</span><b>{{ countCred('Segera Perpanjang') }}</b></div>
        <div class="stat"><span>Sudah Expired</span><b>{{ countCred('Expired') }}</b></div>
      </div>

      <div class="panel">
        <h2>
          Kepatuhan STR / SIP, SKP & IHS Practitioner SATUSEHAT
          <span class="sp"></span>
          <button class="btn btn-sm" type="button" (click)="openCredDrawer()">+ Tambah STR/SIP</button>
        </h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Nama Nakes</th>
                <th>Profesi</th>
                <th>Outlet</th>
                <th>No. STR</th>
                <th>No. SIP</th>
                <th>Berlaku Sampai</th>
                <th>IHS Practitioner</th>
                <th class="num">SKP</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (c of credentials; track c.id) {
                <tr>
                  <td><b>{{ c.staffName }}</b></td>
                  <td>{{ c.profession }}</td>
                  <td>{{ c.outlet }}</td>
                  <td><code>{{ c.strNo }}</code></td>
                  <td><code>{{ c.sipNo }}</code></td>
                  <td>{{ c.expiryDate }}</td>
                  <td><code>{{ c.ihsId }}</code></td>
                  <td class="num">{{ c.skpPoints }}</td>
                  <td>
                    <span class="pill" [ngClass]="c.status === 'Aktif' ? 'ok' : c.status === 'Expired' ? 'bad' : 'warn'">
                      {{ c.status }}
                    </span>
                  </td>
                  <td><button class="ib btn-sm" type="button" (click)="openCredDrawer(c)">Perbarui</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    } @else if (sub === 'penggajian-jasa-medis') {
      <div class="tabs">
        <button class="tab" type="button" [class.on]="payTab === 'payroll'" (click)="payTab = 'payroll'">Rekap Payroll & Jasa Medis</button>
        <button class="tab" type="button" [class.on]="payTab === 'fees'" (click)="payTab = 'fees'">Rincian Jasa Medis Dokter</button>
        <button class="tab" type="button" [class.on]="payTab === 'rules'" (click)="payTab = 'rules'">Skema Bagi Hasil (Fee Rules)</button>
      </div>

      @if (payTab === 'payroll') {
        <div class="panel">
          <h2>
            Penggajian & Jasa Medis Periode 2026-11
            <span class="sp"></span>
            <button class="btn btn-sm" type="button" (click)="finalizePayroll()">Finalisasi & Posting ke Jurnal Keuangan</button>
          </h2>
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Nama SDM</th>
                  <th>Outlet</th>
                  <th class="num">Gaji Pokok</th>
                  <th class="num">Jasa Medis</th>
                  <th class="num">Tunjangan</th>
                  <th class="num">PPh 21</th>
                  <th class="num">Take Home Pay</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (p of payrolls; track p.id) {
                  <tr>
                    <td><b>{{ p.staffName }}</b></td>
                    <td>{{ p.outlet }}</td>
                    <td class="num">{{ p.baseSalary | idr }}</td>
                    <td class="num">{{ p.medicalFee | idr }}</td>
                    <td class="num">{{ p.allowance | idr }}</td>
                    <td class="num">{{ p.taxPph21 | idr }}</td>
                    <td class="num"><b>{{ p.netPay | idr }}</b></td>
                    <td><span class="pill" [ngClass]="p.status.includes('Dibayar') ? 'ok' : 'warn'">{{ p.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (payTab === 'fees') {
        <div class="panel">
          <h2>Akumulasi Jasa Medis Kunjungan & Visite (Auto-Sync dari Cabang)</h2>
          <div class="tw">
            <table>
              <thead>
                <tr><th>Nama Dokter</th><th>Cabang</th><th>No. STR</th><th class="num">Pasien RJ</th><th class="num">Visite RI</th><th class="num">Total Jasa Medis</th><th>Status</th></tr>
              </thead>
              <tbody>
                @for (d of doctorFees; track d.doctorName) {
                  <tr>
                    <td><b>{{ d.doctorName }}</b></td>
                    <td>{{ d.outlet }}</td>
                    <td><code>{{ d.strSip }}</code></td>
                    <td class="num">{{ d.patientsCount }}</td>
                    <td class="num">{{ d.visiteCount }}</td>
                    <td class="num"><b>Rp {{ d.feeMillions.toFixed(2).replace('.', ',') }} jt</b></td>
                    <td><span class="pill ok">{{ d.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <div class="panel">
          <h2>Konfigurasi Persentase Jasa Medis Dokter</h2>
          <div class="tw">
            <table>
              <thead><tr><th>Kategori Layanan</th><th>Outlet</th><th class="num">Bagi Hasil (%)</th><th class="num">Fixed / Kunjungan</th><th class="num">Tarif Visite</th><th>Aksi</th></tr></thead>
              <tbody>
                @for (r of feeRules; track r.id) {
                  <tr>
                    <td><b>{{ r.serviceCategory }}</b></td>
                    <td>{{ r.outlet }}</td>
                    <td class="num"><input class="input" type="number" [(ngModel)]="r.sharePercent" style="width:76px;text-align:right" /> %</td>
                    <td class="num">{{ r.fixedPerVisit | idr }}</td>
                    <td class="num">{{ r.visiteRate | idr }}</td>
                    <td><button class="btn btn-sm" type="button" (click)="saveFeeRule(r)">Simpan</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

    } @else if (sub === 'rekrutmen-kinerja') {
      <div class="tabs">
        <button class="tab" type="button" [class.on]="recTab === 'recruitment'" (click)="recTab = 'recruitment'">Lowongan & Pelamar</button>
        <button class="tab" type="button" [class.on]="recTab === 'kpi'" (click)="recTab = 'kpi'">Evaluasi Kinerja (KPI)</button>
      </div>

      @if (recTab === 'recruitment') {
        @if (showJobDrawer) {
          <app-job-form [model]="jobForm" (submitted)="saveJobReq()" (cancelled)="showJobDrawer = false" />
        }
        <div class="panel">
          <h2>
            Lowongan Kebutuhan SDM Cabang
            <span class="sp"></span>
            <button class="btn btn-sm" type="button" (click)="showJobDrawer = true">+ Buka Lowongan</button>
          </h2>
          <div class="tw">
            <table>
              <thead><tr><th>ID</th><th>Posisi</th><th>Outlet</th><th class="num">Kebutuhan</th><th>Urgensi</th><th>Status</th></tr></thead>
              <tbody>
                @for (j of requisitions; track j.id) {
                  <tr>
                    <td><code>{{ j.id }}</code></td>
                    <td><b>{{ j.title }}</b></td>
                    <td>{{ j.outlet }}</td>
                    <td class="num">{{ j.headcount }} orang</td>
                    <td><span class="pill" [ngClass]="j.urgency === 'Tinggi' ? 'bad' : 'info'">{{ j.urgency }}</span></td>
                    <td><span class="pill ok">{{ j.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <h2>Pipeline Kandidat Pelamar (Konversi Otomatis ke Karyawan saat Diterima)</h2>
          <div class="tw">
            <table>
              <thead><tr><th>Nama Kandidat</th><th>Outlet</th><th>Telepon</th><th>Tahap</th><th class="num">Skor</th><th>Aksi Tahapan</th></tr></thead>
              <tbody>
                @for (a of applicants; track a.id) {
                  <tr>
                    <td><b>{{ a.name }}</b></td>
                    <td>{{ a.outlet }}</td>
                    <td>{{ a.phone }}</td>
                    <td><span class="pill" [ngClass]="a.stage === 'Diterima' ? 'ok' : 'info'">{{ a.stage }}</span></td>
                    <td class="num">{{ a.score }}</td>
                    <td>
                      @if (a.stage !== 'Diterima') {
                        <button class="btn btn-sm" type="button" (click)="advanceApplicant(a, 'Diterima')">Terima & Jadikan Karyawan</button>
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
          <h2>Evaluasi Kinerja & KPI Pegawai</h2>
          <div class="tw">
            <table>
              <thead><tr><th>Periode</th><th>Nama SDM</th><th>Outlet</th><th class="num">Skor KPI</th><th class="num">Presensi</th><th class="num">Rating Pasien</th><th>Status</th></tr></thead>
              <tbody>
                @for (k of performance; track k.id) {
                  <tr>
                    <td>{{ k.period }}</td>
                    <td><b>{{ k.staffName }}</b></td>
                    <td>{{ k.outlet }}</td>
                    <td class="num"><b>{{ k.kpiScore }}</b>/100</td>
                    <td class="num">{{ k.attendanceScore }}%</td>
                    <td class="num">{{ k.patientFeedback }} ★</td>
                    <td><span class="pill ok">{{ k.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    }
  `
})
export class HrPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(CloudStateService);
  private subRoute?: Subscription;

  sub = 'data-karyawan';
  employees: EmployeeItem[] = [];
  empSearch = '';
  showEmpDrawer = false;
  editingEmpId: string | null = null;
  empForm = { nip: '', name: '', nik: '', department: 'Medis & Poliklinik', position: 'Staf', employmentStatus: 'Tetap', outlet: 'Klinik Utama', baseSalary: 5000000 };

  users: UserOutlet[] = [];
  userSearch = '';
  userOutletFilter = 'Semua';
  showUserDrawer = false;
  editingUserId: string | null = null;
  userForm = { name: '', email: '', role: 'Dokter', outlet: 'Klinik Utama', allowedOutlets: ['Klinik Utama'] as string[], nik: '', strSip: '' };

  roles: RolePermDef[] = [];
  selectedRole: RolePermDef | null = null;
  readonly moduleCodes = ['DB', 'MO', 'HR', 'KE', 'AK', 'PU', 'IN', 'GA', 'MK', 'IT', 'LP', 'PS'];
  readonly permActions = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

  schedTab: 'schedules' | 'attendance' | 'leaves' = 'schedules';
  schedules: ScheduleItem[] = [];
  attendance: Array<{ id: string; date: string; staffName: string; outlet: string; checkIn: string; checkOut: string; status: string }> = [];
  leaves: Array<{ id: string; staffName: string; outlet: string; leaveType: string; dateRange: string; reason: string; status: string }> = [];
  showScheduleDrawer = false;
  schedForm = { staffName: '', outlet: 'Klinik Utama', poli: 'Poli Umum', day: 'Senin - Jumat', shift: '08:00 - 14:00', quota: 30 };

  credentials: CredentialItem[] = [];
  showCredDrawer = false;
  editingCredId: string | null = null;
  credForm = { staffName: '', profession: 'Dokter Umum', outlet: 'Klinik Utama', strNo: '', sipNo: '', expiryDate: '2029-12-31', ihsId: '', status: 'Aktif' };

  payTab: 'payroll' | 'fees' | 'rules' = 'payroll';
  payrolls: PayrollItem[] = [];
  doctorFees: DoctorFeeItem[] = [];
  feeRules: FeeRuleItem[] = [];

  recTab: 'recruitment' | 'kpi' = 'recruitment';
  requisitions: Array<{ id: string; title: string; outlet: string; headcount: number; urgency: string; status: string }> = [];
  applicants: Array<{ id: string; name: string; outlet: string; phone: string; stage: string; score: number }> = [];
  performance: Array<{ id: string; period: string; staffName: string; outlet: string; kpiScore: number; attendanceScore: number; patientFeedback: number; status: string }> = [];
  showJobDrawer = false;
  jobForm = { title: '', outlet: 'Klinik Utama', headcount: 1, urgency: 'Sedang' };

  empPage = 1;
  userPage = 1;
  pageSize = 10;

  get filteredEmployees(): EmployeeItem[] {
    return filterRows(this.employees, this.empSearch);
  }

  get pagedEmployees(): EmployeeItem[] {
    return paginateRows(this.filteredEmployees, this.empPage, this.pageSize);
  }

  get filteredUsers(): UserOutlet[] {
    return filterRows(this.users, this.userSearch, [
      (u) => this.userOutletFilter === 'Semua' || u.outlet === this.userOutletFilter
    ]);
  }

  get pagedUsers(): UserOutlet[] {
    return paginateRows(this.filteredUsers, this.userPage, this.pageSize);
  }

  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe((p) => {
      this.sub = p.get('sub') || 'data-karyawan';
      this.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  private loadAll(): void {
    if (this.sub === 'data-karyawan') {
      this.http.get<EmployeeItem[]>(`${this.state.apiBase}/hr/employees`).subscribe({ next: (list) => (this.employees = list || []) });
    } else if (this.sub === 'manajemen-user') {
      this.http.get<UserOutlet[]>(`${this.state.apiBase}/users`).subscribe({ next: (list) => (this.users = list || []) });
    } else if (this.sub === 'role-permission') {
      this.http.get<RolePermDef[]>(`${this.state.apiBase}/hr/roles`).subscribe({
        next: (list) => {
          this.roles = list || [];
          if (!this.selectedRole && this.roles.length > 0) this.selectedRole = this.roles[0];
        }
      });
    } else if (this.sub === 'absensi-jadwal') {
      this.http
        .get<{
          schedules: ScheduleItem[];
          attendance: Array<{ id: string; date: string; staffName: string; outlet: string; checkIn: string; checkOut: string; status: string }>;
          leaves: Array<{ id: string; staffName: string; outlet: string; leaveType: string; dateRange: string; reason: string; status: string }>;
        }>(`${this.state.apiBase}/hr/schedules`)
        .subscribe({
          next: (res) => {
            this.schedules = res.schedules || [];
            this.attendance = res.attendance || [];
            this.leaves = res.leaves || [];
          }
        });
    } else if (this.sub === 'str-sip-kompetensi') {
      this.http.get<CredentialItem[]>(`${this.state.apiBase}/hr/credentials`).subscribe({ next: (list) => (this.credentials = list || []) });
    } else if (this.sub === 'penggajian-jasa-medis') {
      this.http
        .get<{ payrolls: PayrollItem[]; doctorFees: DoctorFeeItem[]; feeRules: FeeRuleItem[] }>(`${this.state.apiBase}/hr/payroll`)
        .subscribe({
          next: (res) => {
            this.payrolls = res.payrolls || [];
            this.doctorFees = res.doctorFees || [];
            this.feeRules = res.feeRules || [];
          }
        });
    } else if (this.sub === 'rekrutmen-kinerja') {
      this.http
        .get<{
          requisitions: Array<{ id: string; title: string; outlet: string; headcount: number; urgency: string; status: string }>;
          applicants: Array<{ id: string; name: string; outlet: string; phone: string; stage: string; score: number }>;
          performance: Array<{ id: string; period: string; staffName: string; outlet: string; kpiScore: number; attendanceScore: number; patientFeedback: number; status: string }>;
        }>(`${this.state.apiBase}/hr/recruitment`)
        .subscribe({
          next: (res) => {
            this.requisitions = res.requisitions || [];
            this.applicants = res.applicants || [];
            this.performance = res.performance || [];
          }
        });
    }
  }

  countEmpStatus(t: string): number { return this.employees.filter((e) => e.employmentStatus === t).length; }
  countEmpActive(): number { return this.employees.filter((e) => e.status === 'Aktif').length; }
  countCred(s: string): number { return this.credentials.filter((c) => c.status === s).length; }

  openEmpDrawer(e?: EmployeeItem): void {
    this.editingEmpId = e?.id || null;
    this.empForm = e
      ? { nip: e.nip, name: e.name, nik: e.nik, department: e.department, position: e.position, employmentStatus: e.employmentStatus, outlet: e.outlet, baseSalary: e.baseSalary }
      : { nip: '', name: '', nik: '', department: 'Medis & Poliklinik', position: 'Staf', employmentStatus: 'Tetap', outlet: 'Klinik Utama', baseSalary: 5000000 };
    this.showEmpDrawer = true;
  }

  saveEmployee(): void {
    if (this.editingEmpId) {
      this.http.put<EmployeeItem>(`${this.state.apiBase}/hr/employees/${this.editingEmpId}`, this.empForm).subscribe({
        next: (updated) => {
          this.employees = this.employees.map((x) => (x.id === updated.id ? updated : x));
          this.showEmpDrawer = false;
          this.state.showToast('Data karyawan diperbarui');
        }
      });
      return;
    }
    this.http.post<EmployeeItem>(`${this.state.apiBase}/hr/employees`, this.empForm).subscribe({
      next: (created) => {
        this.employees = [created, ...this.employees];
        this.showEmpDrawer = false;
        this.state.showToast(`Karyawan ${created.name} ditambahkan`);
      }
    });
  }

  openUserDrawer(u?: UserOutlet): void {
    this.editingUserId = u?.id || null;
    this.userForm = u
      ? {
          name: u.name,
          email: u.email || '',
          role: u.role,
          outlet: u.outlet,
          allowedOutlets: [...(u.allowedOutlets || [u.outlet])],
          nik: u.nik || '',
          strSip: u.strSip || ''
        }
      : { name: '', email: '', role: 'Dokter', outlet: 'Klinik Utama', allowedOutlets: ['Klinik Utama'], nik: '', strSip: '' };
    this.showUserDrawer = true;
  }

  toggleAllowedOutlet(name: string): void {
    const idx = this.userForm.allowedOutlets.indexOf(name);
    if (idx === -1) this.userForm.allowedOutlets = [...this.userForm.allowedOutlets, name];
    else this.userForm.allowedOutlets = this.userForm.allowedOutlets.filter((x) => x !== name);
  }

  saveUser(): void {
    if (this.editingUserId) {
      this.http.put<UserOutlet>(`${this.state.apiBase}/users/${this.editingUserId}`, this.userForm).subscribe({
        next: (updated) => {
          this.users = this.users.map((u) => (u.id === updated.id ? updated : u));
          this.showUserDrawer = false;
          this.state.showToast(`User ${updated.name} diperbarui`);
        }
      });
      return;
    }
    this.http.post<UserOutlet>(`${this.state.apiBase}/users`, this.userForm).subscribe({
      next: (created) => {
        this.users = [...this.users, created];
        this.showUserDrawer = false;
        this.state.showToast(`User ${created.name} dibuat & dijadwalkan sync`);
      }
    });
  }

  resetPassword(u: UserOutlet): void {
    this.http.post(`${this.state.apiBase}/users/${u.id}/reset-password`, { newPassword: '123456' }).subscribe({
      next: () => this.state.showToast(`Password ${u.name} direset ke default: 123456`)
    });
  }

  toggleUserStatus(u: UserOutlet): void {
    const nextStatus = u.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    this.http.put<UserOutlet>(`${this.state.apiBase}/users/${u.id}`, { status: nextStatus }).subscribe({
      next: (updated) => {
        this.users = this.users.map((x) => (x.id === updated.id ? updated : x));
        this.state.showToast(`Status ${updated.name}: ${updated.status}`);
      }
    });
  }

  confirmDeleteUser(u: UserOutlet): void {
    this.state.askConfirm({
      title: 'Hapus User',
      message: `Yakin menghapus akun login "${u.name}"?`,
      confirmLabel: 'Ya, Hapus',
      danger: true,
      onConfirm: () => {
        this.http.delete(`${this.state.apiBase}/users/${u.id}`).subscribe({
          next: () => {
            this.users = this.users.filter((x) => x.id !== u.id);
            this.state.showToast(`User ${u.name} dihapus`);
          }
        });
      }
    });
  }

  saveRoleMatrix(sr: RolePermDef): void {
    this.http.put(`${this.state.apiBase}/hr/roles/${encodeURIComponent(sr.role)}`, { matrix: sr.matrix }).subscribe({
      next: () => this.state.showToast(`RBAC role ${sr.role} disimpan & disinkronkan`)
    });
  }

  saveSchedule(): void {
    this.http.post<ScheduleItem>(`${this.state.apiBase}/hr/schedules`, this.schedForm).subscribe({
      next: (created) => {
        this.schedules = [created, ...this.schedules];
        this.showScheduleDrawer = false;
        this.state.showToast('Jadwal baru ditambahkan');
      }
    });
  }

  decideLeave(lv: { id: string; status: string }, status: string): void {
    this.http.put(`${this.state.apiBase}/hr/leaves/${lv.id}`, { status }).subscribe({
      next: () => {
        lv.status = status;
        this.state.showToast(`Pengajuan cuti ${status}`);
      }
    });
  }

  openCredDrawer(c?: CredentialItem): void {
    this.editingCredId = c?.id || null;
    this.credForm = c
      ? { staffName: c.staffName, profession: c.profession, outlet: c.outlet, strNo: c.strNo, sipNo: c.sipNo, expiryDate: c.expiryDate, ihsId: c.ihsId, status: c.status }
      : { staffName: '', profession: 'Dokter Umum', outlet: 'Klinik Utama', strNo: '', sipNo: '', expiryDate: '2029-12-31', ihsId: '', status: 'Aktif' };
    this.showCredDrawer = true;
  }

  saveCredential(): void {
    if (this.editingCredId) {
      this.http.put<CredentialItem>(`${this.state.apiBase}/hr/credentials/${this.editingCredId}`, this.credForm).subscribe({
        next: (updated) => {
          this.credentials = this.credentials.map((x) => (x.id === updated.id ? updated : x));
          this.showCredDrawer = false;
          this.state.showToast('Data STR/SIP diperbarui');
        }
      });
      return;
    }
    this.http.post<CredentialItem>(`${this.state.apiBase}/hr/credentials`, this.credForm).subscribe({
      next: (created) => {
        this.credentials = [created, ...this.credentials];
        this.showCredDrawer = false;
        this.state.showToast('Data STR/SIP baru ditambahkan');
      }
    });
  }

  saveFeeRule(r: FeeRuleItem): void {
    this.http.put(`${this.state.apiBase}/hr/fee-rules/${r.id}`, r).subscribe({
      next: () => this.state.showToast(`Skema ${r.serviceCategory} diperbarui`)
    });
  }

  finalizePayroll(): void {
    this.state.askConfirm({
      title: 'Finalisasi Payroll & Jasa Medis',
      message: 'Aksi ini akan menandai seluruh slip periode 2026-11 dibayar dan memposting jurnal beban gaji serta hutang PPh 21 ke Akunting.',
      confirmLabel: 'Finalisasi & Posting Jurnal',
      onConfirm: () => {
        this.http.post<{ finalizedCount: number }>(`${this.state.apiBase}/hr/payroll/finalize`, { period: '2026-11' }).subscribe({
          next: (res) => {
            this.state.showToast(`${res.finalizedCount} slip gaji difinalisasi & diposting ke Jurnal`);
            this.loadAll();
          },
          error: (err) => this.state.showToast(err?.error?.message || 'Sudah difinalisasi')
        });
      }
    });
  }

  saveJobReq(): void {
    this.http
      .post<{ id: string; title: string; outlet: string; headcount: number; urgency: string; status: string }>(
        `${this.state.apiBase}/hr/recruitment/requisitions`,
        this.jobForm
      )
      .subscribe({
        next: (created) => {
          this.requisitions = [created, ...this.requisitions];
          this.showJobDrawer = false;
          this.state.showToast('Lowongan dipublikasikan');
        }
      });
  }

  advanceApplicant(a: { id: string; stage: string }, stage: string): void {
    this.http.put(`${this.state.apiBase}/hr/recruitment/applicants/${a.id}`, { stage }).subscribe({
      next: () => {
        a.stage = stage;
        this.state.showToast('Kandidat diterima & otomatis masuk ke Data Karyawan');
      }
    });
  }
}
