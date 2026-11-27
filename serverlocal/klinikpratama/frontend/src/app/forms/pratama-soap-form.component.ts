import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PratamaSoapModel {
  encounterId: string;
  patientLabel: string;
  subjective: string;
  objective: string;
  icd10: string;
  plan: string;
  prescription: string;
}

@Component({
  selector: 'app-pratama-soap-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Input SOAP &amp; Resep FKTP <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Pasien <input [(ngModel)]="model.patientLabel" /></label>
        <label>Keluhan <input [(ngModel)]="model.subjective" /></label>
        <label>TTV <input [(ngModel)]="model.objective" /></label>
        <label>Diagnosa ICD-10 <input [(ngModel)]="model.icd10" /></label>
        <label>Resep <input [(ngModel)]="model.prescription" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan SOAP</button>
      </div>
    </div>
  `
})
export class PratamaSoapFormComponent {
  @Input({ required: true }) model!: PratamaSoapModel;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
