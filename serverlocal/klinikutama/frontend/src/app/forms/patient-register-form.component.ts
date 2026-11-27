import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PatientRegisterModel {
  name: string;
  nik: string;
  bpjsNo: string;
  poli: string;
  doctor: string;
  payer: string;
}

@Component({
  selector: 'app-patient-register-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Registrasi Pasien Baru / Kunjungan <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama Pasien * <input [(ngModel)]="model.name" placeholder="Nama lengkap pasien" /></label>
        <label>NIK (16 Digit) <input [(ngModel)]="model.nik" placeholder="3275xxxxxxxxxxxx" /></label>
        <label>No. Kartu BPJS <input [(ngModel)]="model.bpjsNo" placeholder="00012988412" /></label>
        <label>Poli Tujuan <select [(ngModel)]="model.poli"><option value="Poli Penyakit Dalam">Poli Penyakit Dalam</option><option value="Poli Anak">Poli Anak</option><option value="Poli Bedah">Poli Bedah</option><option value="Poli Gigi">Poli Gigi</option></select></label>
        <label>Dokter DPJP <input [(ngModel)]="model.doctor" /></label>
        <label>Penjamin <select [(ngModel)]="model.payer"><option value="BPJS Kesehatan (SEP)">BPJS Kesehatan (SEP)</option><option value="Umum / Mandiri">Umum / Mandiri</option></select></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Daftarkan Pasien</button>
      </div>
    </div>
  `
})
export class PatientRegisterFormComponent {
  @Input({ required: true }) model!: PatientRegisterModel;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
