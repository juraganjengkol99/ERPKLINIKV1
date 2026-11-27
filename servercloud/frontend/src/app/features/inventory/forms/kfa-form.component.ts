import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-kfa-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>{{ editing ? 'Edit Master KFA' : 'Tambah Barang KFA Baru' }} <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Kode KFA <input [(ngModel)]="model.code" [disabled]="editing" placeholder="KFA-93010" /></label>
        <label>Nama Obat / Alkes <input [(ngModel)]="model.name" /></label>
        <label>Kategori <input [(ngModel)]="model.category" /></label>
        <label>Satuan <input [(ngModel)]="model.unit" /></label>
        <label>Stok Awal Gudang Pusat <input type="number" [(ngModel)]="model.centralStock" [disabled]="editing" /></label>
        <label>Batas Stok Minimum <input type="number" [(ngModel)]="model.minStock" /></label>
        <label>HNA (Rp) <input type="number" [(ngModel)]="model.hnaPrice" /></label>
        <label>HET (Rp) <input type="number" [(ngModel)]="model.hetPrice" /></label>
        <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" [(ngModel)]="model.isNarcotic" style="width:auto" /> Termasuk Obat Narkotika / Psikotropika (SIPNAP)</label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan &amp; Broadcast Master KFA</button>
      </div>
    </div>
  `
})
export class KfaFormComponent {
  @Input({ required: true }) model!: { code: string; name: string; category: string; unit: string; centralStock: number; minStock: number; hnaPrice: number; hetPrice: number; isNarcotic: boolean };
  @Input() editing = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
