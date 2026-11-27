import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ApotekNarcoticModel {
  drugName: string;
  patientName: string;
  patientAddress: string;
  doctorName: string;
  qtyOut: number;
}

@Component({
  selector: 'app-apotek-narcotic-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Catat Pengeluaran Narkotika (SIPNAP) <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama Obat Narkotika <input [(ngModel)]="model.drugName" /></label>
        <label>Nama Pasien <input [(ngModel)]="model.patientName" /></label>
        <label>Alamat Pasien (Wajib) <input [(ngModel)]="model.patientAddress" /></label>
        <label>Dokter Penulis Resep <input [(ngModel)]="model.doctorName" /></label>
        <label>Qty Keluar <input type="number" [(ngModel)]="model.qtyOut" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Register SIPNAP</button>
      </div>
    </div>
  `
})
export class ApotekNarcoticFormComponent {
  @Input({ required: true }) model!: ApotekNarcoticModel;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
