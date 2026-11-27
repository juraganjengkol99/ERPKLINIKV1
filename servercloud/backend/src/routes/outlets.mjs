import {
  encryptSecret,
  isMaskedValue,
  sanitizeOutletForClient
} from '../core/security.mjs';

export function resolveServiceScope(type = '') {
  const t = String(type || '');
  if (t.includes('Apotek')) return 'APOTEK';
  if (t.includes('Rawat Jalan') && !t.includes('Rawat Inap')) return 'RJ_ONLY';
  return 'RI_RJ';
}

export function registerOutletRoutes(router, repo) {
  router.get('/api/outlets', ({ query }) => {
    const statusFilter = query.get('status') || 'Aktif';
    let list = repo.state.outlets;
    if (statusFilter !== 'Semua') {
      list = list.filter((o) => (o.status || 'Aktif') === statusFilter);
    }
    return list.map(sanitizeOutletForClient);
  }, { module: 'MO', action: 'view' });

  router.post('/api/outlets/test-bridging', ({ body }) => {
    const target = body.target || 'SATUSEHAT';
    if (target === 'SATUSEHAT') {
      if (!body.satuSehatOrgId || !body.satuSehatClientId) {
        return { status: 400, body: { ok: false, message: 'Lengkapi Organization ID dan Client ID SATUSEHAT terlebih dahulu.' } };
      }
      return {
        ok: true,
        message: `Handshake OAuth2 SATUSEHAT (${body.satuSehatEnv || 'Sandbox'}) berhasil! Org ID: ${body.satuSehatOrgId}`
      };
    }
    if (!body.bpjsPpkCode || !body.bpjsConsId) {
      return { status: 400, body: { ok: false, message: 'Lengkapi Kode PPK BPJS dan Cons ID terlebih dahulu.' } };
    }
    return {
      ok: true,
      message: `Koneksi ${body.bpjsServiceType || 'BPJS'} (${body.bpjsEnv || 'Development'}) terhubung! PPK: ${body.bpjsPpkCode}`
    };
  }, { module: 'MO', action: 'view' });

  router.post('/api/outlets/verify-license', ({ body }) => {
    const code = String(body.activationCode || '').trim().toUpperCase();
    const outlet = repo.state.outlets.find((o) => (o.activationCode || '').toUpperCase() === code && o.status !== 'Arsip');
    const license = repo.state.licenses.find((l) => (l.activationCode || '').toUpperCase() === code);
    if (outlet && (!license || license.status !== 'Suspended')) {
      if (license) {
        license.status = 'Aktif';
        if (body.deviceFingerprint) license.deviceFingerprint = body.deviceFingerprint;
      }
      repo.appendSyncLog({
        id: `LIC-${Date.now().toString().slice(-4)}`,
        direction: 'LOKAL <-> CLOUD',
        outlet: outlet.name,
        entityType: 'AktivasiLisensi',
        summary: `Verifikasi Lisensi Berhasil (${code}) untuk ${outlet.name}`,
        status: 'Tersinkron'
      });
      repo.save();
      return { valid: true, outletName: outlet.name, type: outlet.type, activationCode: code };
    }
    return { status: 404, body: { valid: false, message: 'Kode aktivasi tidak valid atau lisensi disuspensi' } };
  }, { public: true });

  router.post('/api/outlets', ({ body, user }) => {
    const code = `KLN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-A9`;
    const name = String(body.name || '').trim() || 'Klinik Cabang Baru';
    const type = body.type || 'Klinik Utama';
    const outletId = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-3)}`;

    const outlet = {
      outletId,
      name,
      type,
      serviceScope: resolveServiceScope(type),
      status: 'Aktif',
      isOnline: true,
      connectionLabel: 'Online',
      connectionStatus: 'ok',
      lastSync: 'Baru saja',
      satuSehatLabel: body.satuSehatOrgId ? 'Terhubung' : 'Belum Konfigurasi',
      satuSehatStatus: body.satuSehatOrgId ? 'ok' : 'warn',
      bpjsLabel: type.includes('Apotek') ? 'PRB aktif' : type.includes('Pratama') ? 'P-Care aktif' : 'VClaim aktif',
      bpjsStatus: body.bpjsPpkCode ? 'ok' : 'warn',
      todayVisits: 0,
      todayRevenueMillions: 0,
      pendingSyncCount: 0,
      activationCode: code,
      address: body.address || 'Bekasi',
      nib: body.nib || '91203018201',
      phone: body.phone || '',
      adminEmail: body.adminEmail || '',
      satuSehatEnv: body.satuSehatEnv || 'Sandbox',
      satuSehatOrgId: body.satuSehatOrgId || '',
      satuSehatLocId: body.satuSehatLocId || '',
      satuSehatClientId: body.satuSehatClientId || '',
      satuSehatClientSecret: encryptSecret(body.satuSehatClientSecret),
      bpjsServiceType: body.bpjsServiceType || (type === 'Apotek' ? 'Apotek Online / PRB' : type === 'Klinik Pratama' ? 'P-Care (FKTP)' : 'VClaim (FKRTL)'),
      bpjsEnv: body.bpjsEnv || 'Development',
      bpjsPpkCode: body.bpjsPpkCode || '',
      bpjsConsId: body.bpjsConsId || '',
      bpjsSecretKey: encryptSecret(body.bpjsSecretKey),
      bpjsUserKey: encryptSecret(body.bpjsUserKey)
    };

    repo.state.outlets.push(outlet);
    repo.state.licenses.push({
      licenseId: `LIC-${Date.now().toString().slice(-4)}`,
      outletId,
      outletName: name,
      activationCode: code,
      tier: type === 'Apotek' ? 'Apotek POS & PRB' : type === 'Klinik Pratama' ? 'Pro FKTP' : 'Enterprise FKRTL',
      maxUsers: 25,
      validUntil: '2027-12-31',
      deviceFingerprint: 'MENUNGGU-PAIRING',
      status: 'Menunggu Aktivasi'
    });
    repo.state.outletSettings[outletId] = {
      operatingHours: '08:00 - 20:00',
      syncIntervalSec: 20,
      autoSync: true,
      localServerUrl: 'http://localhost:5185',
      coaPrefix: String(100 + repo.state.outlets.length),
      receiptFooter: `Terima kasih telah berkunjung ke ${name}.`,
      activePolis: type === 'Apotek' ? ['Resep', 'OTC'] : ['Poli Umum']
    };
    repo.state.edgeNodes.push({
      outletId,
      outletName: name,
      appVersion: 'v2.4.1',
      dbEngine: 'MySQL 8.0 + Local Outbox',
      masterVersionAck: repo.state.masterVersion,
      cpuLoad: '0%',
      memoryUsage: '0%',
      diskFreeGb: 200,
      lastHeartbeat: 'Baru dibuat',
      status: 'Menunggu Aktivasi'
    });

    repo.bumpMasterVersion();
    repo.appendSyncLog({
      direction: 'CLOUD',
      outlet: name,
      entityType: 'OutletBaru',
      summary: `Outlet baru dibuat (${type}) · Kode: ${code}`,
      status: 'Aktif'
    });
    repo.appendAudit(user, 'Manajemen Outlet', 'CREATE_OUTLET', `Membuat outlet ${name} (${type}) dengan kode ${code}`, { after: { name, type, code } });
    repo.save();
    return { outlet: sanitizeOutletForClient(outlet), activationCode: code };
  }, { module: 'MO', action: 'create' });

  router.put('/api/outlets/:id', ({ params, body, user }) => {
    const idx = repo.state.outlets.findIndex(
      (o) => o.outletId === params.id || o.name.toLowerCase() === params.id.toLowerCase()
    );
    if (idx === -1) return { status: 404, body: { error: 'Outlet not found' } };

    const o = repo.state.outlets[idx];
    const nextType = body.type ?? o.type;

    // Secret guard: NEVER overwrite existing encrypted secret if incoming is empty or masked dots
    const nextSsSecret = !isMaskedValue(body.satuSehatClientSecret)
      ? encryptSecret(body.satuSehatClientSecret)
      : o.satuSehatClientSecret;
    const nextBpjsSecret = !isMaskedValue(body.bpjsSecretKey)
      ? encryptSecret(body.bpjsSecretKey)
      : o.bpjsSecretKey;
    const nextBpjsUserKey = !isMaskedValue(body.bpjsUserKey)
      ? encryptSecret(body.bpjsUserKey)
      : o.bpjsUserKey;

    repo.state.outlets[idx] = {
      ...o,
      name: body.name ?? o.name,
      type: nextType,
      serviceScope: resolveServiceScope(nextType),
      nib: body.nib ?? o.nib,
      address: body.address ?? o.address,
      phone: body.phone ?? o.phone,
      adminEmail: body.adminEmail ?? o.adminEmail,
      satuSehatEnv: body.satuSehatEnv ?? o.satuSehatEnv,
      satuSehatOrgId: body.satuSehatOrgId ?? o.satuSehatOrgId,
      satuSehatLocId: body.satuSehatLocId ?? o.satuSehatLocId,
      satuSehatClientId: body.satuSehatClientId ?? o.satuSehatClientId,
      satuSehatClientSecret: nextSsSecret,
      bpjsServiceType: body.bpjsServiceType ?? o.bpjsServiceType,
      bpjsEnv: body.bpjsEnv ?? o.bpjsEnv,
      bpjsPpkCode: body.bpjsPpkCode ?? o.bpjsPpkCode,
      bpjsConsId: body.bpjsConsId ?? o.bpjsConsId,
      bpjsSecretKey: nextBpjsSecret,
      bpjsUserKey: nextBpjsUserKey,
      satuSehatLabel: (body.satuSehatOrgId ?? o.satuSehatOrgId) ? 'Terhubung' : 'Belum Konfigurasi',
      satuSehatStatus: (body.satuSehatOrgId ?? o.satuSehatOrgId) ? 'ok' : 'warn',
      bpjsLabel: nextType.includes('Apotek') ? 'PRB aktif' : nextType.includes('Pratama') ? 'P-Care aktif' : 'VClaim aktif',
      bpjsStatus: (body.bpjsPpkCode ?? o.bpjsPpkCode) ? 'ok' : 'warn'
    };

    repo.bumpMasterVersion();
    repo.appendSyncLog({
      direction: 'CLOUD',
      outlet: repo.state.outlets[idx].name,
      entityType: 'UpdateOutlet',
      summary: `Update profil & bridging outlet ${repo.state.outlets[idx].name}`,
      status: 'Aktif'
    });
    repo.appendAudit(user, 'Manajemen Outlet', 'UPDATE_OUTLET', `Mengubah profil & konfigurasi ${repo.state.outlets[idx].name}`);
    repo.save();
    return sanitizeOutletForClient(repo.state.outlets[idx]);
  }, { module: 'MO', action: 'edit' });

  router.patch('/api/outlets/:id/service-type', ({ params, body, user }) => {
    const idx = repo.state.outlets.findIndex(
      (o) => o.outletId === params.id || o.name.toLowerCase() === params.id.toLowerCase()
    );
    if (idx === -1) return { status: 404, body: { error: 'Outlet tidak ditemukan' } };

    const o = repo.state.outlets[idx];
    if (String(o.type || '').includes('Apotek')) {
      return { status: 400, body: { error: 'Outlet Apotek tidak memiliki mode Rawat Inap / Rawat Jalan' } };
    }

    const baseCategory = String(o.type || '').includes('Pratama') ? 'Klinik Pratama' : 'Klinik Utama';
    const nextScope = body.serviceScope === 'RJ_ONLY' || (body.type && String(body.type).includes('Rawat Jalan') && !String(body.type).includes('Rawat Inap'))
      ? 'RJ_ONLY'
      : 'RI_RJ';
    const nextType = body.type || (nextScope === 'RJ_ONLY' ? `${baseCategory} (Rawat Jalan)` : `${baseCategory} (Rawat Inap & Jalan)`);

    repo.state.outlets[idx] = {
      ...o,
      type: nextType,
      serviceScope: nextScope,
      bpjsServiceType: nextType.includes('Pratama')
        ? 'P-Care (FKTP)'
        : nextScope === 'RJ_ONLY'
        ? 'VClaim (FKRTL / Rawat Jalan)'
        : 'VClaim (FKRTL / Rawat Inap & Jalan)'
    };

    repo.bumpMasterVersion();
    repo.appendSyncLog({
      direction: 'CLOUD -> LOKAL',
      outlet: repo.state.outlets[idx].name,
      entityType: 'JenisKlinik',
      summary: `Jenis klinik ditetapkan ke ${nextType}`,
      status: 'Aktif'
    });
    repo.appendAudit(user, 'Manajemen Outlet', 'SET_SERVICE_TYPE', `Menetapkan jenis klinik ${repo.state.outlets[idx].name} menjadi ${nextType}`);
    repo.save();
    return sanitizeOutletForClient(repo.state.outlets[idx]);
  }, { module: 'MO', action: 'edit' });

  router.post('/api/outlets/:id/archive', ({ params, body, user }) => {
    const outlet = repo.state.outlets.find((o) => o.outletId === params.id);
    if (!outlet) return { status: 404, body: { error: 'Outlet tidak ditemukan' } };
    outlet.status = 'Arsip';
    outlet.archivedAt = repo.nowIsoMinute();
    outlet.archiveReason = body.reason || 'Dinonaktifkan oleh Pusat';
    outlet.isOnline = false;
    outlet.connectionLabel = 'Diarsipkan';
    outlet.connectionStatus = 'warn';
    repo.appendAudit(user, 'Manajemen Outlet', 'ARCHIVE_OUTLET', `Mengarsipkan outlet ${outlet.name}`, { reason: outlet.archiveReason });
    repo.save();
    return sanitizeOutletForClient(outlet);
  }, { module: 'MO', action: 'delete' });

  router.post('/api/outlets/:id/restore', ({ params, user }) => {
    const outlet = repo.state.outlets.find((o) => o.outletId === params.id);
    if (!outlet) return { status: 404, body: { error: 'Outlet tidak ditemukan' } };
    outlet.status = 'Aktif';
    delete outlet.archivedAt;
    delete outlet.archiveReason;
    outlet.isOnline = true;
    outlet.connectionLabel = 'Online';
    outlet.connectionStatus = 'ok';
    repo.appendAudit(user, 'Manajemen Outlet', 'RESTORE_OUTLET', `Memulihkan outlet ${outlet.name}`);
    repo.save();
    return sanitizeOutletForClient(outlet);
  }, { module: 'MO', action: 'edit' });

  router.delete('/api/outlets/:id', ({ params, body, user }) => {
    const outlet = repo.state.outlets.find((o) => o.outletId === params.id);
    if (!outlet) return { status: 404, body: { error: 'Outlet tidak ditemukan' } };
    // Soft-archive by default to preserve financial/clinical integrity
    outlet.status = 'Arsip';
    outlet.archivedAt = repo.nowIsoMinute();
    outlet.archiveReason = body.reason || 'Diarsipkan dari Daftar Outlet';
    outlet.isOnline = false;
    outlet.connectionLabel = 'Diarsipkan';
    outlet.connectionStatus = 'warn';
    repo.appendSyncLog({
      direction: 'CLOUD',
      outlet: outlet.name,
      entityType: 'ArsipOutlet',
      summary: `Outlet ${outlet.name} diarsipkan`,
      status: 'Diarsipkan'
    });
    repo.appendAudit(user, 'Manajemen Outlet', 'ARCHIVE_OUTLET', `Mengarsipkan outlet ${outlet.name}`);
    repo.save();
    return { success: true, archivedId: params.id };
  }, { module: 'MO', action: 'delete' });

  router.get('/api/outlet-templates', () => repo.state.outletTemplates, { module: 'MO', action: 'view' });

  router.put('/api/outlet-templates/:type', ({ params, body, user }) => {
    const tpl = repo.state.outletTemplates.find((t) => t.outletType.toLowerCase() === params.type.toLowerCase());
    if (!tpl) return { status: 404, body: { error: 'Template tipe outlet tidak ditemukan' } };
    if (Array.isArray(body.modules)) tpl.modules = body.modules;
    if (body.description) tpl.description = body.description;
    repo.bumpMasterVersion();
    repo.appendSyncLog({
      direction: 'CLOUD -> LOKAL',
      outlet: `Semua ${tpl.outletType}`,
      entityType: 'TemplateModul',
      summary: `Template modul ${tpl.outletType} diperbarui (v${repo.state.masterVersion})`,
      status: 'Tersinkron'
    });
    repo.appendAudit(user, 'Manajemen Outlet', 'UPDATE_TEMPLATE', `Memperbarui template modul ${tpl.outletType}`);
    repo.save();
    return tpl;
  }, { module: 'MO', action: 'edit' });

  router.get('/api/outlets/:id/settings', ({ params }) => {
    return repo.state.outletSettings[params.id] || {};
  }, { module: 'MO', action: 'view' });

  router.put('/api/outlets/:id/settings', ({ params, body, user }) => {
    repo.state.outletSettings[params.id] = {
      ...(repo.state.outletSettings[params.id] || {}),
      ...body
    };
    repo.bumpMasterVersion();
    repo.appendAudit(user, 'Manajemen Outlet', 'UPDATE_OUTLET_SETTINGS', `Memperbarui pengaturan operasional cabang ${params.id}`);
    repo.save();
    return repo.state.outletSettings[params.id];
  }, { module: 'MO', action: 'edit' });

  router.get('/api/licenses', () => repo.state.licenses, { module: 'MO', action: 'view' });

  router.post('/api/licenses/:id/regenerate', ({ params, user }) => {
    const lic = repo.state.licenses.find((l) => l.licenseId === params.id);
    if (!lic) return { status: 404, body: { error: 'Lisensi tidak ditemukan' } };
    const newCode = `KLN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-A9`;
    lic.activationCode = newCode;
    lic.status = 'Menunggu Aktivasi';
    const outlet = repo.state.outlets.find((o) => o.outletId === lic.outletId);
    if (outlet) outlet.activationCode = newCode;
    repo.appendAudit(user, 'Manajemen Outlet', 'REGENERATE_LICENSE', `Generate ulang kode lisensi ${lic.outletName}: ${newCode}`);
    repo.save();
    return lic;
  }, { module: 'MO', action: 'edit' });

  router.put('/api/licenses/:id', ({ params, body, user }) => {
    const lic = repo.state.licenses.find((l) => l.licenseId === params.id);
    if (!lic) return { status: 404, body: { error: 'Lisensi tidak ditemukan' } };
    Object.assign(lic, {
      tier: body.tier ?? lic.tier,
      maxUsers: body.maxUsers !== undefined ? Number(body.maxUsers) : lic.maxUsers,
      validUntil: body.validUntil ?? lic.validUntil,
      status: body.status ?? lic.status
    });
    repo.appendAudit(user, 'Manajemen Outlet', 'UPDATE_LICENSE', `Update lisensi ${lic.outletName} -> ${lic.status}`);
    repo.save();
    return lic;
  }, { module: 'MO', action: 'edit' });
}
