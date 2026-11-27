import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-promo-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Buat Promo / Paket Layanan <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Kode Promo <input [(ngModel)]="model.code" placeholder="SEHAT20" /></label>
        <label>Nama Promo / Paket <input [(ngModel)]="model.name" /></label>
        <label>Jenis <select [(ngModel)]="model.type"><option value="Voucher Promo">Voucher Promo</option><option value="Paket Layanan">Paket Layanan</option></select></label>
        <label>Tipe Diskon <select [(ngModel)]="model.discountType"><option value="Persen">Persen (%)</option><option value="Nominal">Nominal (Rp)</option></select></label>
        <label>Nilai Diskon <input type="number" [(ngModel)]="model.discountValue" /></label>
        <label>Berlaku Sampai <input type="date" [(ngModel)]="model.validUntil" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Publish Promo ke Cabang</button>
      </div>
    </div>
  `
})
export class PromoFormComponent {
  @Input({ required: true }) model!: { code: string; name: string; type: string; discountType: string; discountValue: number; validUntil: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
