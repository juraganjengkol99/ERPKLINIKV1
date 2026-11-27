import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard/ringkasan-seluruh-outlet', pathMatch: 'full' },
  {
    path: 'dashboard/:sub',
    loadComponent: () => import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent)
  },
  {
    path: 'manajemen-outlet/:sub',
    loadComponent: () => import('./features/outlets/outlets-page.component').then((m) => m.OutletsPageComponent)
  },
  {
    path: 'hr/:sub',
    loadComponent: () => import('./features/hr/hr-page.component').then((m) => m.HrPageComponent)
  },
  {
    path: 'keuangan/:sub',
    loadComponent: () => import('./features/keuangan/keuangan-page.component').then((m) => m.KeuanganPageComponent)
  },
  {
    path: 'akunting/:sub',
    loadComponent: () => import('./features/akunting/akunting-page.component').then((m) => m.AkuntingPageComponent)
  },
  {
    path: 'purchasing/:sub',
    loadComponent: () => import('./features/purchasing/purchasing-page.component').then((m) => m.PurchasingPageComponent)
  },
  {
    path: 'inventory/:sub',
    loadComponent: () => import('./features/inventory/inventory-page.component').then((m) => m.InventoryPageComponent)
  },
  {
    path: 'ga/:sub',
    loadComponent: () => import('./features/ga/ga-page.component').then((m) => m.GaPageComponent)
  },
  {
    path: 'marketing/:sub',
    loadComponent: () => import('./features/marketing/marketing-page.component').then((m) => m.MarketingPageComponent)
  },
  {
    path: 'integrasi/:sub',
    loadComponent: () => import('./features/integrasi/integrasi-page.component').then((m) => m.IntegrasiPageComponent)
  },
  {
    path: 'laporan-konsolidasi/:sub',
    loadComponent: () => import('./features/laporan/laporan-page.component').then((m) => m.LaporanPageComponent)
  },
  {
    path: 'pengaturan-sistem/:sub',
    loadComponent: () => import('./features/sistem/sistem-page.component').then((m) => m.SistemPageComponent)
  },
  { path: '**', redirectTo: 'dashboard/ringkasan-seluruh-outlet' }
];
