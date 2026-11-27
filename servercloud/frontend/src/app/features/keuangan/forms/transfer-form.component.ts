import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IdrPipe } from '../../../shared/pipes/idr.pipe';

@Component({
  selector: 'app-transfer-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IdrPipe],
  template: `
    <div class="panel inline-form-panel">
      <h2>Transfer Dana Antar Kas / Bank <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Dari Rekening <select [(ngModel)]="model.fromAccountId">@for (a of accounts; track a.id) { <option [value]="a.id">{{ a.name }} ({{ a.balanceRp | idr }})</option> }</select></label>
        <label>Ke Rekening <select [(ngModel)]="model.toAccountId">@for (a of accounts; track a.id) { <option [value]="a.id">{{ a.name }}</option> }</select></label>
        <label>Nominal Transfer (Rp) <input type="number" [(ngModel)]="model.amountRp" /></label>
        <label>Keterangan <input [(ngModel)]="model.description" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Eksekusi Transfer</button>
      </div>
    </div>
  `
})
export class TransferFormComponent {
  @Input({ required: true }) model!: { fromAccountId: string; toAccountId: string; amountRp: number; description: string };
  @Input() accounts: Array<{ id: string; name: string; balanceRp: number }> = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
