import { sendDownload } from '../core/http.mjs';
import { sanitizeOutletForClient, sanitizeUserForClient } from '../core/security.mjs';
import { isMySqlConnected } from '../db/mysql.mjs';

export function registerIntegrationsReportsSettingsRoutes(router, repo) {
  // Integrasi: SATUSEHAT & BPJS & Mapping Kode
  router.get('/api/integrations/health', () => {
    const active = repo.state.outlets.filter((o) => o.status !== 'Arsip');
    return {
      outlets: active.map(sanitizeOutletForClient),
      fhirSummary: {
        sent: repo.state.fhirLogs.filter((l) => l.status === 'Terkirim').length,
        failed: repo.state.fhirLogs.filter((l) => l.status !== 'Terkirim').length
      },
      bpjsSummary: {
        success: repo.state.bpjsLogs.filter((l) => l.status === 'Sukses').length,
        pending: repo.state.bpjsLogs.filter((l) => l.status !== 'Sukses').length
      }
    };
  }, { module: 'IT', action: 'view' });

  router.get('/api/integrations/satusehat/logs', () => repo.state.fhirLogs, { module: 'IT', action: 'view' });

  router.post('/api/integrations/satusehat/retry/:id', ({ params, user }) => {
    const log = repo.state.fhirLogs.find((l) => l.id === params.id);
    if (!log) return { status: 404, body: { message: 'Log FHIR tidak ditemukan' } };
    log.httpStatus = 200;
    log.status = 'Terkirim';
    log.responseMessage = `OK · Retry Sukses (FHIR ID: fhir-${Date.now().toString().slice(-5)})`;
    log.timestamp = repo.nowIsoMinute();
    repo.appendSyncLog({
      direction: 'CLOUD -> SATUSEHAT',
      outlet: log.outlet,
      entityType: `FHIR:${log.resourceType}`,
      summary: `Kirim ulang ${log.resourceType} (${log.patientLabel}) berhasil`,
      status: 'Tersinkron'
    });
    repo.appendAudit(user, 'Integrasi', 'RETRY_FHIR', `Kirim ulang FHIR ${log.id} (${log.resourceType})`);
    repo.save();
    return log;
  }, { module: 'IT', action: 'edit' });

  router.get('/api/integrations/mappings', () => repo.state.codeMappings, { module: 'IT', action: 'view' });

  router.post('/api/integrations/mappings', ({ body, user }) => {
    const mapItem = {
      id: `MAP-${Date.now().toString().slice(-4)}`,
      standard: body.standard || 'ICD-10',
      localCode: body.localCode || 'LOK-001',
      localName: body.localName || 'Kode Lokal',
      standardCode: body.standardCode || '',
      standardDisplay: body.standardDisplay || '',
      status: body.standardCode ? 'Terpetakan' : 'Belum Terpetakan'
    };
    repo.state.codeMappings.unshift(mapItem);
    repo.bumpMasterVersion();
    repo.appendAudit(user, 'Integrasi', 'CREATE_CODE_MAPPING', `Menambahkan mapping ${mapItem.standard}: ${mapItem.localCode}`);
    repo.save();
    return mapItem;
  }, { module: 'IT', action: 'create' });

  router.put('/api/integrations/mappings/:id', ({ params, body, user }) => {
    const m = repo.state.codeMappings.find((x) => x.id === params.id);
    if (!m) return { status: 404, body: { error: 'Mapping tidak ditemukan' } };
    m.standardCode = body.standardCode ?? m.standardCode;
    m.standardDisplay = body.standardDisplay ?? m.standardDisplay;
    m.status = m.standardCode ? 'Terpetakan' : 'Belum Terpetakan';
    repo.bumpMasterVersion();
    repo.appendAudit(user, 'Integrasi', 'UPDATE_CODE_MAPPING', `Update mapping ${m.localCode} -> ${m.standardCode}`);
    repo.save();
    return m;
  }, { module: 'IT', action: 'edit' });

  router.get('/api/integrations/bpjs/monitoring', () => ({
    claims: repo.state.bpjsClaims,
    logs: repo.state.bpjsLogs
  }), { module: 'IT', action: 'view' });

  router.post('/api/integrations/bpjs/retry/:id', ({ params, user }) => {
    const log = repo.state.bpjsLogs.find((l) => l.id === params.id);
    if (!log) return { status: 404, body: { error: 'Log BPJS tidak ditemukan' } };
    log.responseCode = '200';
    log.status = 'Sukses';
    log.message = 'Kirim ulang bridging BPJS berhasil (200 OK)';
    log.timestamp = repo.nowIsoMinute();
    repo.appendAudit(user, 'Integrasi', 'RETRY_BPJS', `Retry log bridging BPJS ${log.refNo}`);
    repo.save();
    return log;
  }, { module: 'IT', action: 'edit' });

  // Two-Way Sync Hub Endpoints (100% compatible with serverlocal!)
  router.get('/api/sync/hub-status', () => ({
    masterVersion: repo.state.masterVersion,
    mysqlConnected: isMySqlConnected(),
    nodes: repo.state.edgeNodes,
    outlets: repo.state.outlets.filter((o) => o.status !== 'Arsip').map(sanitizeOutletForClient),
    logs: repo.state.syncLogs.slice(0, 60)
  }), { module: 'IT', action: 'view' });

  router.post('/api/sync/broadcast-master', ({ user }) => {
    const ver = repo.bumpMasterVersion();
    for (const node of repo.state.edgeNodes) {
      if (node.status === 'Online') node.masterVersionAck = ver;
    }
    repo.appendSyncLog({
      direction: 'CLOUD -> LOKAL',
      outlet: 'Semua Outlet',
      entityType: 'MasterBroadcast',
      summary: `Broadcast paket master data & tarif terbaru (v${ver})`,
      status: 'Tersinkron'
    });
    repo.appendAudit(user, 'Integrasi', 'BROADCAST_MASTER', `Broadcast master data v${ver} ke seluruh cabang`);
    repo.save();
    return { success: true, masterVersion: ver };
  }, { module: 'IT', action: 'edit' });

  router.post('/api/sync/status', ({ body }) => {
    const outlet = repo.state.outlets.find(
      (o) =>
        o.outletId.toLowerCase() === String(body.outletId || '').toLowerCase() ||
        o.name.toLowerCase() === String(body.outletName || '').toLowerCase()
    );
    if (outlet) {
      outlet.isOnline = Boolean(body.isOnline);
      outlet.connectionLabel = outlet.isOnline ? 'Online' : 'Offline';
      outlet.connectionStatus = outlet.isOnline ? 'ok' : 'bad';
      outlet.pendingSyncCount = Number(body.pendingCount || 0);
      outlet.lastSync = outlet.isOnline ? 'Baru saja' : 'Terputus (Offline)';
      outlet.satuSehatLabel = outlet.pendingSyncCount > 0 ? `${outlet.pendingSyncCount} antre` : 'Terkirim';
      outlet.satuSehatStatus = outlet.pendingSyncCount > 0 ? 'warn' : 'ok';
      outlet.bpjsStatus = outlet.isOnline ? 'ok' : 'warn';
      outlet.bpjsLabel = outlet.isOnline
        ? outlet.type === 'Apotek' ? 'PRB aktif' : outlet.type === 'Klinik Pratama' ? 'P-Care aktif' : 'VClaim aktif'
        : outlet.type === 'Apotek' ? 'PRB tertunda' : outlet.type === 'Klinik Pratama' ? 'P-Care tertunda' : 'VClaim tertunda';

      const node = repo.state.edgeNodes.find((n) => n.outletId === outlet.outletId);
      if (node) {
        node.status = outlet.isOnline ? 'Online' : 'Offline';
        node.lastHeartbeat = outlet.isOnline ? 'Baru saja' : 'Terputus';
      }

      if (outlet.isOnline) {
        repo.state.users.forEach((u) => {
          if (u.outlet.toLowerCase() === outlet.name.toLowerCase() && u.syncStatus !== 'Tersinkron') {
            u.syncStatus = 'Tersinkron';
          }
        });
      }
      repo.save();
    }
    return { success: true, masterVersion: repo.state.masterVersion, outlet: outlet ? sanitizeOutletForClient(outlet) : null };
  }, { public: true });

  router.post('/api/sync/push', ({ body }) => {
    const outlet = repo.state.outlets.find(
      (o) =>
        o.outletId.toLowerCase() === String(body.outletId || '').toLowerCase() ||
        o.name.toLowerCase() === String(body.outletName || '').toLowerCase()
    );
    const items = Array.isArray(body.items) ? body.items : [];
    if (outlet) {
      outlet.isOnline = true;
      outlet.connectionLabel = 'Online';
      outlet.connectionStatus = 'ok';
      outlet.lastSync = 'Baru saja';
      outlet.pendingSyncCount = 0;
      outlet.satuSehatLabel = 'Terkirim';
      outlet.satuSehatStatus = 'ok';
      outlet.bpjsStatus = 'ok';
      outlet.bpjsLabel = outlet.type === 'Apotek' ? 'PRB aktif' : outlet.type === 'Klinik Pratama' ? 'P-Care aktif' : 'VClaim aktif';

      const node = repo.state.edgeNodes.find((n) => n.outletId === outlet.outletId);
      if (node) {
        node.status = 'Online';
        node.lastHeartbeat = 'Baru saja';
        node.masterVersionAck = repo.state.masterVersion;
      }

      for (const item of items) {
        if (['Pendaftaran', 'Kunjungan', 'Penjualan', 'Rawat Jalan', 'Rawat Inap'].includes(item.entityType)) {
          outlet.todayVisits = (outlet.todayVisits || 0) + 1;
        }
        if (['Rawat Jalan', 'Rawat Inap', 'Visite Dokter'].includes(item.entityType)) {
          const doc = repo.state.doctorFees.find((d) => d.outlet.toLowerCase() === outlet.name.toLowerCase()) || repo.state.doctorFees[0];
          if (doc) {
            doc.patientsCount += 1;
            if (item.entityType === 'Visite Dokter') doc.visiteCount += 1;
            doc.feeMillions = Number((doc.feeMillions + 0.15).toFixed(2));
          }
        }
        const amt = Number(item.amountMillions || 0);
        if (amt > 0) {
          const amtRp = Math.round(amt * 1_000_000);
          outlet.todayRevenueMillions = Number((Number(outlet.todayRevenueMillions || 0) + amt).toFixed(2));
          repo.postJournal({
            outlet: outlet.name,
            source: 'Auto-Sync',
            description: item.summary,
            lines: [
              { accountCode: '1101', debit: amtRp, credit: 0 },
              { accountCode: outlet.type === 'Apotek' ? '4102' : '4101', debit: 0, credit: amtRp }
            ]
          });
        }
        repo.appendSyncLog({
          id: item.id,
          direction: 'LOKAL -> CLOUD',
          outlet: outlet.name,
          entityType: item.entityType || 'Transaksi',
          summary: item.summary || 'Sinkronisasi data cabang',
          status: 'Tersinkron'
        });
      }

      repo.state.users.forEach((u) => {
        if (u.outlet.toLowerCase() === outlet.name.toLowerCase()) u.syncStatus = 'Tersinkron';
      });
      repo.save();
    }
    return {
      acceptedIds: items.map((i) => i.id),
      masterVersion: repo.state.masterVersion,
      outlet: outlet ? sanitizeOutletForClient(outlet) : null
    };
  }, { public: true });

  router.get('/api/sync/pull', ({ query }) => {
    const outletName = query.get('outletName') || '';
    const outletId = query.get('outletId') || '';
    const outlet = repo.state.outlets.find(
      (o) =>
        o.outletId.toLowerCase() === outletId.toLowerCase() ||
        o.name.toLowerCase() === outletName.toLowerCase()
    );
    const outletUsers = outletName
      ? repo.state.users.filter(
          (u) =>
            u.outlet.toLowerCase() === outletName.toLowerCase() ||
            u.outlet === 'Semua' ||
            (u.allowedOutlets || []).some((ao) => ao.toLowerCase() === outletName.toLowerCase())
        )
      : repo.state.users;
    const approvedTransfers = repo.state.approvedTransfers.filter(
      (t) =>
        t.outletId.toLowerCase() === outletId.toLowerCase() ||
        t.outletName.toLowerCase() === outletName.toLowerCase()
    );
    const stockRequests = repo.state.stockRequests.filter(
      (r) =>
        r.outletId.toLowerCase() === outletId.toLowerCase() ||
        r.outletName.toLowerCase() === outletName.toLowerCase()
    );
    const template = outlet
      ? repo.state.outletTemplates.find((t) => t.outletType === outlet.type) ||
        repo.state.outletTemplates.find((t) => outlet.type && t.outletType.startsWith(outlet.type))
      : null;

    const outletType = outlet?.type || '';
    const serviceScope = outlet?.serviceScope ||
      (outletType.includes('Apotek')
        ? 'APOTEK'
        : outletType.includes('Rawat Jalan') && !outletType.includes('Rawat Inap')
        ? 'RJ_ONLY'
        : 'RI_RJ');

    return {
      masterVersion: repo.state.masterVersion,
      outletType,
      serviceScope,
      outlet: outlet ? { ...sanitizeOutletForClient(outlet), serviceScope } : null,
      users: repo.state.users.map(sanitizeUserForClient),
      outletUsers: outletUsers.map(sanitizeUserForClient),
      inventory: repo.state.inventoryItems,
      approvedTransfers,
      stockRequests,
      templateModules: template?.modules || [],
      tariffs: repo.state.systemTariffs,
      promos: repo.state.promosPackages.filter((p) => p.status === 'Aktif')
    };
  }, { public: true });

  // Laporan Konsolidasi
  router.get('/api/reports/executive', () => {
    const activeOutlets = repo.state.outlets.filter((o) => o.status !== 'Arsip');
    const totalRevenueMillions = Number(activeOutlets.reduce((s, o) => s + Number(o.todayRevenueMillions || 0), 0).toFixed(2));
    const totalVisits = activeOutlets.reduce((s, o) => s + Number(o.todayVisits || 0), 0);
    const totalStockValueRp = repo.state.inventoryItems.reduce((s, i) => s + Number(i.centralStock || 0) * Number(i.hnaPrice || 1500), 0);
    const compliantCreds = repo.state.medicalCredentials.filter((c) => c.status === 'Aktif').length;
    const totalCreds = repo.state.medicalCredentials.length;

    return {
      visitsRevenue: {
        totalVisits,
        totalRevenueMillions,
        payerMix: [
          { payer: 'BPJS Kesehatan', sharePercent: 58, visits: Math.round(totalVisits * 0.58) },
          { payer: 'Umum / Mandiri', sharePercent: 31, visits: Math.round(totalVisits * 0.31) },
          { payer: 'Asuransi Swasta', sharePercent: 11, visits: Math.max(0, totalVisits - Math.round(totalVisits * 0.89)) }
        ],
        byOutlet: activeOutlets.map(sanitizeOutletForClient)
      },
      bpjsClaims: repo.state.bpjsClaims,
      scorecard: {
        totalStockValueRp,
        hrCompliancePercent: totalCreds > 0 ? Math.round((compliantCreds / totalCreds) * 100) : 100,
        totalDoctorFeesMillions: Number(repo.state.doctorFees.reduce((s, d) => s + Number(d.feeMillions || 0), 0).toFixed(2)),
        cashBalanceRp: repo.state.cashBankAccounts.reduce((s, a) => s + Number(a.balanceRp || 0), 0)
      },
      regulatory: {
        topDiseases: [
          { icd10: 'J06.9', name: 'Infeksi Saluran Pernapasan Akut (ISPA)', cases: 112, outlets: 'Klinik Utama & Pratama' },
          { icd10: 'I10', name: 'Hipertensi Esensial (Primer)', cases: 84, outlets: 'Semua Klinik & PRB Apotek' },
          { icd10: 'E11.9', name: 'Diabetes Mellitus Tipe 2 Tanpa Komplikasi', cases: 61, outlets: 'Klinik Utama & PRB Apotek' },
          { icd10: 'K29.7', name: 'Gastritis & Dispepsia', cases: 48, outlets: 'Klinik Pratama' }
        ],
        sipnapSummary: repo.state.inventoryItems
          .filter((i) => i.isNarcotic)
          .map((i) => ({ code: i.code, name: i.name, centralStock: i.centralStock, unit: i.unit, status: 'Tercatat SIPNAP' })),
        sirsRlSummary: [
          { code: 'RL 1.2', title: 'Indikator Pelayanan Rawat Inap (BOR / ALOS)', value: 'BOR 78% · ALOS 3,2 Hari (Klinik Utama)' },
          { code: 'RL 5.3', title: 'Daftar 10 Besar Penyakit Rawat Jalan', value: '412 Kunjungan Terkode ICD-10' },
          { code: 'KEMENKES-B3', title: 'Pelaporan Limbah Medis & Kalibrasi Alkes', value: `${repo.state.outletPermits.length} Izin Terpantau` }
        ]
      }
    };
  }, { module: 'LP', action: 'view' });

  // Pengaturan Sistem
  router.get('/api/settings/general', () => ({
    general: repo.state.generalSettings,
    tariffs: repo.state.systemTariffs
  }), { module: 'PS', action: 'view' });

  router.put('/api/settings/general', ({ body, user }) => {
    Object.assign(repo.state.generalSettings, body);
    repo.bumpMasterVersion();
    repo.appendAudit(user, 'Pengaturan Sistem', 'UPDATE_GENERAL_SETTINGS', 'Memperbarui profil grup & referensi umum');
    repo.save();
    return repo.state.generalSettings;
  }, { module: 'PS', action: 'edit' });

  router.post('/api/settings/tariffs', ({ body, user }) => {
    const t = {
      id: `TRF-${Date.now().toString().slice(-4)}`,
      code: body.code || `LAY-${Date.now().toString().slice(-4)}`,
      name: body.name || 'Layanan Medis Baru',
      category: body.category || 'Tindakan',
      basePriceRp: Number(body.basePriceRp || 100000),
      bpjsTariffRp: Number(body.bpjsTariffRp || 75000),
      applicableTo: body.applicableTo || 'Semua Klinik',
      status: 'Aktif'
    };
    repo.state.systemTariffs.unshift(t);
    repo.bumpMasterVersion();
    repo.appendAudit(user, 'Pengaturan Sistem', 'CREATE_TARIFF', `Menambah tarif ${t.code} - ${t.name}`);
    repo.save();
    return t;
  }, { module: 'PS', action: 'create' });

  router.put('/api/settings/tariffs/:id', ({ params, body, user }) => {
    const t = repo.state.systemTariffs.find((x) => x.id === params.id);
    if (!t) return { status: 404, body: { error: 'Tarif tidak ditemukan' } };
    Object.assign(t, {
      name: body.name ?? t.name,
      category: body.category ?? t.category,
      basePriceRp: body.basePriceRp !== undefined ? Number(body.basePriceRp) : t.basePriceRp,
      bpjsTariffRp: body.bpjsTariffRp !== undefined ? Number(body.bpjsTariffRp) : t.bpjsTariffRp,
      applicableTo: body.applicableTo ?? t.applicableTo,
      status: body.status ?? t.status
    });
    repo.bumpMasterVersion();
    repo.appendAudit(user, 'Pengaturan Sistem', 'UPDATE_TARIFF', `Memperbarui tarif ${t.code}`);
    repo.save();
    return t;
  }, { module: 'PS', action: 'edit' });

  router.get('/api/settings/security', () => ({
    policy: repo.state.securityPolicy,
    sessions: repo.state.activeSessions
  }), { module: 'PS', action: 'view' });

  router.put('/api/settings/security', ({ body, user }) => {
    Object.assign(repo.state.securityPolicy, body);
    repo.appendAudit(user, 'Pengaturan Sistem', 'UPDATE_SECURITY_POLICY', 'Memperbarui kebijakan keamanan sistem');
    repo.save();
    return repo.state.securityPolicy;
  }, { module: 'PS', action: 'edit' });

  router.get('/api/settings/audit-trail', ({ query }) => {
    const mod = query.get('module') || 'Semua';
    let list = repo.state.auditTrails;
    if (mod !== 'Semua') {
      list = list.filter((a) => a.module === mod);
    }
    return list;
  }, { module: 'PS', action: 'view' });

  router.get('/api/settings/backups', () => ({
    snapshots: repo.state.backupSnapshots,
    edgeNodes: repo.state.edgeNodes
  }), { module: 'PS', action: 'view' });

  router.post('/api/settings/backups', ({ user }) => {
    const id = `BKP-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}`;
    const jsonPayload = JSON.stringify(repo.state, null, 2);
    const sizeKb = Math.max(1, Math.round(Buffer.byteLength(jsonPayload) / 1024));
    const snap = {
      id,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      type: 'Manual Cloud Backup',
      sizeKb,
      dbEngine: isMySqlConnected() ? 'MySQL + JSON Snapshot' : 'JSON Snapshot',
      status: 'Sukses'
    };
    repo.state.backupSnapshots.unshift(snap);
    repo.appendAudit(user, 'Pengaturan Sistem', 'CREATE_BACKUP', `Membuat snapshot backup ${id} (${sizeKb} KB)`);
    repo.save(false);
    return snap;
  }, { module: 'PS', action: 'create' });

  router.get('/api/settings/backups/:id/download', ({ params, res }) => {
    const content = JSON.stringify(repo.state, null, 2);
    sendDownload(res, content, 'application/json', `${params.id}.json`);
    return { __handled: true };
  }, { module: 'PS', action: 'export' });

  router.post('/api/settings/backups/:id/restore', ({ params, user }) => {
    repo.appendAudit(user, 'Pengaturan Sistem', 'RESTORE_BACKUP', `Simulasi verifikasi & pemulihan snapshot ${params.id}`);
    repo.save(false);
    return { success: true, message: `Integritas snapshot ${params.id} terverifikasi dan siap dipulihkan.` };
  }, { module: 'PS', action: 'approve' });

  router.get('/api/settings/edge-nodes', () => repo.state.edgeNodes, { module: 'PS', action: 'view' });

  router.post('/api/settings/edge-nodes/:id/command', ({ params, body, user }) => {
    const node = repo.state.edgeNodes.find((n) => n.outletId === params.id);
    if (!node) return { status: 404, body: { error: 'Node server lokal tidak ditemukan' } };
    const cmd = body.command || 'FORCE_SYNC';
    node.lastHeartbeat = 'Baru saja (Command Executed)';
    node.masterVersionAck = repo.state.masterVersion;
    repo.appendSyncLog({
      direction: 'CLOUD -> LOKAL',
      outlet: node.outletName,
      entityType: 'RemoteCommand',
      summary: `Eksekusi perintah remote ${cmd} ke server lokal ${node.outletName}`,
      status: 'Tersinkron'
    });
    repo.appendAudit(user, 'Pengaturan Sistem', 'EDGE_COMMAND', `Mengirim perintah ${cmd} ke ${node.outletName}`);
    repo.save();
    return { success: true, node };
  }, { module: 'PS', action: 'edit' });
}
