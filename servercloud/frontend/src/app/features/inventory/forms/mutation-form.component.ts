import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OutletStatusItem } from '../../../core/models/erp.models';

@Component({
  selector: 'app-mutation-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Buat Mutasi Stok Antar Outlet <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Dari Lokasi <select [(ngModel)]="model.fromLocation"><option value="Gudang Pusat">Gudang Pusat</option>@for (o of outlets; track o.outletId) { <option [value]="o.name">{{ o.name }}</option> }</select></label>
        <label>Ke Lokasi <select [(ngModel)]="model.toLocation">@for (o of outlets; track o.outletId) { <option [value]="o.name">{{ o.name }}</option> }</select></label>
        <label>Barang KFA <select [(ngModel)]="model.itemCode">@for (i of kfaItems; track i.code) { <option [value]="i.code">{{ i.code }} — {{ i.name }}</option> }</select></label>
        <label>Jumlah (Qty) <input type="number" [(ngModel)]="model.qty" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Kirim Mutasi Stok (FEFO)</button>
      </div>
    </div>
  `
})
export class MutationFormComponent {
  @Input({ required: true }) model!: { fromLocation: string; toLocation: string; itemCode: string; qty: number };
  @Input() outlets: OutletStatusItem[] = [];
  @Input() kfaItems: Array<{ code: string; name: string }> = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
