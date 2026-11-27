-- ============================================================================
-- SKEMA DATABASE MYSQL / MARIADB LARAGON: CLOUD ERP KLINIK MULTI-CABANG (V2)
-- Mendukung:
--   1. erpklinik_cloud (Server VPS Pusat — 12 Grup / 68 Sub-menu)
--   2. erpklinik_local (Server Lokal: Klinik Utama, Klinik Pratama, Apotek)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS erpklinik_cloud CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE erpklinik_cloud;

-- 1. Manajemen Outlet & Edge Nodes
CREATE TABLE IF NOT EXISTS outlets (
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
);

CREATE TABLE IF NOT EXISTS outlet_templates (
    outlet_type VARCHAR(50) PRIMARY KEY,
    modules_json JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outlet_settings (
    outlet_id VARCHAR(50) PRIMARY KEY,
    settings_json JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outlet_licenses (
    license_id VARCHAR(40) PRIMARY KEY,
    outlet_id VARCHAR(50) NOT NULL,
    activation_code VARCHAR(32) NOT NULL,
    tier VARCHAR(40) DEFAULT 'Enterprise',
    max_users INT DEFAULT 25,
    valid_until DATE,
    device_fingerprint VARCHAR(120),
    status ENUM('Aktif', 'Menunggu Aktivasi', 'Suspended', 'Expired') DEFAULT 'Aktif',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. HR, SDM, RBAC, Jadwal, STR/SIP, Payroll & Rekrutmen
CREATE TABLE IF NOT EXISTS employees (
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
);

CREATE TABLE IF NOT EXISTS users (
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
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_name VARCHAR(64) PRIMARY KEY,
    scope VARCHAR(120),
    level_label VARCHAR(40),
    matrix_json JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_schedules (
    schedule_id VARCHAR(36) PRIMARY KEY,
    employee_name VARCHAR(120) NOT NULL,
    role_name VARCHAR(50),
    outlet_name VARCHAR(120),
    poli_unit VARCHAR(80),
    day_of_week VARCHAR(20),
    shift_time VARCHAR(40),
    quota INT DEFAULT 30,
    status VARCHAR(30) DEFAULT 'Aktif'
);

CREATE TABLE IF NOT EXISTS medical_credentials (
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
);

CREATE TABLE IF NOT EXISTS doctor_fee_ledgers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_name VARCHAR(120) NOT NULL,
    outlet_name VARCHAR(120) NOT NULL,
    str_sip VARCHAR(64),
    total_patients INT DEFAULT 0,
    total_visites INT DEFAULT 0,
    fee_amount_rp DECIMAL(18,2) DEFAULT 0.00,
    period_month VARCHAR(20) DEFAULT '2026-11'
);

CREATE TABLE IF NOT EXISTS attendance_logs (
    attendance_id VARCHAR(36) PRIMARY KEY,
    att_date DATE NOT NULL,
    staff_name VARCHAR(120) NOT NULL,
    outlet_name VARCHAR(120),
    check_in VARCHAR(10),
    check_out VARCHAR(10),
    status VARCHAR(30) DEFAULT 'Hadir'
);

CREATE TABLE IF NOT EXISTS leave_requests (
    leave_id VARCHAR(36) PRIMARY KEY,
    staff_name VARCHAR(120) NOT NULL,
    outlet_name VARCHAR(120),
    leave_type VARCHAR(50),
    date_range VARCHAR(60),
    reason TEXT,
    status VARCHAR(40) DEFAULT 'Menunggu Approval'
);

CREATE TABLE IF NOT EXISTS doctor_fee_rules (
    rule_id VARCHAR(36) PRIMARY KEY,
    service_category VARCHAR(120) NOT NULL,
    outlet_name VARCHAR(120),
    share_percent DECIMAL(5,2) DEFAULT 50.00,
    fixed_per_visit DECIMAL(14,2) DEFAULT 0.00,
    visite_rate DECIMAL(14,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS payroll_items (
    payroll_id VARCHAR(36) PRIMARY KEY,
    period_month VARCHAR(20) NOT NULL,
    staff_name VARCHAR(120) NOT NULL,
    outlet_name VARCHAR(120),
    base_salary DECIMAL(14,2) DEFAULT 0.00,
    medical_fee DECIMAL(14,2) DEFAULT 0.00,
    allowance DECIMAL(14,2) DEFAULT 0.00,
    tax_pph21 DECIMAL(14,2) DEFAULT 0.00,
    net_pay DECIMAL(14,2) DEFAULT 0.00,
    status VARCHAR(40) DEFAULT 'Menunggu Finalisasi'
);

CREATE TABLE IF NOT EXISTS job_requisitions (
    job_id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(140) NOT NULL,
    outlet_name VARCHAR(120),
    headcount INT DEFAULT 1,
    urgency VARCHAR(30) DEFAULT 'Sedang',
    applicants_count INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Terbuka'
);

CREATE TABLE IF NOT EXISTS applicants (
    applicant_id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36),
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(40),
    outlet_name VARCHAR(120),
    stage VARCHAR(40) DEFAULT 'Screening',
    score INT DEFAULT 0,
    applied_date DATE
);

CREATE TABLE IF NOT EXISTS performance_reviews (
    review_id VARCHAR(36) PRIMARY KEY,
    period_label VARCHAR(30),
    staff_name VARCHAR(120) NOT NULL,
    outlet_name VARCHAR(120),
    kpi_score INT DEFAULT 0,
    attendance_score INT DEFAULT 0,
    patient_feedback DECIMAL(3,2) DEFAULT 5.00,
    status VARCHAR(40) DEFAULT 'Selesai'
);

-- 3. Inventory & Supply Chain (KFA, Batch FEFO, Mutasi, Opname)
CREATE TABLE IF NOT EXISTS master_kfa_items (
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
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    batch_id VARCHAR(40) PRIMARY KEY,
    kfa_code VARCHAR(32) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    location_name VARCHAR(120) NOT NULL,
    batch_no VARCHAR(64) NOT NULL,
    expired_date DATE NOT NULL,
    qty INT DEFAULT 0,
    rack_code VARCHAR(32) DEFAULT 'RAK-A1',
    status ENUM('Tersedia', 'Karantina', 'Dimusnahkan') DEFAULT 'Tersedia'
);

CREATE TABLE IF NOT EXISTS stock_requests (
    req_id VARCHAR(32) PRIMARY KEY,
    request_date DATETIME NOT NULL,
    outlet_id VARCHAR(50) NOT NULL,
    outlet_name VARCHAR(120) NOT NULL,
    item_code VARCHAR(32) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    qty INT NOT NULL,
    status VARCHAR(50) DEFAULT 'Menunggu Approval Pusat',
    approved_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS stock_mutations (
    mutation_id VARCHAR(36) PRIMARY KEY,
    mutation_date DATETIME NOT NULL,
    from_location VARCHAR(120),
    to_location VARCHAR(120),
    item_code VARCHAR(32),
    item_name VARCHAR(160),
    batch_no VARCHAR(64),
    qty INT NOT NULL,
    status VARCHAR(40) DEFAULT 'Dikirim'
);

CREATE TABLE IF NOT EXISTS stock_opnames (
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
);

CREATE TABLE IF NOT EXISTS stock_card_movements (
    movement_id VARCHAR(36) PRIMARY KEY,
    moved_at VARCHAR(25) NOT NULL,
    kfa_code VARCHAR(32) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    location_name VARCHAR(120),
    batch_no VARCHAR(64),
    ref_type VARCHAR(40),
    ref_no VARCHAR(40),
    qty_in INT DEFAULT 0,
    qty_out INT DEFAULT 0,
    balance_after INT DEFAULT 0
);

-- 4. Purchasing (Supplier, PR, PO, GRN, Retur)
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(140) NOT NULL,
    npwp VARCHAR(40),
    pbf_license VARCHAR(64),
    pic_name VARCHAR(100),
    phone VARCHAR(40),
    email VARCHAR(120),
    payment_terms VARCHAR(30) DEFAULT 'TOP 30',
    status VARCHAR(30) DEFAULT 'Aktif'
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_number VARCHAR(36) PRIMARY KEY,
    order_date VARCHAR(20),
    supplier_id VARCHAR(36),
    supplier_name VARCHAR(140),
    target_location VARCHAR(120),
    total_amount DECIMAL(18,2) DEFAULT 0,
    items_summary TEXT,
    lines_json JSON,
    status VARCHAR(40) DEFAULT 'Draft'
);

CREATE TABLE IF NOT EXISTS goods_receipts (
    grn_no VARCHAR(36) PRIMARY KEY,
    po_number VARCHAR(36),
    supplier_name VARCHAR(140),
    invoice_no VARCHAR(64),
    received_date VARCHAR(20),
    due_date VARCHAR(20),
    total_amount DECIMAL(18,2) DEFAULT 0,
    items_json JSON,
    status VARCHAR(40) DEFAULT 'Selesai'
);

CREATE TABLE IF NOT EXISTS purchase_requests (
    pr_id VARCHAR(36) PRIMARY KEY,
    request_date VARCHAR(20),
    requested_by VARCHAR(100),
    item_code VARCHAR(32),
    item_name VARCHAR(160),
    qty INT NOT NULL,
    reason TEXT,
    status VARCHAR(40) DEFAULT 'Menunggu Approval'
);

CREATE TABLE IF NOT EXISTS purchase_returns (
    return_id VARCHAR(36) PRIMARY KEY,
    return_date VARCHAR(20),
    supplier_name VARCHAR(140),
    grn_no VARCHAR(36),
    item_code VARCHAR(32),
    item_name VARCHAR(160),
    batch_no VARCHAR(64),
    qty INT NOT NULL,
    reason TEXT,
    resolution VARCHAR(60),
    status VARCHAR(40) DEFAULT 'Dikirim ke Supplier'
);

-- 5. Keuangan & Akunting (Kas/Bank, COA, Jurnal Double-Entry)
CREATE TABLE IF NOT EXISTS cash_bank_accounts (
    account_id VARCHAR(36) PRIMARY KEY,
    account_name VARCHAR(120) NOT NULL,
    account_type VARCHAR(40),
    outlet_name VARCHAR(120),
    bank_number VARCHAR(64),
    balance_rp DECIMAL(18,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cash_transactions (
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
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    account_code VARCHAR(20) PRIMARY KEY,
    account_name VARCHAR(140) NOT NULL,
    category VARCHAR(50) NOT NULL,
    parent_code VARCHAR(20),
    normal_balance ENUM('Debit', 'Kredit') NOT NULL,
    balance_amount DECIMAL(18,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS journal_entries (
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
);

CREATE TABLE IF NOT EXISTS bpjs_insurance_claims (
    claim_no VARCHAR(36) PRIMARY KEY,
    outlet_name VARCHAR(120) NOT NULL,
    program VARCHAR(120),
    total_cases INT DEFAULT 0,
    amount_millions DECIMAL(12,3) DEFAULT 0.000,
    paid_millions DECIMAL(12,3) DEFAULT 0.000,
    aging_days INT DEFAULT 0,
    due_date VARCHAR(20),
    status VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS supplier_payables (
    ap_id VARCHAR(36) PRIMARY KEY,
    invoice_no VARCHAR(64) NOT NULL,
    supplier_name VARCHAR(140) NOT NULL,
    grn_no VARCHAR(36),
    due_date VARCHAR(20),
    total_rp DECIMAL(18,2) DEFAULT 0.00,
    paid_rp DECIMAL(18,2) DEFAULT 0.00,
    aging_bucket VARCHAR(30),
    status VARCHAR(40) DEFAULT 'Belum Lunas'
);

CREATE TABLE IF NOT EXISTS budgets (
    budget_id VARCHAR(36) PRIMARY KEY,
    period_month VARCHAR(20),
    outlet_name VARCHAR(120),
    account_code VARCHAR(120),
    budget_rp DECIMAL(18,2) DEFAULT 0.00,
    actual_rp DECIMAL(18,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS deposit_reconciliations (
    recon_id VARCHAR(36) PRIMARY KEY,
    recon_date VARCHAR(20),
    outlet_name VARCHAR(120),
    shift_label VARCHAR(60),
    local_cash_rp DECIMAL(18,2) DEFAULT 0.00,
    local_digital_rp DECIMAL(18,2) DEFAULT 0.00,
    bank_mutation_rp DECIMAL(18,2) DEFAULT 0.00,
    variance_rp DECIMAL(18,2) DEFAULT 0.00,
    status VARCHAR(40) DEFAULT 'Belum Cocok'
);

CREATE TABLE IF NOT EXISTS fixed_assets (
    asset_code VARCHAR(36) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    outlet_name VARCHAR(120),
    purchase_date DATE,
    cost_rp DECIMAL(18,2) DEFAULT 0.00,
    useful_life_months INT DEFAULT 60,
    accumulated_dep_rp DECIMAL(18,2) DEFAULT 0.00,
    book_value_rp DECIMAL(18,2) DEFAULT 0.00,
    monthly_dep_rp DECIMAL(18,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS depreciation_runs (
    run_id VARCHAR(36) PRIMARY KEY,
    period_month VARCHAR(20) NOT NULL,
    total_amount_rp DECIMAL(18,2) DEFAULT 0.00,
    journal_code VARCHAR(36),
    status VARCHAR(30) DEFAULT 'Diposting'
);

CREATE TABLE IF NOT EXISTS tax_records (
    tax_id VARCHAR(36) PRIMARY KEY,
    period_month VARCHAR(20),
    tax_type VARCHAR(120),
    base_amount_rp DECIMAL(18,2) DEFAULT 0.00,
    tax_amount_rp DECIMAL(18,2) DEFAULT 0.00,
    status VARCHAR(40) DEFAULT 'Siap Lapor'
);

-- 6. GA, Marketing, Integrasi, Notifikasi & Audit
CREATE TABLE IF NOT EXISTS ga_assets (
    asset_code VARCHAR(36) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(60),
    outlet_name VARCHAR(120),
    serial_no VARCHAR(80),
    purchase_date DATE,
    acquisition_cost DECIMAL(18,2) DEFAULT 0,
    calibration_date DATE,
    condition_label VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS consolidated_patients (
    rm_number VARCHAR(32) PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    nik VARCHAR(20) NOT NULL,
    home_outlet VARCHAR(120),
    last_visit VARCHAR(80),
    jaminan VARCHAR(60),
    ihs_number VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS sync_logs (
    sync_id VARCHAR(36) PRIMARY KEY,
    sync_time VARCHAR(20) NOT NULL,
    direction VARCHAR(30) NOT NULL,
    outlet_name VARCHAR(120) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    summary TEXT NOT NULL,
    status VARCHAR(40) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    notif_id VARCHAR(36) PRIMARY KEY,
    severity ENUM('critical', 'warn', 'info') DEFAULT 'info',
    title VARCHAR(160) NOT NULL,
    message TEXT,
    target_route VARCHAR(120),
    is_read TINYINT(1) DEFAULT 0,
    created_at VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS audit_trails (
    audit_id VARCHAR(36) PRIMARY KEY,
    actor_email VARCHAR(120),
    actor_role VARCHAR(60),
    module_name VARCHAR(60),
    action_type VARCHAR(40),
    summary TEXT,
    diff_json JSON,
    created_at VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS asset_maintenances (
    maint_id VARCHAR(36) PRIMARY KEY,
    asset_code VARCHAR(36),
    asset_name VARCHAR(160),
    outlet_name VARCHAR(120),
    maint_type VARCHAR(60),
    scheduled_date DATE,
    vendor_name VARCHAR(140),
    cost_rp DECIMAL(14,2) DEFAULT 0.00,
    certificate_no VARCHAR(80),
    status VARCHAR(40) DEFAULT 'Terjadwal'
);

CREATE TABLE IF NOT EXISTS outlet_permits (
    permit_id VARCHAR(36) PRIMARY KEY,
    outlet_name VARCHAR(120),
    permit_name VARCHAR(160),
    permit_no VARCHAR(80),
    issuer VARCHAR(120),
    expiry_date DATE,
    status VARCHAR(40) DEFAULT 'Aktif'
);

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id VARCHAR(36) PRIMARY KEY,
    plate_no VARCHAR(30),
    model VARCHAR(120),
    outlet_name VARCHAR(120),
    stnk_expiry VARCHAR(20),
    kir_expiry VARCHAR(20),
    odometer_km INT DEFAULT 0,
    last_service VARCHAR(20),
    status VARCHAR(40) DEFAULT 'Siap Operasional'
);

CREATE TABLE IF NOT EXISTS service_vendors (
    vendor_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(140),
    service_type VARCHAR(120),
    pic_name VARCHAR(100),
    phone VARCHAR(40),
    contract_end VARCHAR(20),
    sla VARCHAR(80),
    status VARCHAR(30) DEFAULT 'Aktif'
);

CREATE TABLE IF NOT EXISTS promos_packages (
    promo_id VARCHAR(36) PRIMARY KEY,
    promo_code VARCHAR(40) NOT NULL,
    name VARCHAR(140) NOT NULL,
    promo_type VARCHAR(40),
    discount_type VARCHAR(20),
    discount_value DECIMAL(14,2) DEFAULT 0.00,
    outlets_json JSON,
    valid_until DATE,
    quota_used INT DEFAULT 0,
    quota_max INT DEFAULT 100,
    status VARCHAR(30) DEFAULT 'Aktif'
);

CREATE TABLE IF NOT EXISTS loyalty_accounts (
    loyalty_id VARCHAR(36) PRIMARY KEY,
    rm_number VARCHAR(32) NOT NULL,
    patient_name VARCHAR(120),
    tier VARCHAR(20) DEFAULT 'Silver',
    points INT DEFAULT 0,
    total_spend_rp DECIMAL(18,2) DEFAULT 0.00,
    last_activity VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS broadcast_campaigns (
    campaign_id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(160),
    channel VARCHAR(30),
    segment VARCHAR(80),
    target_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    read_rate VARCHAR(20),
    scheduled_at VARCHAR(25),
    template_text TEXT,
    status VARCHAR(30) DEFAULT 'Terkirim'
);

CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    survey_id VARCHAR(36) PRIMARY KEY,
    survey_date VARCHAR(20),
    outlet_name VARCHAR(120),
    poli_doctor VARCHAR(120),
    patient_name VARCHAR(120),
    rating INT DEFAULT 5,
    nps INT DEFAULT 10,
    comment_text TEXT,
    follow_up_status VARCHAR(40) DEFAULT 'Belum Ditindaklanjuti'
);

CREATE TABLE IF NOT EXISTS fhir_transmission_logs (
    fhir_log_id VARCHAR(36) PRIMARY KEY,
    sent_at VARCHAR(25),
    outlet_name VARCHAR(120),
    resource_type VARCHAR(50),
    patient_label VARCHAR(160),
    http_status INT DEFAULT 200,
    status VARCHAR(30),
    payload_json JSON,
    response_message TEXT
);

CREATE TABLE IF NOT EXISTS code_mappings (
    mapping_id VARCHAR(36) PRIMARY KEY,
    standard_name VARCHAR(30),
    local_code VARCHAR(64),
    local_name VARCHAR(160),
    standard_code VARCHAR(64),
    standard_display VARCHAR(200),
    status VARCHAR(30) DEFAULT 'Belum Terpetakan'
);

CREATE TABLE IF NOT EXISTS bpjs_bridging_logs (
    bpjs_log_id VARCHAR(36) PRIMARY KEY,
    logged_at VARCHAR(25),
    outlet_name VARCHAR(120),
    service_name VARCHAR(60),
    ref_no VARCHAR(80),
    response_code VARCHAR(16),
    message TEXT,
    status VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS system_tariffs (
    tariff_id VARCHAR(36) PRIMARY KEY,
    tariff_code VARCHAR(40),
    name VARCHAR(160),
    category VARCHAR(50),
    base_price_rp DECIMAL(14,2) DEFAULT 0.00,
    bpjs_tariff_rp DECIMAL(14,2) DEFAULT 0.00,
    applicable_to VARCHAR(80),
    status VARCHAR(30) DEFAULT 'Aktif'
);

CREATE TABLE IF NOT EXISTS backup_snapshots (
    backup_id VARCHAR(36) PRIMARY KEY,
    created_at VARCHAR(25),
    backup_type VARCHAR(50),
    size_kb INT DEFAULT 0,
    db_engine VARCHAR(60),
    status VARCHAR(30) DEFAULT 'Sukses'
);

CREATE TABLE IF NOT EXISTS edge_server_nodes (
    outlet_id VARCHAR(50) PRIMARY KEY,
    outlet_name VARCHAR(120),
    app_version VARCHAR(30),
    db_engine VARCHAR(60),
    master_version_ack INT DEFAULT 1,
    cpu_load VARCHAR(20),
    memory_usage VARCHAR(20),
    disk_free_gb INT DEFAULT 0,
    last_heartbeat VARCHAR(40),
    status VARCHAR(40)
);

-- ============================================================================
-- DATABASE SERVER LOKAL CABANG (OFFLINE-FIRST): erpklinik_local
-- ============================================================================
CREATE DATABASE IF NOT EXISTS erpklinik_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE erpklinik_local;

CREATE TABLE IF NOT EXISTS patients (
    rm_number VARCHAR(32) PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    nik VARCHAR(20) NOT NULL,
    bpjs_card_no VARCHAR(30),
    ihs_patient_id VARCHAR(64),
    birth_date DATE,
    gender ENUM('L', 'P') DEFAULT 'L',
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS encounters (
    encounter_id VARCHAR(36) PRIMARY KEY,
    queue_no VARCHAR(16) NOT NULL,
    rm_number VARCHAR(32) NOT NULL,
    patient_name VARCHAR(120) NOT NULL,
    poli_name VARCHAR(80) NOT NULL,
    doctor_name VARCHAR(120) NOT NULL,
    payer_type VARCHAR(60) NOT NULL,
    sep_or_pcare_no VARCHAR(64),
    status VARCHAR(50) DEFAULT 'Menunggu Poli',
    visit_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS soap_notes (
    soap_id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id VARCHAR(36),
    patient_label VARCHAR(150) NOT NULL,
    subjective TEXT,
    objective TEXT,
    icd10_code VARCHAR(80),
    plan_notes TEXT,
    prescription_summary TEXT,
    fhir_status VARCHAR(50) DEFAULT 'Antre Lokal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inpatient_beds (
    bed_id VARCHAR(32) PRIMARY KEY,
    room_name VARCHAR(100) NOT NULL,
    bed_code VARCHAR(20) NOT NULL,
    patient_label VARCHAR(150) DEFAULT '-',
    diagnosis VARCHAR(140) DEFAULT '-',
    dpjp_doctor VARCHAR(120) DEFAULT '-',
    daily_rate_millions DECIMAL(10,3) DEFAULT 0.500,
    bed_status ENUM('Tersedia', 'Terisi', 'Cleaning') DEFAULT 'Tersedia'
);

CREATE TABLE IF NOT EXISTS cppt_records (
    cppt_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_label VARCHAR(150) NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    profession VARCHAR(40) NOT NULL,
    soap_instruction TEXT NOT NULL,
    verified_by VARCHAR(120) NOT NULL,
    recorded_at VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS lab_radiology_orders (
    order_id VARCHAR(32) PRIMARY KEY,
    patient_label VARCHAR(150) NOT NULL,
    modality ENUM('Laboratorium', 'Radiologi', 'Fisioterapi') NOT NULL,
    exam_name VARCHAR(140) NOT NULL,
    result_value TEXT,
    normal_reference VARCHAR(120),
    status ENUM('Menunggu Sampel', 'Selesai & Terverifikasi') DEFAULT 'Menunggu Sampel',
    ordered_at VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS prescriptions (
    rx_no VARCHAR(32) PRIMARY KEY,
    patient_label VARCHAR(150) NOT NULL,
    doctor_name VARCHAR(120) NOT NULL,
    items_summary TEXT NOT NULL,
    kfa_code VARCHAR(32),
    qty INT DEFAULT 10,
    signa_text VARCHAR(140),
    status ENUM('Menunggu Telaah', 'Diserahkan') DEFAULT 'Menunggu Telaah',
    created_at VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
    invoice_no VARCHAR(32) PRIMARY KEY,
    patient_label VARCHAR(150) NOT NULL,
    service_summary TEXT NOT NULL,
    payer_type VARCHAR(60) NOT NULL,
    amount_millions DECIMAL(12,3) NOT NULL,
    display_amount VARCHAR(40) NOT NULL,
    status ENUM('Belum Bayar', 'Lunas') DEFAULT 'Belum Bayar',
    paid_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS narcotics_registers (
    reg_id VARCHAR(32) PRIMARY KEY,
    tx_date VARCHAR(20) NOT NULL,
    drug_name VARCHAR(140) NOT NULL,
    patient_name VARCHAR(120) NOT NULL,
    patient_address VARCHAR(200) NOT NULL,
    doctor_name VARCHAR(120) NOT NULL,
    qty_out INT NOT NULL,
    remaining_stock INT NOT NULL,
    pharmacist_name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_opnames (
    opname_id VARCHAR(32) PRIMARY KEY,
    opname_date VARCHAR(20) NOT NULL,
    kfa_code VARCHAR(32) NOT NULL,
    drug_name VARCHAR(140) NOT NULL,
    system_stock INT NOT NULL,
    physical_stock INT NOT NULL,
    difference INT NOT NULL,
    reason VARCHAR(160) NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_outbox (
    outbox_id VARCHAR(36) PRIMARY KEY,
    entity_type VARCHAR(60) NOT NULL,
    summary TEXT NOT NULL,
    amount_millions DECIMAL(12,3) DEFAULT 0.000,
    created_at VARCHAR(20) NOT NULL,
    sync_status ENUM('Menunggu (Offline)', 'Tersinkron') DEFAULT 'Menunggu (Offline)'
);
