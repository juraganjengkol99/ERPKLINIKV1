import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface BranchUserModel {
  name: string;
  role: string;
  outlet: string;
  email: string;
  nik: string;
  strSip: string;
}

@Component({
  selector: 'app-branch-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah User Cabang <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama * <input [(ngModel)]="model.name" /></label>
        <label>Role <select [(ngModel)]="model.role"><option value="Dokter">Dokter</option><option value="Perawat">Perawat</option><option value="Apoteker">Apoteker</option><option value="Kasir">Kasir</option><option value="Pendaftaran">Pendaftaran</option></select></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan User</button>
      </div>
    </div>
  `
})
export class BranchUserFormComponent {
  @Input({ required: true }) model!: BranchUserModel;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
