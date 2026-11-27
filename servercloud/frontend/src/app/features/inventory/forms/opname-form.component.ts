import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OutletStatusItem } from '../../../core/models/erp.models';

@Component({
  selector: 'app-opname-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Input Stok Opname Fisik <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Lokasi <select [(ngModel)]="model.location"><option value="Gudang Pusat">Gudang Pusat</option>@for (o of outlets; track o.outletId) { <option [value]="o.name">{{ o.name }}</option> }</select></label>
        <label>Barang KFA <select [(ngModel)]="model.code">@for (i of kfaItems; track i.code) { <option [value]="i.code">{{ i.code }} — {{ i.name }}</option> }</select></label>
        <label>Jumlah Fisik Terhitung <input type="number" [(ngModel)]="model.physicalQty" /></label>
        <label>Alasan / Keterangan Selisih <input [(ngModel)]="model.reason" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Hasil Opname</button>
      </div>
    </div>
  `
})
export class OpnameFormComponent {
  @Input({ required: true }) model!: { location: string; code: string; physicalQty: number; reason: string };
  @Input() outlets: OutletStatusItem[] = [];
  @Input() kfaItems: Array<{ code: string; name: string }> = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
