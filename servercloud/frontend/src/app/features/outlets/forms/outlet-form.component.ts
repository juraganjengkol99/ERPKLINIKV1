import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface OutletFormModel {
  type: string;
  name: string;
  nib: string;
  address: string;
  phone: string;
  adminEmail: string;
  satuSehatEnv: string;
  satuSehatOrgId: string;
  satuSehatLocId: string;
  satuSehatClientId: string;
  satuSehatClientSecret: string;
  bpjsServiceType: string;
  bpjsEnv: string;
  bpjsPpkCode: string;
  bpjsConsId: string;
  bpjsSecretKey: string;
  bpjsUserKey: string;
}

@Component({
  selector: 'app-outlet-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel">
      <h2>
        {{ editingOutletId ? 'Edit Profil & Kredensial Bridging Outlet' : '1. Profil & Legalitas Outlet Baru' }}
        <span class="pill" [ngClass]="form.name ? 'ok' : 'warn'">{{ form.name ? 'Siap' : 'Wajib Diisi' }}</span>
        <span class="sp"></span>
        @if (editingOutletId) {
          <button class="ib btn-sm" type="button" (click)="resetClicked.emit()">Batal Edit</button>
        }
      </h2>
      <div class="form">
        <label>
          Tipe Outlet
          <select [ngModel]="form.type" (ngModelChange)="typeChanged.emit($event)">
            <option value="Klinik Utama (Rawat Inap & Jalan)">Klinik Utama (Rawat Inap &amp; Jalan)</option>
            <option value="Klinik Utama (Rawat Jalan)">Klinik Utama (Rawat Jalan)</option>
            <option value="Klinik Pratama (Rawat Inap & Jalan)">Klinik Pratama (Rawat Inap &amp; Jalan)</option>
            <option value="Klinik Pratama (Rawat Jalan)">Klinik Pratama (Rawat Jalan)</option>
            <option value="Apotek">Apotek</option>
          </select>
        </label>
        <label>Nama Outlet * <input [(ngModel)]="form.name" placeholder="Contoh: Klinik Cabang Bogor" /></label>
        <label>NIB / Izin Operasional <input [(ngModel)]="form.nib" placeholder="91203018201" /></label>
        <label>No. Telepon / WhatsApp <input [(ngModel)]="form.phone" placeholder="021-8881234" /></label>
        <label>Alamat Lengkap <input [(ngModel)]="form.address" placeholder="Jl. Pajajaran No. 18, Bogor" /></label>
        <label>Email Admin Outlet <input [(ngModel)]="form.adminEmail" placeholder="admin.cabang@klinik.id" /></label>
      </div>
    </div>

    <div class="panel">
      <h2>
        2. Bridging SATUSEHAT (Kemenkes FHIR R4)
        <span class="sp"></span>
        <button class="ib btn-sm" type="button" (click)="testBridging.emit('SATUSEHAT')">Test Koneksi SATUSEHAT</button>
      </h2>
      @if (ssTestBanner) {
        <div class="banner" [ngClass]="ssTestBanner.ok ? 'info' : 'bad'">{{ ssTestBanner.text }}</div>
      }
      <div class="form">
        <label>
          Environment
          <select [(ngModel)]="form.satuSehatEnv">
            <option value="Sandbox">Sandbox (Staging)</option>
            <option value="Production">Production (Live)</option>
          </select>
        </label>
        <label>Organization ID <input [(ngModel)]="form.satuSehatOrgId" placeholder="10002819" /></label>
        <label>Location ID <input [(ngModel)]="form.satuSehatLocId" placeholder="LOC-99182" /></label>
        <label>Client ID <input [(ngModel)]="form.satuSehatClientId" placeholder="Client Key SATUSEHAT" /></label>
        <label>
          Client Secret
          @if (editingOutletId && hasExistingSsSecret && !editSsSecret) {
            <div class="secret-wrap">
              <input [value]="'Tersimpan (' + maskedSsSecret + ')'" disabled />
              <button class="ib btn-sm" type="button" (click)="editSsSecret = true">Ganti</button>
            </div>
          } @else {
            <div class="secret-wrap">
              <input [type]="showSsSecret ? 'text' : 'password'" [(ngModel)]="form.satuSehatClientSecret" placeholder="Masukkan secret baru" autocomplete="new-password" />
              <button class="ib btn-sm" type="button" (click)="showSsSecret = !showSsSecret">{{ showSsSecret ? 'Tutup' : 'Lihat' }}</button>
            </div>
          }
        </label>
      </div>
    </div>

    <div class="panel">
      <h2>
        3. Bridging BPJS Kesehatan
        <span class="sp"></span>
        <button class="ib btn-sm" type="button" (click)="testBridging.emit('BPJS')">Test Koneksi BPJS</button>
      </h2>
      @if (bpjsTestBanner) {
        <div class="banner" [ngClass]="bpjsTestBanner.ok ? 'info' : 'bad'">{{ bpjsTestBanner.text }}</div>
      }
      <div class="form">
        <label>
          Jenis Layanan BPJS
          <select [(ngModel)]="form.bpjsServiceType">
            <option value="VClaim (FKRTL / Rawat Inap & Jalan)">VClaim + Antrol + Aplicares (Klinik Utama)</option>
            <option value="P-Care (FKTP)">P-Care + Antrol FKTP (Klinik Pratama)</option>
            <option value="Apotek Online / PRB">Apotek Online / PRB (Apotek)</option>
          </select>
        </label>
        <label>
          Environment
          <select [(ngModel)]="form.bpjsEnv">
            <option value="Development">Development / UAT</option>
            <option value="Production">Production (Live)</option>
          </select>
        </label>
        <label>Kode PPK BPJS <input [(ngModel)]="form.bpjsPpkCode" placeholder="0112B009" /></label>
        <label>Cons ID <input [(ngModel)]="form.bpjsConsId" placeholder="28491" /></label>
        <label>
          Secret Key BPJS
          @if (editingOutletId && hasExistingBpjsSecret && !editBpjsSecret) {
            <div class="secret-wrap">
              <input [value]="'Tersimpan (' + maskedBpjsSecret + ')'" disabled />
              <button class="ib btn-sm" type="button" (click)="editBpjsSecret = true">Ganti</button>
            </div>
          } @else {
            <div class="secret-wrap">
              <input [type]="showBpjsSecret ? 'text' : 'password'" [(ngModel)]="form.bpjsSecretKey" placeholder="Secret Key BPJS" autocomplete="new-password" />
              <button class="ib btn-sm" type="button" (click)="showBpjsSecret = !showBpjsSecret">{{ showBpjsSecret ? 'Tutup' : 'Lihat' }}</button>
            </div>
          }
        </label>
        <label>
          User Key BPJS
          @if (editingOutletId && hasExistingBpjsUserKey && !editBpjsUserKey) {
            <div class="secret-wrap">
              <input [value]="'Tersimpan (' + maskedBpjsUserKey + ')'" disabled />
              <button class="ib btn-sm" type="button" (click)="editBpjsUserKey = true">Ganti</button>
            </div>
          } @else {
            <div class="secret-wrap">
              <input [type]="showBpjsUserKey ? 'text' : 'password'" [(ngModel)]="form.bpjsUserKey" placeholder="User Key BPJS" autocomplete="new-password" />
              <button class="ib btn-sm" type="button" (click)="showBpjsUserKey = !showBpjsUserKey">{{ showBpjsUserKey ? 'Tutup' : 'Lihat' }}</button>
            </div>
          }
        </label>
      </div>
    </div>

    <div class="action-bar">
      <span class="hint-text">Modul lokal terbentuk otomatis sesuai template tipe <b>{{ form.type }}</b>.</span>
      <div style="display:flex;gap:8px">
        <button class="ib" type="button" (click)="backClicked.emit()">Kembali ke Daftar</button>
        <button class="btn" type="button" (click)="saveClicked.emit()">
          {{ editingOutletId ? 'Simpan Perubahan Outlet' : 'Buat Outlet & Generate Lisensi' }}
        </button>
      </div>
    </div>
  `
})
export class OutletFormComponent {
  @Input({ required: true }) form!: OutletFormModel;
  @Input() editingOutletId: string | null = null;
  @Input() hasExistingSsSecret = false;
  @Input() maskedSsSecret = '';
  @Input() hasExistingBpjsSecret = false;
  @Input() maskedBpjsSecret = '';
  @Input() hasExistingBpjsUserKey = false;
  @Input() maskedBpjsUserKey = '';
  @Input() ssTestBanner: { ok: boolean; text: string } | null = null;
  @Input() bpjsTestBanner: { ok: boolean; text: string } | null = null;

  @Output() typeChanged = new EventEmitter<string>();
  @Output() testBridging = new EventEmitter<'SATUSEHAT' | 'BPJS'>();
  @Output() resetClicked = new EventEmitter<void>();
  @Output() backClicked = new EventEmitter<void>();
  @Output() saveClicked = new EventEmitter<void>();

  editSsSecret = false;
  showSsSecret = false;
  editBpjsSecret = false;
  showBpjsSecret = false;
  editBpjsUserKey = false;
  showBpjsUserKey = false;
}
