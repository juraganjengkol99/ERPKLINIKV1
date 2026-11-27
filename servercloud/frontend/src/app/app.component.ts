import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { CLOUD_MENU, MenuGroup, UserOutlet } from './core/models/erp.models';
import { CloudStateService } from './core/services/cloud-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly state = inject(CloudStateService);
  private routeSub?: Subscription;

  brand = 'Klinik Group';
  where = 'Server pusat (VPS)';

  loginEmail = 'owner@klinik.id';
  loginPassword = '123456';
  loginOtp = '';
  requires2fa = false;
  loginError = '';

  menuSearch = '';
  sidebarOpen = false;
  openGroups = new Set<string>(['Dashboard']);
  readonly activeGroupName = signal<string>('Dashboard');
  readonly activePageName = signal<string>('Ringkasan Seluruh Outlet');

  get filteredMenuGroups(): MenuGroup[] {
    const base = this.state.visibleMenuGroups();
    const q = this.menuSearch.trim().toLowerCase();
    if (!q) return base;
    return base
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.label.toLowerCase().includes(q) || g.name.toLowerCase().includes(q))
      }))
      .filter((g) => g.items.length > 0);
  }

  ngOnInit(): void {
    this.syncCrumbFromUrl(this.router.url);
    this.routeSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.syncCrumbFromUrl(e.urlAfterRedirects);
        this.sidebarOpen = false;
      });

    if (this.state.isAuthenticated()) {
      this.state.refreshDashboard();
      this.state.startPolling();
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.state.stopPolling();
  }

  private syncCrumbFromUrl(url: string): void {
    const parts = url.split('?')[0].split('/').filter(Boolean);
    const groupSlug = parts[0] || 'dashboard';
    const subSlug = parts[1] || '';
    const group = CLOUD_MENU.find((g) => g.routeBase === groupSlug);
    if (group) {
      this.activeGroupName.set(group.name);
      this.openGroups.add(group.name);
      const sub = group.items.find((i) => i.slug === subSlug) || group.items[0];
      if (sub) this.activePageName.set(sub.label);
    }
  }

  fillDemoLogin(email: string): void {
    this.loginEmail = email;
    this.loginPassword = '123456';
    this.loginOtp = '';
    this.requires2fa = false;
    this.loginError = '';
  }

  submitLogin(): void {
    this.loginError = '';
    this.http
      .post<{ success: boolean; requires2fa?: boolean; message?: string; token?: string; user?: UserOutlet }>(
        `${this.state.apiBase}/auth/login`,
        {
          email: this.loginEmail,
          password: this.loginPassword,
          otp: this.loginOtp
        }
      )
      .subscribe({
        next: (res) => {
          if (res?.requires2fa && !res.success) {
            this.requires2fa = true;
            this.loginError = res.message || 'Masukkan kode OTP 2FA';
            return;
          }
          if (res?.success && res.token && res.user) {
            this.requires2fa = false;
            this.loginOtp = '';
            this.state.setSession(res.token, res.user);
            const first = this.state.visibleMenuGroups()[0];
            if (first && first.items[0]) {
              this.router.navigate(['/', first.routeBase, first.items[0].slug]);
            }
            this.state.showToast(`Selamat datang, ${res.user.name}`);
          }
        },
        error: (err) => {
          this.loginError = err?.error?.message || 'Email atau password salah. Demo: owner@klinik.id / 123456';
        }
      });
  }

  isGroupOpen(groupName: string): boolean {
    return this.menuSearch.trim().length > 0 || this.openGroups.has(groupName);
  }

  toggleGroup(groupName: string, event: Event): void {
    event.preventDefault();
    if (this.openGroups.has(groupName)) {
      this.openGroups.delete(groupName);
    } else {
      this.openGroups.add(groupName);
    }
  }

  toggleTheme(): void {
    const root = document.documentElement;
    const isDark = getComputedStyle(root).colorScheme === 'dark';
    root.dataset['theme'] = isDark ? 'light' : 'dark';
  }

  printReport(): void {
    window.print();
  }
}
