import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-vendor-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah Vendor Jasa <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama Vendor <input [(ngModel)]="model.name" /></label>
        <label>Bidang Jasa <input [(ngModel)]="model.serviceType" /></label>
        <label>PIC <input [(ngModel)]="model.pic" /></label>
        <label>Telepon <input [(ngModel)]="model.phone" /></label>
        <label>SLA <input [(ngModel)]="model.sla" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Vendor Jasa</button>
      </div>
    </div>
  `
})
export class VendorFormComponent {
  @Input({ required: true }) model!: { name: string; serviceType: string; pic: string; phone: string; sla: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
