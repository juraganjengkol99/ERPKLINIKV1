import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah Supplier / PBF <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama PT / PBF <input [(ngModel)]="model.name" /></label>
        <label>No. Izin PBF <input [(ngModel)]="model.pbfLicense" /></label>
        <label>NPWP <input [(ngModel)]="model.npwp" /></label>
        <label>PIC <input [(ngModel)]="model.pic" /></label>
        <label>Telepon <input [(ngModel)]="model.phone" /></label>
        <label>Termin Pembayaran <select [(ngModel)]="model.paymentTerms"><option value="TOP 14">TOP 14</option><option value="TOP 30">TOP 30</option><option value="TOP 45">TOP 45</option><option value="COD">COD</option></select></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Supplier</button>
      </div>
    </div>
  `
})
export class SupplierFormComponent {
  @Input({ required: true }) model!: { name: string; pbfLicense: string; npwp: string; pic: string; phone: string; paymentTerms: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
