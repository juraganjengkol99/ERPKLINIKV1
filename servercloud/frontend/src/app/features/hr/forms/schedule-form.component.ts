import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-schedule-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Tambah Jadwal Praktik / Shift <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama SDM <input [(ngModel)]="model.staffName" /></label>
        <label>Outlet <input [(ngModel)]="model.outlet" /></label>
        <label>Poli / Unit <input [(ngModel)]="model.poli" /></label>
        <label>Hari <input [(ngModel)]="model.day" /></label>
        <label>Jam Shift <input [(ngModel)]="model.shift" /></label>
        <label>Kuota Pasien <input type="number" [(ngModel)]="model.quota" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Jadwal</button>
      </div>
    </div>
  `
})
export class ScheduleFormComponent {
  @Input({ required: true }) model!: { staffName: string; outlet: string; poli: string; day: string; shift: string; quota: number };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
