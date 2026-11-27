import { Component, Input } from '@angular/core';

export interface BarChartDatum {
  label: string;
  value: number;
  displayValue: string;
  tone?: 'acc' | 'ok' | 'warn';
}

@Component({
  selector: 'app-svg-bar-chart',
  standalone: true,
  template: `
    <div style="display:grid;gap:10px;padding:14px 16px">
      @for (d of data; track d.label) {
        <div style="display:grid;grid-template-columns:140px 1fr 110px;align-items:center;gap:12px;font-size:13px">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">{{ d.label }}</span>
          <div class="progress-track" style="height:12px">
            <div
              class="progress-fill"
              [class.ok]="d.tone === 'ok'"
              [class.warn]="d.tone === 'warn'"
              [style.width.%]="percent(d.value)">
            </div>
          </div>
          <span class="num" style="font-weight:600">{{ d.displayValue }}</span>
        </div>
      }
      @if (data.length === 0) {
        <div class="empty" style="padding:18px">Belum ada data grafik.</div>
      }
    </div>
  `
})
export class SvgBarChartComponent {
  @Input() data: BarChartDatum[] = [];

  percent(val: number): number {
    const max = Math.max(1, ...this.data.map((d) => Number(d.value || 0)));
    return Math.min(100, Math.round((Number(val || 0) / max) * 100));
  }
}
