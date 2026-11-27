import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-receipt-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Catat Penerimaan Kas Masuk <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Rekening Tujuan <select [(ngModel)]="model.accountId">@for (a of accounts; track a.id) { <option [value]="a.id">{{ a.name }}</option> }</select></label>
        <label>Kategori <input [(ngModel)]="model.category" /></label>
        <label>Keterangan <input [(ngModel)]="model.description" /></label>
        <label>Nominal (Rp) <input type="number" [(ngModel)]="model.amountRp" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan &amp; Posting Jurnal</button>
      </div>
    </div>
  `
})
export class ReceiptFormComponent {
  @Input({ required: true }) model!: { accountId: string; category: string; description: string; amountRp: number };
  @Input() accounts: Array<{ id: string; name: string }> = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
