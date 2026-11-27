import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OutletStatusItem } from '../../../core/models/erp.models';
import { IdrPipe } from '../../../shared/pipes/idr.pipe';

@Component({
  selector: 'app-po-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IdrPipe],
  template: `
    <div class="panel inline-form-panel">
      <h2>Buat Purchase Order (PO) <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>
          Supplier / PBF
          <select [(ngModel)]="model.supplierId">
            @for (s of suppliers; track s.id) {
              <option [value]="s.id">{{ s.name }} ({{ s.paymentTerms }})</option>
            }
          </select>
        </label>
        <label>
          Tujuan Pengiriman
          <select [(ngModel)]="model.target">
            <option value="Gudang Pusat">Gudang Pusat</option>
            @for (o of outlets; track o.outletId) {
              <option [value]="o.name">{{ o.name }}</option>
            }
          </select>
        </label>
        <label>Kode KFA Item <input [(ngModel)]="model.itemCode" placeholder="KFA-93001" /></label>
        <label>Nama Obat / Alkes <input [(ngModel)]="model.itemName" /></label>
        <label>Qty Order <input type="number" [(ngModel)]="model.qty" /></label>
        <label>Harga Satuan HNA (Rp) <input type="number" [(ngModel)]="model.priceRp" /></label>
      </div>
      <div class="row" style="padding:4px 18px 8px"><span>Estimasi Total (+PPN 11%)</span><b>{{ (model.qty * model.priceRp * 1.11) | idr }}</b></div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Purchase Order</button>
      </div>
    </div>
  `
})
export class PoFormComponent {
  @Input({ required: true }) model!: { supplierId: string; target: string; itemCode: string; itemName: string; qty: number; priceRp: number };
  @Input() suppliers: Array<{ id: string; name: string; paymentTerms: string }> = [];
  @Input() outlets: OutletStatusItem[] = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
