import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IdrPipe } from '../../../shared/pipes/idr.pipe';

@Component({
  selector: 'app-journal-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IdrPipe],
  template: `
    <div class="panel inline-form-panel">
      <h2>Buat Jurnal Manual Double-Entry <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Cabang <input [(ngModel)]="model.outlet" /></label>
        <label>Keterangan Jurnal <input [(ngModel)]="model.description" /></label>
        <label>Akun Debit <select [(ngModel)]="model.debitCode">@for (a of coa; track a.code) { <option [value]="a.code">{{ a.code }} — {{ a.name }}</option> }</select></label>
        <label>Akun Kredit <select [(ngModel)]="model.creditCode">@for (a of coa; track a.code) { <option [value]="a.code">{{ a.code }} — {{ a.name }}</option> }</select></label>
        <label>Nominal Debit (Rp) <input type="number" [(ngModel)]="model.debitAmt" /></label>
        <label>Nominal Kredit (Rp) <input type="number" [(ngModel)]="model.creditAmt" /></label>
      </div>
      <div style="padding:0 18px 10px">
        <div class="banner" [ngClass]="model.debitAmt === model.creditAmt && model.debitAmt > 0 ? 'info' : 'bad'">
          <span>Live Balance Meter — Selisih: <b>{{ (model.debitAmt - model.creditAmt) | idr }}</b></span>
        </div>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" [disabled]="model.debitAmt !== model.creditAmt || model.debitAmt <= 0" (click)="submitted.emit()">Posting Jurnal</button>
      </div>
    </div>
  `
})
export class JournalFormComponent {
  @Input({ required: true }) model!: { outlet: string; description: string; debitCode: string; creditCode: string; debitAmt: number; creditAmt: number };
  @Input() coa: Array<{ code: string; name: string }> = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
