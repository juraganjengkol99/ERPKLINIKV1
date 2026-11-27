import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface LabFormModel {
  patientLabel: string;
  modality: string;
  examName: string;
  resultValue: string;
  normalRef: string;
}

@Component({
  selector: 'app-lab-order-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Order / Input Hasil Penunjang Medis <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Pasien <input [(ngModel)]="model.patientLabel" /></label>
        <label>Modalitas <select [(ngModel)]="model.modality"><option value="Laboratorium">Laboratorium</option><option value="Radiologi">Radiologi</option><option value="Fisioterapi">Fisioterapi</option></select></label>
        <label>Nama Pemeriksaan <input [(ngModel)]="model.examName" /></label>
        <label>Hasil Pemeriksaan <input [(ngModel)]="model.resultValue" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Penunjang</button>
      </div>
    </div>
  `
})
export class LabOrderFormComponent {
  @Input({ required: true }) model!: LabFormModel;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
