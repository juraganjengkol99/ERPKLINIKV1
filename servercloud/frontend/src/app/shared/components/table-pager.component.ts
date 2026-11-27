import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-table-pager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="row" style="flex-wrap:wrap;gap:10px;background:var(--bg)">
      <span class="hint-text">
        Menampilkan <b>{{ startIdx }}–{{ endIdx }}</b> dari <b>{{ total }}</b> data (Hal. {{ safePage }} / {{ totalPages }})
      </span>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <select
          class="select"
          style="padding:4px 8px;font-size:12px"
          [ngModel]="pageSize"
          (ngModelChange)="onSizeChange($event)"
          aria-label="Jumlah baris per halaman">
          <option [ngValue]="5">5 / hal</option>
          <option [ngValue]="10">10 / hal</option>
          <option [ngValue]="25">25 / hal</option>
          <option [ngValue]="50">50 / hal</option>
        </select>
        <button class="ib btn-sm" type="button" [disabled]="safePage <= 1" (click)="go(1)">«</button>
        <button class="ib btn-sm" type="button" [disabled]="safePage <= 1" (click)="go(safePage - 1)">Sebelumnya</button>
        <button class="ib btn-sm" type="button" [disabled]="safePage >= totalPages" (click)="go(safePage + 1)">Berikutnya</button>
        <button class="ib btn-sm" type="button" [disabled]="safePage >= totalPages" (click)="go(totalPages)">»</button>
      </div>
    </div>
  `
})
export class TablePagerComponent {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / Math.max(1, this.pageSize)));
  }

  get safePage(): number {
    return Math.min(Math.max(1, this.page), this.totalPages);
  }

  get startIdx(): number {
    if (this.total === 0) return 0;
    return (this.safePage - 1) * this.pageSize + 1;
  }

  get endIdx(): number {
    return Math.min(this.total, this.safePage * this.pageSize);
  }

  go(p: number): void {
    const next = Math.min(Math.max(1, p), this.totalPages);
    this.pageChange.emit(next);
  }

  onSizeChange(sz: number): void {
    this.pageSizeChange.emit(Number(sz));
    this.pageChange.emit(1);
  }
}
