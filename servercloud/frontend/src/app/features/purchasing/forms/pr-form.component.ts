import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pr-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Buat Permintaan Pembelian (PR) <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Kode KFA <input [(ngModel)]="model.itemCode" placeholder="KFA-93005" /></label>
        <label>Qty Diminta <input type="number" [(ngModel)]="model.qty" /></label>
        <label>Alasan Pengajuan <input [(ngModel)]="model.reason" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Kirim Permintaan Pembelian</button>
      </div>
    </div>
  `
})
export class PrFormComponent {
  @Input({ required: true }) model!: { itemCode: string; qty: number; reason: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
