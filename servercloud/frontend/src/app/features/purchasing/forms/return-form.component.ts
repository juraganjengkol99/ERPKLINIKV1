import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-return-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Buat Retur Pembelian <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Supplier <input [(ngModel)]="model.supplier" /></label>
        <label>Kode KFA <input [(ngModel)]="model.itemCode" /></label>
        <label>Nama Barang <input [(ngModel)]="model.itemName" /></label>
        <label>No. Batch <input [(ngModel)]="model.batchNo" /></label>
        <label>Qty Retur <input type="number" [(ngModel)]="model.qty" /></label>
        <label>Alasan Retur <input [(ngModel)]="model.reason" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Ajukan Retur Pembelian</button>
      </div>
    </div>
  `
})
export class ReturnFormComponent {
  @Input({ required: true }) model!: { supplier: string; itemCode: string; itemName: string; batchNo: string; qty: number; reason: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
