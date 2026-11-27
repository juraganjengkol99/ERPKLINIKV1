import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-slide-drawer',
  standalone: true,
  template: `
    @if (open) {
      <div class="drawer-backdrop" (click)="closed.emit()" role="dialog" aria-modal="true">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-head">
            <div><h3>{{ title }}</h3>@if (subtitle) { <small>{{ subtitle }}</small> }</div>
            <button class="ib" type="button" (click)="closed.emit()">Tutup</button>
          </div>
          <div class="drawer-body"><ng-content /></div>
        </div>
      </div>
    }
  `
})
export class SlideDrawerComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEsc(): void { if (this.open) this.closed.emit(); }
}
