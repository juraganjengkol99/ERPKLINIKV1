import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah Kendaraan Operasional <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Plat Nomor <input [(ngModel)]="model.plateNo" /></label>
        <label>Model Kendaraan <input [(ngModel)]="model.model" /></label>
        <label>Outlet <input [(ngModel)]="model.outlet" /></label>
        <label>Expired STNK <input type="date" [(ngModel)]="model.stnkExpiry" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Kendaraan</button>
      </div>
    </div>
  `
})
export class VehicleFormComponent {
  @Input({ required: true }) model!: { plateNo: string; model: string; outlet: string; stnkExpiry: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
