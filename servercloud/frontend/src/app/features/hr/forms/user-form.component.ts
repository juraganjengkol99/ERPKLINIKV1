import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OutletStatusItem } from '../../../core/models/erp.models';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>{{ editing ? 'Edit User' : 'Buat User Baru' }} <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama Lengkap <input [(ngModel)]="model.name" /></label>
        <label>Email / Username <input [(ngModel)]="model.email" /></label>
        <label>
          Role
          <select [(ngModel)]="model.role">
            <option value="Dokter">Dokter</option>
            <option value="Perawat">Perawat</option>
            <option value="Apoteker">Apoteker</option>
            <option value="Kasir">Kasir</option>
            <option value="Pendaftaran">Pendaftaran</option>
            <option value="Admin Outlet">Admin Outlet</option>
            <option value="Manajer HR & SDM">Manajer HR &amp; SDM</option>
            <option value="Manajer Keuangan & Akunting">Manajer Keuangan &amp; Akunting</option>
            <option value="Manajer Purchasing & Logistik">Manajer Purchasing &amp; Logistik</option>
          </select>
        </label>
        <label>
          Outlet Penempatan Utama
          <select [(ngModel)]="model.outlet">
            @for (o of outlets; track o.outletId) {
              <option [value]="o.name">{{ o.name }}</option>
            }
          </select>
        </label>
        <label>NIK (16 Digit) <input [(ngModel)]="model.nik" /></label>
        <label>No. STR / SIP <input [(ngModel)]="model.strSip" /></label>
      </div>
      <div style="padding:0 18px 12px">
        <div class="hint-text" style="margin-bottom:6px;font-weight:600">Akses Multi-Outlet (Klik untuk pilih)</div>
        <div class="chip-group">
          @for (o of outlets; track o.outletId) {
            <button
              class="chip"
              type="button"
              [class.on]="model.allowedOutlets.includes(o.name)"
              (click)="toggleOutlet.emit(o.name)">
              {{ o.name }}
            </button>
          }
        </div>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan &amp; Sinkronkan ke Cabang</button>
      </div>
    </div>
  `
})
export class UserFormComponent {
  @Input({ required: true }) model!: { name: string; email: string; role: string; outlet: string; allowedOutlets: string[]; nik: string; strSip: string };
  @Input() outlets: OutletStatusItem[] = [];
  @Input() editing = false;
  @Output() toggleOutlet = new EventEmitter<string>();
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
