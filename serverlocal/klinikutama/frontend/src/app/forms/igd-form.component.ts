import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface IgdFormModel {
  patientName: string;
  triageLevel: string;
  complaint: string;
  vitals: string;
  disposition: string;
}

@Component({
  selector: 'app-igd-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Input Kasus IGD / Triase <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama Pasien * <input [(ngModel)]="model.patientName" /></label>
        <label>Level Triase <select [(ngModel)]="model.triageLevel"><option value="Merah (Resusitasi)">Merah (Resusitasi)</option><option value="Kuning (Urgent)">Kuning (Urgent)</option><option value="Hijau (Non-Urgent)">Hijau (Non-Urgent)</option></select></label>
        <label>Keluhan Utama <input [(ngModel)]="model.complaint" /></label>
        <label>Tanda Vital <input [(ngModel)]="model.vitals" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Kasus IGD</button>
      </div>
    </div>
  `
})
export class IgdFormComponent {
  @Input({ required: true }) model!: IgdFormModel;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
