import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ApotekSaleModel {
  saleType: string;
  buyerName: string;
  itemsSummary: string;
  signa: string;
  totalRp: number;
}

@Component({
  selector: 'app-apotek-sale-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Transaksi Penjualan POS Apotek <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Jenis Penjualan <select [(ngModel)]="model.saleType"><option value="Penjualan Bebas (OTC)">Penjualan Bebas (OTC)</option><option value="Resep Dokter">Resep Dokter</option><option value="BPJS PRB">BPJS PRB</option></select></label>
        <label>Nama Pembeli / Pasien <input [(ngModel)]="model.buyerName" /></label>
        <label>Item Obat <input [(ngModel)]="model.itemsSummary" /></label>
        <label>Aturan Pakai (Etiket) <input [(ngModel)]="model.signa" /></label>
        <label>Total Harga (Rp) <input type="number" [(ngModel)]="model.totalRp" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Bayar &amp; Cetak Struk</button>
      </div>
    </div>
  `
})
export class ApotekSaleFormComponent {
  @Input({ required: true }) model!: ApotekSaleModel;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
