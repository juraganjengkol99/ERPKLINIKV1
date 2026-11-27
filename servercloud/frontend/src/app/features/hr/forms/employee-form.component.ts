import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OutletStatusItem } from '../../../core/models/erp.models';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>{{ editing ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru' }} <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>NIP <input [(ngModel)]="model.nip" placeholder="Otomatis jika kosong" /></label>
        <label>Nama Lengkap <input [(ngModel)]="model.name" /></label>
        <label>NIK <input [(ngModel)]="model.nik" /></label>
        <label>Departemen <input [(ngModel)]="model.department" /></label>
        <label>Jabatan <input [(ngModel)]="model.position" /></label>
        <label>
          Status Kepegawaian
          <select [(ngModel)]="model.employmentStatus">
            <option value="Tetap">Tetap</option>
            <option value="Kontrak">Kontrak</option>
            <option value="Mitra">Mitra / Dokter</option>
          </select>
        </label>
        <label>
          Outlet Penempatan
          <select [(ngModel)]="model.outlet">
            @for (o of outlets; track o.outletId) {
              <option [value]="o.name">{{ o.name }}</option>
            }
          </select>
        </label>
        <label>Gaji Pokok (Rp) <input type="number" [(ngModel)]="model.baseSalary" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Data Karyawan</button>
      </div>
    </div>
  `
})
export class EmployeeFormComponent {
  @Input({ required: true }) model!: { nip: string; name: string; nik: string; department: string; position: string; employmentStatus: string; outlet: string; baseSalary: number };
  @Input() outlets: OutletStatusItem[] = [];
  @Input() editing = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
