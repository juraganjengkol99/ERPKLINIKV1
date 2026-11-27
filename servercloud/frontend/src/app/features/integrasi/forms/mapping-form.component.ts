import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-mapping-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>{{ editing ? 'Petakan Kode Standar' : 'Tambah Mapping Kode' }} <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>
          Standar
          <select [(ngModel)]="model.standard" [disabled]="editing">
            <option value="KFA">KFA (Obat &amp; Alkes)</option>
            <option value="ICD-10">ICD-10 (Diagnosa)</option>
            <option value="ICD-9-CM">ICD-9-CM (Tindakan)</option>
            <option value="LOINC">LOINC (Laboratorium)</option>
          </select>
        </label>
        <label>Kode Lokal <input [(ngModel)]="model.localCode" [disabled]="editing" /></label>
        <label>Nama Lokal <input [(ngModel)]="model.localName" [disabled]="editing" /></label>
        <label>Kode Standar Kemenkes / WHO <input [(ngModel)]="model.standardCode" placeholder="Contoh: 93001 / J06.9" /></label>
        <label>Deskripsi Display Standar <input [(ngModel)]="model.standardDisplay" placeholder="Nama terminologi standar" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan &amp; Broadcast Mapping</button>
      </div>
    </div>
  `
})
export class MappingFormComponent {
  @Input({ required: true }) model!: { standard: string; localCode: string; localName: string; standardCode: string; standardDisplay: string };
  @Input() editing = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
