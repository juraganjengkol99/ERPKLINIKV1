import mysql from 'mysql2/promise';

export const dbPool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erpklinik_cloud',
  waitForConnections: true,
  connectionLimit: 10
});

let mysqlAvailable = null;

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS outlets (
    outlet_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    outlet_type VARCHAR(80) NOT NULL,
    activation_code VARCHAR(30) NOT NULL UNIQUE,
    nib VARCHAR(50),
    phone VARCHAR(40),
    admin_email VARCHAR(120),
    address TEXT,
    satusehat_env VARCHAR(30) DEFAULT 'Sandbox',
    satusehat_org_id VARCHAR(64),
    satusehat_loc_id VARCHAR(64),
    satusehat_client_id VARCHAR(120),
    bpjs_service_type VARCHAR(80),
    bpjs_env VARCHAR(30) DEFAULT 'Development',
    bpjs_ppk_code VARCHAR(32),
    bpjs_cons_id VARCHAR(64),
    status ENUM('Aktif', 'Arsip') DEFAULT 'Aktif',
    archive_reason TEXT,
    archived_at DATETIME NULL,
    is_online TINYINT(1) DEFAULT 1,
    last_sync_at DATETIME,
    today_visits INT DEFAULT 0,
    today_revenue_millions DECIMAL(12,3) DEFAULT 0.000,
    pending_sync_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS outlet_templates (
    outlet_type VARCHAR(50) PRIMARY KEY,
    modules_json JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS outlet_settings (
    outlet_id VARCHAR(50) PRIMARY KEY,
    settings_json JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS outlet_licenses (
    license_id VARCHAR(40) PRIMARY KEY,
    outlet_id VARCHAR(50) NOT NULL,
    activation_code VARCHAR(32) NOT NULL,
    tier VARCHAR(40) DEFAULT 'Enterprise',
    max_users INT DEFAULT 25,
    valid_until DATE,
    device_fingerprint VARCHAR(120),
    status ENUM('Aktif', 'Menunggu Aktivasi', 'Suspended', 'Expired') DEFAULT 'Aktif',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS employees (
    employee_id VARCHAR(36) PRIMARY KEY,
    nip VARCHAR(32) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    nik VARCHAR(20),
    department VARCHAR(80),
    position_title VARCHAR(80),
    employment_status ENUM('Tetap', 'Kontrak', 'Mitra') DEFAULT 'Tetap',
    outlet_name VARCHAR(120),
    join_date DATE,
    phone VARCHAR(40),
    bank_account VARCHAR(80),
    base_salary DECIMAL(14,2) DEFAULT 0,
    status ENUM('Aktif', 'Cuti', 'Nonaktif') DEFAULT 'Aktif'
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(36) PRIMARY KEY,
    employee_id VARCHAR(36),
    full_name VARCHAR(120) NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    outlet_name VARCHAR(120) NOT NULL,
    allowed_outlets_json JSON,
    email VARCHAR(120),
    password_hash VARCHAR(200),
    nik VARCHAR(20),
    str_sip_number VARCHAR(64),
    str_expiry_date DATE,
    ihs_practitioner_id VARCHAR(64),
    two_fa_enabled TINYINT(1) DEFAULT 0,
    status ENUM('Aktif', 'Nonaktif') DEFAULT 'Aktif',
    sync_status VARCHAR(40) DEFAULT 'Tersinkron',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_name VARCHAR(64) PRIMARY KEY,
    scope VARCHAR(120),
    level_label VARCHAR(40),
    matrix_json JSON NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS staff_schedules (
    schedule_id VARCHAR(36) PRIMARY KEY,
    employee_name VARCHAR(120) NOT NULL,
    role_name VARCHAR(50),
    outlet_name VARCHAR(120),
    poli_unit VARCHAR(80),
    day_of_week VARCHAR(20),
    shift_time VARCHAR(40),
    quota INT DEFAULT 30,
    status VARCHAR(30) DEFAULT 'Aktif'
  )`,
  `CREATE TABLE IF NOT EXISTS medical_credentials (
    cred_id VARCHAR(36) PRIMARY KEY,
    staff_name VARCHAR(120) NOT NULL,
    profession VARCHAR(50),
    outlet_name VARCHAR(120),
    str_number VARCHAR(64),
    sip_number VARCHAR(64),
    expiry_date DATE,
    ihs_id VARCHAR(64),
    skp_points INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Aktif'
  )`,
  `CREATE TABLE IF NOT EXISTS master_kfa_items (
    kfa_code VARCHAR(32) PRIMARY KEY,
    item_name VARCHAR(160) NOT NULL,
    category VARCHAR(64) NOT NULL,
    dosage_form VARCHAR(64) DEFAULT 'Tablet',
    central_stock INT DEFAULT 0,
    min_stock INT DEFAULT 200,
    unit VARCHAR(32) DEFAULT 'Tablet',
    price_display VARCHAR(40),
    hna_price DECIMAL(14,2) DEFAULT 0.00,
    het_price DECIMAL(14,2) DEFAULT 0.00,
    expired_date DATE,
    is_narcotic TINYINT(1) DEFAULT 0,
    status ENUM('Aktif', 'Nonaktif') DEFAULT 'Aktif',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_batches (
    batch_id VARCHAR(40) PRIMARY KEY,
    kfa_code VARCHAR(32) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    location_name VARCHAR(120) NOT NULL,
    batch_no VARCHAR(64) NOT NULL,
    expired_date DATE NOT NULL,
    qty INT DEFAULT 0,
    rack_code VARCHAR(32) DEFAULT 'RAK-A1',
    status ENUM('Tersedia', 'Karantina', 'Dimusnahkan') DEFAULT 'Tersedia'
  )`,
  `CREATE TABLE IF NOT EXISTS stock_requests (
    req_id VARCHAR(32) PRIMARY KEY,
    request_date DATETIME NOT NULL,
    outlet_id VARCHAR(50) NOT NULL,
    outlet_name VARCHAR(120) NOT NULL,
    item_code VARCHAR(32) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    qty INT NOT NULL,
    status VARCHAR(50) DEFAULT 'Menunggu Approval Pusat',
    approved_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stock_mutations (
    mutation_id VARCHAR(36) PRIMARY KEY,
    mutation_date DATETIME NOT NULL,
    from_location VARCHAR(120),
    to_location VARCHAR(120),
    item_code VARCHAR(32),
    item_name VARCHAR(160),
    batch_no VARCHAR(64),
    qty INT NOT NULL,
    status VARCHAR(40) DEFAULT 'Dikirim'
  )`,
  `CREATE TABLE IF NOT EXISTS stock_opnames (
    opname_id VARCHAR(36) PRIMARY KEY,
    opname_date VARCHAR(20) NOT NULL,
    location_name VARCHAR(120),
    kfa_code VARCHAR(32) NOT NULL,
    drug_name VARCHAR(140) NOT NULL,
    system_stock INT NOT NULL,
    physical_stock INT NOT NULL,
    difference INT NOT NULL,
    reason VARCHAR(160),
    status VARCHAR(40) DEFAULT 'Menunggu Approval'
  )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(140) NOT NULL,
    npwp VARCHAR(40),
    pbf_license VARCHAR(64),
    pic_name VARCHAR(100),
    phone VARCHAR(40),
    email VARCHAR(120),
    payment_terms VARCHAR(30) DEFAULT 'TOP 30',
    status VARCHAR(30) DEFAULT 'Aktif'
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_orders (
    po_number VARCHAR(36) PRIMARY KEY,
    order_date VARCHAR(20),
    supplier_id VARCHAR(36),
    supplier_name VARCHAR(140),
    target_location VARCHAR(120),
    total_amount DECIMAL(18,2) DEFAULT 0,
    items_summary TEXT,
    lines_json JSON,
    status VARCHAR(40) DEFAULT 'Draft'
  )`,
  `CREATE TABLE IF NOT EXISTS goods_receipts (
    grn_no VARCHAR(36) PRIMARY KEY,
    po_number VARCHAR(36),
    supplier_name VARCHAR(140),
    invoice_no VARCHAR(64),
    received_date VARCHAR(20),
    due_date VARCHAR(20),
    total_amount DECIMAL(18,2) DEFAULT 0,
    items_json JSON,
    status VARCHAR(40) DEFAULT 'Selesai'
  )`,
  `CREATE TABLE IF NOT EXISTS cash_bank_accounts (
    account_id VARCHAR(36) PRIMARY KEY,
    account_name VARCHAR(120) NOT NULL,
    account_type VARCHAR(40),
    outlet_name VARCHAR(120),
    bank_number VARCHAR(64),
    balance_rp DECIMAL(18,2) DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS cash_transactions (
    tx_id VARCHAR(36) PRIMARY KEY,
    tx_date VARCHAR(25),
    tx_type ENUM('Penerimaan', 'Pengeluaran', 'Transfer') NOT NULL,
    account_id VARCHAR(36),
    outlet_name VARCHAR(120),
    category VARCHAR(80),
    payment_method VARCHAR(40),
    description TEXT,
    amount_rp DECIMAL(18,2) DEFAULT 0,
    status VARCHAR(40) DEFAULT 'Selesai'
  )`,
  `CREATE TABLE IF NOT EXISTS chart_of_accounts (
    account_code VARCHAR(20) PRIMARY KEY,
    account_name VARCHAR(140) NOT NULL,
    category VARCHAR(50) NOT NULL,
    parent_code VARCHAR(20),
    normal_balance ENUM('Debit', 'Kredit') NOT NULL,
    balance_amount DECIMAL(18,2) DEFAULT 0.00
  )`,
  `CREATE TABLE IF NOT EXISTS journal_entries (
    journal_code VARCHAR(32) PRIMARY KEY,
    entry_date DATETIME NOT NULL,
    outlet_name VARCHAR(120) NOT NULL,
    source_module VARCHAR(40) DEFAULT 'Auto-Sync',
    account_debit VARCHAR(120) NOT NULL,
    account_credit VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    amount_rp DECIMAL(18,2) NOT NULL,
    lines_json JSON,
    sync_status VARCHAR(50) DEFAULT 'Tersinkron Otomatis'
  )`,
  `CREATE TABLE IF NOT EXISTS doctor_fee_ledgers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_name VARCHAR(120) NOT NULL,
    outlet_name VARCHAR(120) NOT NULL,
    str_sip VARCHAR(64),
    total_patients INT DEFAULT 0,
    total_visites INT DEFAULT 0,
    fee_amount_rp DECIMAL(18,2) DEFAULT 0.00,
    period_month VARCHAR(20) DEFAULT '2026-11'
  )`,
  `CREATE TABLE IF NOT EXISTS ga_assets (
    asset_code VARCHAR(36) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(60),
    outlet_name VARCHAR(120),
    serial_no VARCHAR(80),
    purchase_date DATE,
    acquisition_cost DECIMAL(18,2) DEFAULT 0,
    calibration_date DATE,
    condition_label VARCHAR(80)
  )`,
  `CREATE TABLE IF NOT EXISTS consolidated_patients (
    rm_number VARCHAR(32) PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    nik VARCHAR(20) NOT NULL,
    home_outlet VARCHAR(120),
    last_visit VARCHAR(80),
    jaminan VARCHAR(60),
    ihs_number VARCHAR(64)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_logs (
    sync_id VARCHAR(36) PRIMARY KEY,
    sync_time VARCHAR(20) NOT NULL,
    direction VARCHAR(30) NOT NULL,
    outlet_name VARCHAR(120) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    summary TEXT NOT NULL,
    status VARCHAR(40) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    notif_id VARCHAR(36) PRIMARY KEY,
    severity ENUM('critical', 'warn', 'info') DEFAULT 'info',
    title VARCHAR(160) NOT NULL,
    message TEXT,
    target_route VARCHAR(120),
    is_read TINYINT(1) DEFAULT 0,
    created_at VARCHAR(30)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_trails (
    audit_id VARCHAR(36) PRIMARY KEY,
    actor_email VARCHAR(120),
    actor_role VARCHAR(60),
    module_name VARCHAR(60),
    action_type VARCHAR(40),
    summary TEXT,
    diff_json JSON,
    created_at VARCHAR(30)
  )`
];

export async function initMySqlSchema() {
  try {
    for (const ddl of DDL_STATEMENTS) {
      await dbPool.query(ddl);
    }
    mysqlAvailable = true;
    return true;
  } catch (err) {
    mysqlAvailable = false;
    console.warn('[MySQL] Mode fallback JSON aktif (MySQL belum tersedia):', err.message);
    return false;
  }
}

export function isMySqlConnected() {
  return Boolean(mysqlAvailable);
}

export async function syncStateToMySql(state) {
  if (mysqlAvailable === false) return;
  try {
    for (const o of state.outlets || []) {
      await dbPool.query(
        `INSERT INTO outlets (outlet_id, name, outlet_type, activation_code, nib, phone, admin_email, address, satusehat_env, satusehat_org_id, satusehat_loc_id, satusehat_client_id, bpjs_service_type, bpjs_env, bpjs_ppk_code, bpjs_cons_id, status, is_online, today_visits, today_revenue_millions, pending_sync_count, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE name=VALUES(name), outlet_type=VALUES(outlet_type), status=VALUES(status), is_online=VALUES(is_online), today_visits=VALUES(today_visits), today_revenue_millions=VALUES(today_revenue_millions), pending_sync_count=VALUES(pending_sync_count), last_sync_at=NOW()`,
        [
          o.outletId,
          o.name,
          o.type,
          o.activationCode,
          o.nib || '',
          o.phone || '',
          o.adminEmail || '',
          o.address || '',
          o.satuSehatEnv || 'Sandbox',
          o.satuSehatOrgId || '',
          o.satuSehatLocId || '',
          o.satuSehatClientId || '',
          o.bpjsServiceType || '',
          o.bpjsEnv || 'Development',
          o.bpjsPpkCode || '',
          o.bpjsConsId || '',
          o.status || 'Aktif',
          o.isOnline ? 1 : 0,
          o.todayVisits || 0,
          o.todayRevenueMillions || 0,
          o.pendingSyncCount || 0
        ]
      );
    }

    for (const u of state.users || []) {
      await dbPool.query(
        `INSERT INTO users (user_id, employee_id, full_name, role_name, outlet_name, allowed_outlets_json, email, password_hash, nik, str_sip_number, ihs_practitioner_id, two_fa_enabled, status, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), role_name=VALUES(role_name), outlet_name=VALUES(outlet_name), allowed_outlets_json=VALUES(allowed_outlets_json), status=VALUES(status), sync_status=VALUES(sync_status)`,
        [
          u.id,
          u.employeeId || null,
          u.name,
          u.role,
          u.outlet,
          JSON.stringify(u.allowedOutlets || [u.outlet]),
          u.email || '',
          u.passwordHash || '',
          u.nik || '',
          u.strSip || '-',
          u.ihsId || '-',
          u.twoFaEnabled ? 1 : 0,
          u.status || 'Aktif',
          u.syncStatus || 'Tersinkron'
        ]
      );
    }

    for (const item of state.inventoryItems || []) {
      await dbPool.query(
        `INSERT INTO master_kfa_items (kfa_code, item_name, category, dosage_form, central_stock, min_stock, unit, price_display, hna_price, het_price, expired_date, is_narcotic, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE item_name=VALUES(item_name), central_stock=VALUES(central_stock), min_stock=VALUES(min_stock), status=VALUES(status)`,
        [
          item.code,
          item.name,
          item.category || 'Umum',
          item.dosageForm || 'Tablet',
          item.centralStock || 0,
          item.minStock || 200,
          item.unit || 'Tablet',
          item.price || 'Rp 0',
          item.hnaPrice || 0,
          item.hetPrice || 0,
          item.expiredDate || '2028-12-31',
          item.isNarcotic ? 1 : 0,
          item.status || 'Aktif'
        ]
      );
    }

    for (const sr of state.stockRequests || []) {
      await dbPool.query(
        `INSERT INTO stock_requests (req_id, request_date, outlet_id, outlet_name, item_code, item_name, qty, status)
         VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [sr.reqId, sr.outletId, sr.outletName, sr.itemCode, sr.itemName, sr.qty || 0, sr.status || 'Menunggu Approval Pusat']
      );
    }

    for (const acc of state.chartOfAccounts || []) {
      await dbPool.query(
        `INSERT INTO chart_of_accounts (account_code, account_name, category, parent_code, normal_balance, balance_amount)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE account_name=VALUES(account_name), balance_amount=VALUES(balance_amount)`,
        [acc.code, acc.name, acc.category, acc.parentCode || '', acc.normalBalance || 'Debit', acc.balanceAmount || 0]
      );
    }

    for (const j of (state.journalEntries || []).slice(0, 60)) {
      await dbPool.query(
        `INSERT INTO journal_entries (journal_code, entry_date, outlet_name, source_module, account_debit, account_credit, description, amount_rp, lines_json, sync_status)
         VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE sync_status=VALUES(sync_status)`,
        [
          j.code,
          j.outlet || 'Pusat',
          j.source || 'Auto-Sync',
          j.accountDebit || '',
          j.accountCredit || '',
          j.description || '',
          j.amountRp || 0,
          JSON.stringify(j.lines || []),
          j.status || 'Tersinkron Otomatis'
        ]
      );
    }

    for (const log of (state.syncLogs || []).slice(0, 60)) {
      await dbPool.query(
        `INSERT INTO sync_logs (sync_id, sync_time, direction, outlet_name, entity_type, summary, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [log.id, log.timestamp || '', log.direction || '', log.outlet || '', log.entityType || '', log.summary || '', log.status || '']
      );
    }

    for (const n of (state.notifications || []).slice(0, 40)) {
      await dbPool.query(
        `INSERT INTO notifications (notif_id, severity, title, message, target_route, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE is_read=VALUES(is_read)`,
        [n.id, n.severity || 'info', n.title || '', n.message || '', n.targetRoute || '', n.isRead ? 1 : 0, n.createdAt || '']
      );
    }

    for (const a of (state.auditTrails || []).slice(0, 60)) {
      await dbPool.query(
        `INSERT INTO audit_trails (audit_id, actor_email, actor_role, module_name, action_type, summary, diff_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE summary=VALUES(summary)`,
        [a.id, a.actorEmail || '', a.actorRole || '', a.module || '', a.action || '', a.summary || '', JSON.stringify(a.diff || null), a.timestamp || '']
      );
    }
    mysqlAvailable = true;
  } catch {
    mysqlAvailable = false;
  }
}
