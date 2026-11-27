import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SoapFormModel {
  encounterId: string;
  patientLabel: string;
  subjective: string;
  objective: string;
  icd10: string;
  plan: string;
  prescription: string;
  signa: string;
}

@Component({
  selector: 'app-soap-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Input Pemeriksaan SOAP &amp; e-Resep <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Pasien * <input [(ngModel)]="model.patientLabel" placeholder="Ahmad Fauzi" /></label>
        <label>Subjective (Keluhan) <input [(ngModel)]="model.subjective" /></label>
        <label>Objective (TTV) <input [(ngModel)]="model.objective" /></label>
        <label>Diagnosa ICD-10 <input [(ngModel)]="model.icd10" /></label>
        <label>Plan / Tindakan <input [(ngModel)]="model.plan" /></label>
        <label>e-Resep Obat <input [(ngModel)]="model.prescription" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan SOAP &amp; Kirim Resep</button>
      </div>
    </div>
  `
})
export class SoapFormComponent {
  @Input({ required: true }) model!: SoapFormModel;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
