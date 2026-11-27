import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-job-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Buka Lowongan SDM <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Judul Posisi <input [(ngModel)]="model.title" placeholder="Perawat Pelaksana" /></label>
        <label>Outlet <input [(ngModel)]="model.outlet" /></label>
        <label>Kebutuhan (Orang) <input type="number" [(ngModel)]="model.headcount" /></label>
        <label>Urgensi <select [(ngModel)]="model.urgency"><option value="Tinggi">Tinggi</option><option value="Sedang">Sedang</option><option value="Rendah">Rendah</option></select></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Publikasikan Lowongan</button>
      </div>
    </div>
  `
})
export class JobFormComponent {
  @Input({ required: true }) model!: { title: string; outlet: string; headcount: number; urgency: string };
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
