import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-asset-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah Aset &amp; Inventaris Baru <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama Aset <input [(ngModel)]="model.name" /></label>
        <label>Kategori <select [(ngModel)]="model.category"><option value="Alat Medis">Alat Medis</option><option value="Alat Lab">Alat Lab</option><option value="Cold Chain">Cold Chain</option><option value="IT & Server">IT &amp; Server</option></select></label>
        <label>Outlet <input [(ngModel)]="model.outlet" /></label>
        <label>Harga Perolehan (Rp) <input type="number" [(ngModel)]="model.costRp" /></label>
        <label>Jadwal Kalibrasi Berikutnya <input type="date" [(ngModel)]="model.calibrationDate" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Aset &amp; Sync Akunting</button>
      </div>
    </div>
  `
})
export class AssetFormComponent {
  @Input({ required: true }) model!: { name: string; category: string; outlet: string; costRp: number; calibrationDate: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
