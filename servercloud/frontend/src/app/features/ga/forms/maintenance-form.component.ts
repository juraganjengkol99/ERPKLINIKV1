import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-maintenance-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>Jadwalkan Pemeliharaan / Kalibrasi <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Kode Aset <select [(ngModel)]="model.assetCode">@for (a of assets; track a.code) { <option [value]="a.code">{{ a.code }} — {{ a.name }}</option> }</select></label>
        <label>Jenis <select [(ngModel)]="model.type"><option value="Kalibrasi BPFK">Kalibrasi BPFK</option><option value="Preventive Maintenance">Preventive Maintenance</option><option value="Perbaikan">Perbaikan</option></select></label>
        <label>Tanggal Jadwal <input type="date" [(ngModel)]="model.scheduledDate" /></label>
        <label>Estimasi Biaya (Rp) <input type="number" [(ngModel)]="model.costRp" /></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Jadwal</button>
      </div>
    </div>
  `
})
export class MaintenanceFormComponent {
  @Input({ required: true }) model!: { assetCode: string; type: string; scheduledDate: string; costRp: number };
  @Input() assets: Array<{ code: string; name: string }> = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
