import fs from 'node:fs';
import path from 'node:path';
import { createDefaultState } from './seed.mjs';
import { hashPassword, encryptSecret, isMaskedValue } from '../core/security.mjs';
import { initMySqlSchema, syncStateToMySql } from '../db/mysql.mjs';

export class StoreRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.backupDir = path.join(dataDir, 'backups');
    this.stateFile = path.join(dataDir, 'cloud_state.json');
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.state = this.loadAndMigrate();
  }

  loadAndMigrate() {
    const defaults = createDefaultState();
    let current = null;

    if (fs.existsSync(this.stateFile)) {
      try {
        current = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      } catch {
        current = null;
      }
    }

    if (!current || !Array.isArray(current.outlets)) {
      this.state = defaults;
      this.save(false);
      return defaults;
    }

    // Merge any missing top-level collections without overwriting existing runtime data
    for (const [key, val] of Object.entries(defaults)) {
      if (current[key] === undefined) {
        current[key] = structuredClone(val);
      }
    }

    // Ensure all 5 outletTemplates (Rawat Inap & Jalan + Rawat Jalan variants) are present
    const hasAll5Templates = defaults.outletTemplates.every((dt) =>
      (current.outletTemplates || []).some((ct) => ct.outletType === dt.outletType)
    );
    if (!hasAll5Templates) {
      current.outletTemplates = structuredClone(defaults.outletTemplates);
    }

    // Ensure outlets have status, licenses, settings & clean secret values
    for (const outlet of current.outlets) {
      if (!outlet.status) outlet.status = 'Aktif';
      for (const secretField of ['satuSehatClientSecret', 'bpjsSecretKey', 'bpjsUserKey']) {
        if (isMaskedValue(outlet[secretField])) {
          const defOutlet = defaults.outlets.find((d) => d.outletId === outlet.outletId);
          outlet[secretField] = defOutlet ? defOutlet[secretField] : '';
        } else if (outlet[secretField] && !String(outlet[secretField]).startsWith('enc:')) {
          outlet[secretField] = encryptSecret(outlet[secretField]);
        }
      }
      if (!current.licenses.some((l) => l.outletId === outlet.outletId)) {
        current.licenses.push({
          licenseId: `LIC-${outlet.outletId.slice(0, 6).toUpperCase()}`,
          outletId: outlet.outletId,
          outletName: outlet.name,
          activationCode: outlet.activationCode || 'KLN-NEW-A9',
          tier: outlet.type === 'Apotek' ? 'Apotek POS' : 'Standard',
          maxUsers: 25,
          validUntil: '2027-12-31',
          deviceFingerprint: 'MENUNGGU-PAIRING',
          status: 'Menunggu Aktivasi'
        });
      }
      if (!current.outletSettings[outlet.outletId]) {
        current.outletSettings[outlet.outletId] = {
          operatingHours: '08:00 - 20:00',
          syncIntervalSec: 20,
          autoSync: true,
          localServerUrl: 'http://localhost:5185',
          coaPrefix: '104',
          receiptFooter: `Terima kasih telah berkunjung ke ${outlet.name}.`,
          activePolis: ['Poli Umum']
        };
      }
    }

    // Ensure owner exists & all users have passwordHash & allowedOutlets
    if (!current.users.some((u) => u.email === 'owner@klinik.id')) {
      current.users.unshift(defaults.users[0]);
    }
    for (const u of current.users) {
      if (!u.passwordHash) {
        u.passwordHash = hashPassword(u.password || '123456');
        delete u.password;
      }
      if (!Array.isArray(u.allowedOutlets)) {
        u.allowedOutlets = u.outlet === 'Semua' ? current.outlets.map((o) => o.name) : [u.outlet];
      }
    }

    // Ensure chartOfAccounts has numeric balanceAmount
    for (const acc of current.chartOfAccounts) {
      if (acc.balanceAmount === undefined) {
        const numeric = Number(String(acc.balance || '0').replace(/[^\d]/g, '')) || 0;
        acc.balanceAmount = numeric;
      }
    }

    // Ensure journalEntries have lines & amountRp
    for (const j of current.journalEntries) {
      if (j.amountRp === undefined) {
        j.amountRp = Number(String(j.amount || '0').replace(/[^\d]/g, '')) || 0;
      }
      if (!j.source) j.source = 'Auto-Sync';
      if (!Array.isArray(j.lines)) {
        const dCode = String(j.accountDebit || '1101').split(' ')[0];
        const cCode = String(j.accountCredit || '4101').split(' ')[0];
        j.lines = [
          { accountCode: dCode, accountName: j.accountDebit || '1101 - Kas & Bank', debit: j.amountRp, credit: 0 },
          { accountCode: cCode, accountName: j.accountCredit || '4101 - Pendapatan', debit: 0, credit: j.amountRp }
        ];
      }
    }

    this.state = current;
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    return this.state;
  }

  async initDatabase() {
    const ok = await initMySqlSchema();
    if (ok) {
      await syncStateToMySql(this.state);
    }
  }

  save(syncMysql = true) {
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    if (syncMysql) {
      syncStateToMySql(this.state).catch(() => {});
    }
  }

  nowTime() {
    return new Date().toTimeString().slice(0, 8);
  }

  nowIsoMinute() {
    return new Date().toISOString().slice(0, 16).replace('T', ' ');
  }

  todayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  formatRp(val) {
    return `Rp ${Math.round(Number(val || 0)).toLocaleString('id-ID')}`;
  }

  bumpMasterVersion() {
    this.state.masterVersion = Number(this.state.masterVersion || 1) + 1;
    return this.state.masterVersion;
  }

  appendSyncLog({ id, direction, outlet, entityType, summary, status }) {
    this.state.syncLogs.unshift({
      id: id || `SYN-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`,
      timestamp: this.nowTime(),
      direction,
      outlet,
      entityType,
      summary,
      status
    });
    if (this.state.syncLogs.length > 250) {
      this.state.syncLogs = this.state.syncLogs.slice(0, 250);
    }
  }

  appendAudit(actor, moduleName, action, summary, diff = null) {
    this.state.auditTrails.unshift({
      id: `AUD-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 90 + 10)}`,
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      actorEmail: actor?.email || 'system@klinik.id',
      actorRole: actor?.role || 'System',
      module: moduleName,
      action,
      summary,
      diff
    });
    if (this.state.auditTrails.length > 300) {
      this.state.auditTrails = this.state.auditTrails.slice(0, 300);
    }
  }

  pushNotification({ severity = 'info', title, message, targetRoute = '/dashboard/notifikasi' }) {
    this.state.notifications.unshift({
      id: `NTF-${Date.now().toString().slice(-5)}`,
      severity,
      title,
      message,
      targetRoute,
      isRead: false,
      createdAt: this.nowIsoMinute()
    });
    if (this.state.notifications.length > 100) {
      this.state.notifications = this.state.notifications.slice(0, 100);
    }
  }

  postJournal({ outlet = 'Pusat (Cloud VPS)', source = 'Manual', description, lines, codePrefix = 'JRN' }) {
    const cleanLines = (lines || []).map((l) => ({
      accountCode: String(l.accountCode),
      accountName: l.accountName || this.getCoaName(l.accountCode),
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0)
    }));
    const totalDebit = cleanLines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = cleanLines.reduce((s, l) => s + l.credit, 0);
    if (cleanLines.length < 2 || Math.abs(totalDebit - totalCredit) > 0.01 || totalDebit <= 0) {
      throw new Error(`Jurnal tidak balance (Debit: ${totalDebit}, Kredit: ${totalCredit})`);
    }

    const firstDebit = cleanLines.find((l) => l.debit > 0) || cleanLines[0];
    const firstCredit = cleanLines.find((l) => l.credit > 0) || cleanLines[1];
    const entry = {
      code: `${codePrefix}-${Date.now().toString().slice(-5)}`,
      date: this.nowIsoMinute(),
      outlet,
      source,
      accountDebit: `${firstDebit.accountCode} - ${firstDebit.accountName}`,
      accountCredit: `${firstCredit.accountCode} - ${firstCredit.accountName}`,
      description,
      amountRp: totalDebit,
      amount: this.formatRp(totalDebit),
      status: source === 'Auto-Sync' ? 'Tersinkron Otomatis' : 'Diposting',
      lines: cleanLines
    };

    for (const line of cleanLines) {
      const acc = this.state.chartOfAccounts.find((a) => a.code === line.accountCode);
      if (acc) {
        const delta = acc.normalBalance === 'Debit' ? line.debit - line.credit : line.credit - line.debit;
        acc.balanceAmount = Number(acc.balanceAmount || 0) + delta;
        acc.balance = this.formatRp(acc.balanceAmount);
      }
    }

    this.state.journalEntries.unshift(entry);
    return entry;
  }

  getCoaName(code) {
    const acc = this.state.chartOfAccounts.find((a) => a.code === String(code));
    return acc ? acc.name : `Akun ${code}`;
  }

  adjustBatchStock({ kfaCode, itemName, location, batchNo, expiredDate, deltaQty, refType, refNo, rack = 'RAK-A1' }) {
    let batch = this.state.inventoryBatches.find(
      (b) => b.code === kfaCode && b.location.toLowerCase() === location.toLowerCase() && (!batchNo || b.batchNo === batchNo)
    );
    if (!batch && deltaQty > 0) {
      batch = {
        id: `B-${Date.now().toString().slice(-5)}`,
        code: kfaCode,
        name: itemName,
        location,
        batchNo: batchNo || `BCH-${Date.now().toString().slice(-4)}`,
        expiredDate: expiredDate || '2028-12-31',
        qty: 0,
        rack,
        status: 'Tersedia'
      };
      this.state.inventoryBatches.unshift(batch);
    }
    if (batch) {
      batch.qty = Math.max(0, Number(batch.qty || 0) + Number(deltaQty));
    }

    // Recompute centralStock on master_kfa_items from all Gudang Pusat available batches
    const master = this.state.inventoryItems.find((i) => i.code === kfaCode);
    if (master && location === 'Gudang Pusat') {
      const centralBatches = this.state.inventoryBatches.filter(
        (b) => b.code === kfaCode && b.location === 'Gudang Pusat' && b.status === 'Tersedia'
      );
      master.centralStock = centralBatches.reduce((sum, b) => sum + Number(b.qty || 0), 0);
    }

    this.state.stockCardMovements.unshift({
      id: `SCM-${Date.now().toString().slice(-5)}`,
      date: this.nowIsoMinute(),
      code: kfaCode,
      name: itemName || master?.name || kfaCode,
      location,
      batchNo: batch?.batchNo || batchNo || '-',
      refType,
      refNo,
      qtyIn: deltaQty > 0 ? deltaQty : 0,
      qtyOut: deltaQty < 0 ? Math.abs(deltaQty) : 0,
      balanceAfter: batch ? batch.qty : 0
    });
  }
}
