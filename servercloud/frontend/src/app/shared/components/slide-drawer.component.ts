import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-slide-drawer',
  standalone: true,
  template: `
    @if (open) {
      <div class="drawer-backdrop" (click)="close()" role="dialog" aria-modal="true" [attr.aria-label]="title">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-head">
            <div>
              <h3>{{ title }}</h3>
              @if (subtitle) {
                <small>{{ subtitle }}</small>
              }
            </div>
            <button class="ib" type="button" (click)="close()" aria-label="Tutup panel">Tutup</button>
          </div>
          <div class="drawer-body">
            <ng-content />
          </div>
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
  onEsc(): void {
    if (this.open) this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
