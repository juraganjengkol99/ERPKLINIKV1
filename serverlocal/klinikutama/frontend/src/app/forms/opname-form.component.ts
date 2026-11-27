import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface OpnameFormModel {
  code: string;
  physicalQty: number;
  reason: string;
}

@Component({
  selector: 'app-opname-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Input Stok Opname Lokal <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Barang KFA <select [(ngModel)]="model.code">@for (i of items; track i.code) { <option [value]="i.code">{{ i.code }} — {{ i.name }}</option> }</select></label>
        <label>Qty Fisik Terhitung <input type="number" [(ngModel)]="model.physicalQty" /></label>
        <label>Keterangan <input [(ngModel)]="model.reason" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Opname</button>
      </div>
    </div>
  `
})
export class OpnameFormComponent {
  @Input({ required: true }) model!: OpnameFormModel;
  @Input() items: Array<{ code: string; name: string }> = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
