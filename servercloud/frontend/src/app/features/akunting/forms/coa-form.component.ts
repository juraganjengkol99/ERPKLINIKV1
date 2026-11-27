import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-coa-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah Akun Chart of Accounts <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Kode Akun <input [(ngModel)]="model.code" placeholder="6105" /></label>
        <label>Nama Akun <input [(ngModel)]="model.name" placeholder="Beban Pemeliharaan Alat Medis" /></label>
        <label>Kategori <select [(ngModel)]="model.category"><option value="Aset Lancar">Aset Lancar</option><option value="Kewajiban">Kewajiban</option><option value="Pendapatan">Pendapatan</option><option value="Beban Operasional">Beban Operasional</option></select></label>
        <label>Saldo Normal <select [(ngModel)]="model.normalBalance"><option value="Debit">Debit</option><option value="Kredit">Kredit</option></select></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Akun COA</button>
      </div>
    </div>
  `
})
export class CoaFormComponent {
  @Input({ required: true }) model!: { code: string; name: string; category: string; normalBalance: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
