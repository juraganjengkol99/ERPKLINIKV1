import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-permit-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah Dokumen Perizinan Outlet <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Outlet <input [(ngModel)]="model.outlet" /></label>
        <label>Nama Izin <input [(ngModel)]="model.permitName" /></label>
        <label>No. Izin <input [(ngModel)]="model.permitNo" /></label>
        <label>Penerbit <input [(ngModel)]="model.issuer" /></label>
        <label>Berlaku Sampai <input type="date" [(ngModel)]="model.expiryDate" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Izin</button>
      </div>
    </div>
  `
})
export class PermitFormComponent {
  @Input({ required: true }) model!: { outlet: string; permitName: string; permitNo: string; issuer: string; expiryDate: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
