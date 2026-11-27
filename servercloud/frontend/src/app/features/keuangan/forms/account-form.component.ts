import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-account-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah Rekening Kas / Bank <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama Rekening <input [(ngModel)]="model.name" /></label>
        <label>Tipe <select [(ngModel)]="model.type"><option value="Bank">Bank</option><option value="Kas Tunai">Kas Tunai</option><option value="EDC / QRIS">EDC / QRIS</option></select></label>
        <label>Outlet <input [(ngModel)]="model.outlet" /></label>
        <label>No. Rekening <input [(ngModel)]="model.accountNo" /></label>
        <label>Saldo Awal (Rp) <input type="number" [(ngModel)]="model.balanceRp" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Rekening</button>
      </div>
    </div>
  `
})
export class AccountFormComponent {
  @Input({ required: true }) model!: { name: string; type: string; outlet: string; accountNo: string; balanceRp: number };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
