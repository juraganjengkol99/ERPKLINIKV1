import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-budget-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tetapkan Anggaran Cabang <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Periode <input [(ngModel)]="model.period" /></label>
        <label>Outlet <input [(ngModel)]="model.outlet" /></label>
        <label>Pos Akun <input [(ngModel)]="model.accountCode" /></label>
        <label>Target Anggaran (Rp) <input type="number" [(ngModel)]="model.budgetRp" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Anggaran</button>
      </div>
    </div>
  `
})
export class BudgetFormComponent {
  @Input({ required: true }) model!: { period: string; outlet: string; accountCode: string; budgetRp: number };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
