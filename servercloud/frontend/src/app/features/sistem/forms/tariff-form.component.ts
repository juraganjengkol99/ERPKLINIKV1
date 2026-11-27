import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tariff-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah Tarif Layanan Baru <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Kode Layanan <input [(ngModel)]="model.code" placeholder="TND-EKG-01" /></label>
        <label>Nama Layanan <input [(ngModel)]="model.name" placeholder="Pemeriksaan EKG 12 Lead" /></label>
        <label>
          Kategori
          <select [(ngModel)]="model.category">
            <option value="Konsultasi">Konsultasi</option>
            <option value="Tindakan">Tindakan</option>
            <option value="Laboratorium">Laboratorium</option>
            <option value="Kamar">Kamar</option>
          </select>
        </label>
        <label>Tarif Umum (Rp) <input type="number" [(ngModel)]="model.basePriceRp" /></label>
        <label>Tarif BPJS (Rp) <input type="number" [(ngModel)]="model.bpjsTariffRp" /></label>
        <label>Berlaku di <input [(ngModel)]="model.applicableTo" placeholder="Semua Klinik / Klinik Utama" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan &amp; Sync Tarif</button>
      </div>
    </div>
  `
})
export class TariffFormComponent {
  @Input({ required: true }) model!: { code: string; name: string; category: string; basePriceRp: number; bpjsTariffRp: number; applicableTo: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
