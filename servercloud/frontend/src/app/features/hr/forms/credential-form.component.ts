import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-credential-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel inline-form-panel">
      <h2>{{ editing ? 'Perbarui STR/SIP' : 'Tambah Data STR/SIP' }} <span class="sp"></span><button class="ib btn-sm" type="button" (click)="cancelled.emit()">Tutup</button></h2>
      <div class="form">
        <label>Nama Nakes <input [(ngModel)]="model.staffName" [disabled]="editing" /></label>
        <label>Profesi <input [(ngModel)]="model.profession" /></label>
        <label>Outlet <input [(ngModel)]="model.outlet" /></label>
        <label>No. STR <input [(ngModel)]="model.strNo" /></label>
        <label>No. SIP <input [(ngModel)]="model.sipNo" /></label>
        <label>Berlaku Sampai <input type="date" [(ngModel)]="model.expiryDate" /></label>
        <label>IHS Practitioner ID <input [(ngModel)]="model.ihsId" /></label>
        <label>Status <select [(ngModel)]="model.status"><option value="Aktif">Aktif</option><option value="Segera Perpanjang">Segera Perpanjang</option><option value="Expired">Expired</option></select></label>
      </div>
      <div class="inline-form-actions">
        <button class="ib" type="button" (click)="cancelled.emit()">Batal</button>
        <button class="btn" type="button" (click)="submitted.emit()">Simpan Kredensial</button>
      </div>
    </div>
  `
})
export class CredentialFormComponent {
  @Input({ required: true }) model!: { staffName: string; profession: string; outlet: string; strNo: string; sipNo: string; expiryDate: string; ihsId: string; status: string };
  @Input() editing = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
