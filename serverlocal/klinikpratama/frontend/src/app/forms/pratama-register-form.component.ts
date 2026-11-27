import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PratamaRegisterModel {
  name: string;
  nik: string;
  bpjsNo: string;
  poli: string;
  doctor: string;
  payer: string;
}

@Component({
  selector: 'app-pratama-register-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Registrasi Pasien FKTP <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama Pasien * <input [(ngModel)]="model.name" /></label>
        <label>NIK <input [(ngModel)]="model.nik" /></label>
        <label>Poli <select [(ngModel)]="model.poli"><option value="Poli Umum">Poli Umum</option><option value="Poli Gigi">Poli Gigi</option><option value="KIA / KB">KIA / KB</option></select></label>
        <label>Penjamin <select [(ngModel)]="model.payer"><option value="BPJS P-Care">BPJS P-Care</option><option value="Umum / Mandiri">Umum / Mandiri</option></select></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Daftarkan</button>
      </div>
    </div>
  `
})
export class PratamaRegisterFormComponent {
  @Input({ required: true }) model!: PratamaRegisterModel;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
