export interface MenuSubItem {
  label: string;
  slug: string;
}

export interface MenuGroup {
  name: string;
  code: string;
  routeBase: string;
  items: MenuSubItem[];
}

export const CLOUD_MENU: MenuGroup[] = [
  {
    name: 'Dashboard',
    code: 'DB',
    routeBase: 'dashboard',
    items: [
      { label: 'Ringkasan Seluruh Outlet', slug: 'ringkasan-seluruh-outlet' },
      { label: 'Kinerja per Outlet', slug: 'kinerja-per-outlet' },
      { label: 'Status Sinkronisasi', slug: 'status-sinkronisasi' },
      { label: 'Status Integrasi', slug: 'status-integrasi' },
      { label: 'Notifikasi', slug: 'notifikasi' }
    ]
  },
  {
    name: 'Manajemen Outlet',
    code: 'MO',
    routeBase: 'manajemen-outlet',
    items: [
      { label: 'Daftar Outlet', slug: 'daftar-outlet' },
      { label: 'Tambah Outlet Baru', slug: 'tambah-outlet-baru' },
      { label: 'Template Modul per Tipe', slug: 'template-modul-per-tipe' },
      { label: 'Pengaturan Cabang', slug: 'pengaturan-cabang' },
      { label: 'Lisensi & Aktivasi', slug: 'lisensi-aktivasi' },
      { label: 'Arsip Outlet', slug: 'arsip-outlet' }
    ]
  },
  {
    name: 'HR',
    code: 'HR',
    routeBase: 'hr',
    items: [
      { label: 'Data Karyawan', slug: 'data-karyawan' },
      { label: 'Manajemen User', slug: 'manajemen-user' },
      { label: 'Role & Permission', slug: 'role-permission' },
      { label: 'Absensi & Jadwal', slug: 'absensi-jadwal' },
      { label: 'STR/SIP & Kompetensi', slug: 'str-sip-kompetensi' },
      { label: 'Penggajian & Jasa Medis', slug: 'penggajian-jasa-medis' },
      { label: 'Rekrutmen & Kinerja', slug: 'rekrutmen-kinerja' }
    ]
  },
  {
    name: 'Keuangan',
    code: 'KE',
    routeBase: 'keuangan',
    items: [
      { label: 'Kas & Bank', slug: 'kas-bank' },
      { label: 'Penerimaan', slug: 'penerimaan' },
      { label: 'Pengeluaran', slug: 'pengeluaran' },
      { label: 'Piutang BPJS & Asuransi', slug: 'piutang-bpjs-asuransi' },
      { label: 'Hutang Supplier', slug: 'hutang-supplier' },
      { label: 'Anggaran', slug: 'anggaran' },
      { label: 'Rekonsiliasi Setoran', slug: 'rekonsiliasi-setoran' }
    ]
  },
  {
    name: 'Akunting',
    code: 'AK',
    routeBase: 'akunting',
    items: [
      { label: 'Chart of Accounts', slug: 'chart-of-accounts' },
      { label: 'Jurnal', slug: 'jurnal' },
      { label: 'Buku Besar', slug: 'buku-besar' },
      { label: 'Laporan Keuangan', slug: 'laporan-keuangan' },
      { label: 'Konsolidasi Outlet', slug: 'konsolidasi-outlet' },
      { label: 'Aset Tetap', slug: 'aset-tetap' },
      { label: 'Pajak', slug: 'pajak' }
    ]
  },
  {
    name: 'Purchasing',
    code: 'PU',
    routeBase: 'purchasing',
    items: [
      { label: 'Permintaan Pembelian', slug: 'permintaan-pembelian' },
      { label: 'Purchase Order', slug: 'purchase-order' },
      { label: 'Penerimaan Barang', slug: 'penerimaan-barang' },
      { label: 'Retur Pembelian', slug: 'retur-pembelian' },
      { label: 'Master Supplier', slug: 'master-supplier' }
    ]
  },
  {
    name: 'Inventory',
    code: 'IN',
    routeBase: 'inventory',
    items: [
      { label: 'Master Barang (KFA)', slug: 'master-barang-kfa' },
      { label: 'Stok Konsolidasi', slug: 'stok-konsolidasi' },
      { label: 'Mutasi Antar Outlet', slug: 'mutasi-antar-outlet' },
      { label: 'Stok Opname', slug: 'stok-opname' },
      { label: 'Batch & Expired', slug: 'batch-expired' },
      { label: 'Gudang Pusat', slug: 'gudang-pusat' }
    ]
  },
  {
    name: 'GA',
    code: 'GA',
    routeBase: 'ga',
    items: [
      { label: 'Aset & Inventaris', slug: 'aset-inventaris' },
      { label: 'Pemeliharaan & Kalibrasi', slug: 'pemeliharaan-kalibrasi' },
      { label: 'Perizinan Outlet', slug: 'perizinan-outlet' },
      { label: 'Kendaraan', slug: 'kendaraan' },
      { label: 'Vendor Jasa', slug: 'vendor-jasa' }
    ]
  },
  {
    name: 'Marketing',
    code: 'MK',
    routeBase: 'marketing',
    items: [
      { label: 'Data Pasien Konsolidasi', slug: 'data-pasien-konsolidasi' },
      { label: 'Promo & Paket', slug: 'promo-paket' },
      { label: 'Loyalitas', slug: 'loyalitas' },
      { label: 'Broadcast WhatsApp/SMS', slug: 'broadcast-whatsapp-sms' },
      { label: 'Survei Kepuasan', slug: 'survei-kepuasan' }
    ]
  },
  {
    name: 'Integrasi',
    code: 'IT',
    routeBase: 'integrasi',
    items: [
      { label: 'SATUSEHAT: Konfigurasi', slug: 'satusehat-konfigurasi' },
      { label: 'SATUSEHAT: Monitoring FHIR', slug: 'satusehat-monitoring-fhir' },
      { label: 'SATUSEHAT: Mapping Kode', slug: 'satusehat-mapping-kode' },
      { label: 'BPJS: Konfigurasi', slug: 'bpjs-konfigurasi' },
      { label: 'BPJS: Monitoring Klaim', slug: 'bpjs-monitoring-klaim' },
      { label: 'Sinkronisasi Data', slug: 'sinkronisasi-data' }
    ]
  },
  {
    name: 'Laporan Konsolidasi',
    code: 'LP',
    routeBase: 'laporan-konsolidasi',
    items: [
      { label: 'Kunjungan & Pendapatan', slug: 'kunjungan-pendapatan' },
      { label: 'Klaim BPJS', slug: 'klaim-bpjs' },
      { label: 'Stok, SDM, Keuangan', slug: 'stok-sdm-keuangan' },
      { label: 'Laporan Regulasi', slug: 'laporan-regulasi' }
    ]
  },
  {
    name: 'Pengaturan Sistem',
    code: 'PS',
    routeBase: 'pengaturan-sistem',
    items: [
      { label: 'Master Umum & Tarif', slug: 'master-umum-tarif' },
      { label: 'Keamanan (2FA)', slug: 'keamanan-2fa' },
      { label: 'Audit Trail', slug: 'audit-trail' },
      { label: 'Backup & Restore', slug: 'backup-restore' },
      { label: 'Manajemen Server Lokal', slug: 'manajemen-server-lokal' }
    ]
  }
];

export interface StatItem {
  label: string;
  value: string;
}

export interface OutletStatusItem {
  outletId: string;
  name: string;
  type: string;
  serviceScope?: 'RI_RJ' | 'RJ_ONLY' | 'APOTEK';
  status?: 'Aktif' | 'Arsip';
  isOnline?: boolean;
  connectionLabel: string;
  connectionStatus: 'ok' | 'warn' | 'bad' | 'info';
  lastSync: string;
  satuSehatLabel: string;
  satuSehatStatus: 'ok' | 'warn' | 'bad' | 'info';
  bpjsLabel: string;
  bpjsStatus: 'ok' | 'warn' | 'bad' | 'info';
  todayVisits?: number;
  todayRevenueMillions?: number;
  pendingSyncCount?: number;
  activationCode?: string;
  address?: string;
  nib?: string;
  phone?: string;
  adminEmail?: string;
  satuSehatEnv?: string;
  satuSehatOrgId?: string;
  satuSehatLocId?: string;
  satuSehatClientId?: string;
  hasSatuSehatSecret?: boolean;
  satuSehatClientSecretMasked?: string;
  bpjsServiceType?: string;
  bpjsEnv?: string;
  bpjsPpkCode?: string;
  bpjsConsId?: string;
  hasBpjsSecret?: boolean;
  bpjsSecretKeyMasked?: string;
  hasBpjsUserKey?: boolean;
  bpjsUserKeyMasked?: string;
  archivedAt?: string;
  archiveReason?: string;
}

export interface UserOutlet {
  id: string;
  name: string;
  role: string;
  outlet: string;
  allowedOutlets?: string[];
  status: string;
  syncStatus: string;
  email?: string;
  nik?: string;
  strSip?: string;
  strExpiry?: string;
  ihsId?: string;
  twoFaEnabled?: boolean;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  direction: string;
  outlet: string;
  entityType: string;
  summary: string;
  status: string;
}

export interface NotificationItem {
  id: string;
  severity: 'critical' | 'warn' | 'info';
  title: string;
  message: string;
  targetRoute: string;
  isRead: boolean;
  createdAt: string;
}

export interface JournalEntryRecord {
  code: string;
  date: string;
  outlet: string;
  source?: string;
  accountDebit?: string;
  accountCredit?: string;
  description: string;
  amountRp?: number;
  amount: string;
  status: string;
  lines?: Array<{ accountCode: string; accountName: string; debit: number; credit: number }>;
}
