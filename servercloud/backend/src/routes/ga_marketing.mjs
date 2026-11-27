export function registerGaMarketingRoutes(router, repo) {
  // GA: Assets, Maintenances, Permits, Vehicles, Vendors
  router.get('/api/ga/assets', () => repo.state.gaAssets, { module: 'GA', action: 'view' });

  router.post('/api/ga/assets', ({ body, user }) => {
    const costRp = Number(body.costRp || 15000000);
    const asset = {
      code: body.code || `AST-${Date.now().toString().slice(-4)}`,
      name: body.name || 'Peralatan Klinik Baru',
      category: body.category || 'Alat Medis',
      outlet: body.outlet || 'Klinik Utama',
      serialNo: body.serialNo || `SN-${Date.now().toString().slice(-5)}`,
      purchaseDate: body.purchaseDate || repo.todayDate(),
      costRp,
      calibrationDate: body.calibrationDate || '2027-12-01',
      condition: body.condition || 'Baik & Terkalibrasi'
    };
    repo.state.gaAssets.unshift(asset);
    // Auto-sync into Fixed Assets register in Accounting
    repo.state.fixedAssets.unshift({
      code: asset.code,
      name: asset.name,
      outlet: asset.outlet,
      purchaseDate: asset.purchaseDate,
      costRp,
      usefulLifeMonths: 60,
      accumulatedDepRp: 0,
      bookValueRp: costRp,
      monthlyDepRp: Math.round(costRp / 60)
    });
    repo.appendAudit(user, 'GA', 'CREATE_ASSET', `Menambah aset ${asset.code} - ${asset.name}`);
    repo.save();
    return asset;
  }, { module: 'GA', action: 'create' });

  router.get('/api/ga/maintenances', () => repo.state.gaMaintenances, { module: 'GA', action: 'view' });

  router.post('/api/ga/maintenances', ({ body, user }) => {
    const asset = repo.state.gaAssets.find((a) => a.code === body.assetCode);
    const m = {
      id: `MNT-${Date.now().toString().slice(-4)}`,
      assetCode: body.assetCode || asset?.code || 'AST-MED-01',
      assetName: asset?.name || body.assetName || 'Alat Medis',
      outlet: asset?.outlet || body.outlet || 'Klinik Utama',
      type: body.type || 'Kalibrasi BPFK',
      scheduledDate: body.scheduledDate || repo.todayDate(),
      vendor: body.vendor || 'PT Kalibrasi Medika Nusantara',
      costRp: Number(body.costRp || 1500000),
      certificateNo: body.certificateNo || '-',
      status: body.status || 'Terjadwal'
    };
    repo.state.gaMaintenances.unshift(m);
    repo.appendAudit(user, 'GA', 'CREATE_MAINTENANCE', `Menjadwalkan ${m.type} untuk ${m.assetName}`);
    repo.save();
    return m;
  }, { module: 'GA', action: 'create' });

  router.put('/api/ga/maintenances/:id', ({ params, body, user }) => {
    const m = repo.state.gaMaintenances.find((x) => x.id === params.id);
    if (!m) return { status: 404, body: { error: 'Jadwal tidak ditemukan' } };
    m.status = body.status || 'Selesai';
    if (body.certificateNo) m.certificateNo = body.certificateNo;
    const asset = repo.state.gaAssets.find((a) => a.code === m.assetCode);
    if (asset && m.status === 'Selesai') {
      asset.condition = 'Baik & Terkalibrasi';
    }
    repo.appendAudit(user, 'GA', 'COMPLETE_MAINTENANCE', `Pemeliharaan ${m.id} selesai (Cert: ${m.certificateNo})`);
    repo.save();
    return m;
  }, { module: 'GA', action: 'edit' });

  router.get('/api/ga/permits', () => repo.state.outletPermits, { module: 'GA', action: 'view' });

  router.post('/api/ga/permits', ({ body, user }) => {
    const p = {
      id: `PRM-${Date.now().toString().slice(-4)}`,
      outlet: body.outlet || 'Klinik Utama',
      permitName: body.permitName || 'Izin Operasional',
      permitNo: body.permitNo || '-',
      issuer: body.issuer || 'OSS-RBA / Dinkes',
      expiryDate: body.expiryDate || '2028-12-31',
      status: body.status || 'Aktif'
    };
    repo.state.outletPermits.unshift(p);
    repo.appendAudit(user, 'GA', 'CREATE_PERMIT', `Menambahkan dokumen izin ${p.permitName} (${p.outlet})`);
    repo.save();
    return p;
  }, { module: 'GA', action: 'create' });

  router.get('/api/ga/vehicles', () => repo.state.vehicles, { module: 'GA', action: 'view' });

  router.post('/api/ga/vehicles', ({ body, user }) => {
    const v = {
      id: `VEH-${Date.now().toString().slice(-3)}`,
      plateNo: body.plateNo || 'B 9900 KLP',
      model: body.model || 'Ambulans Operasional',
      outlet: body.outlet || 'Klinik Utama',
      stnkExpiry: body.stnkExpiry || '2027-12-31',
      kirExpiry: body.kirExpiry || '2027-06-30',
      odometerKm: Number(body.odometerKm || 0),
      lastService: repo.todayDate(),
      status: 'Siap Operasional'
    };
    repo.state.vehicles.unshift(v);
    repo.appendAudit(user, 'GA', 'CREATE_VEHICLE', `Menambah armada ${v.plateNo} (${v.model})`);
    repo.save();
    return v;
  }, { module: 'GA', action: 'create' });

  router.get('/api/ga/vendors', () => repo.state.serviceVendors, { module: 'GA', action: 'view' });

  router.post('/api/ga/vendors', ({ body, user }) => {
    const v = {
      id: `VND-${Date.now().toString().slice(-3)}`,
      name: body.name || 'Vendor Jasa Baru',
      serviceType: body.serviceType || 'Maintenance Fasilitas',
      pic: body.pic || '-',
      phone: body.phone || '-',
      contractEnd: body.contractEnd || '2027-12-31',
      sla: body.sla || 'Respon <= 24 Jam',
      status: 'Aktif'
    };
    repo.state.serviceVendors.unshift(v);
    repo.appendAudit(user, 'GA', 'CREATE_GA_VENDOR', `Menambah vendor jasa ${v.name}`);
    repo.save();
    return v;
  }, { module: 'GA', action: 'create' });

  // Marketing: Consolidated Patients, Promos, Loyalty, Broadcasts, Surveys
  router.get('/api/marketing/patients', () => repo.state.consolidatedPatients, { module: 'MK', action: 'view' });

  router.get('/api/marketing/promos', () => repo.state.promosPackages, { module: 'MK', action: 'view' });

  router.post('/api/marketing/promos', ({ body, user }) => {
    const promo = {
      id: `PRM-PKG-${Date.now().toString().slice(-4)}`,
      code: String(body.code || `PROMO${Date.now().toString().slice(-3)}`).toUpperCase(),
      name: body.name || 'Promo Layanan Kesehatan',
      type: body.type || 'Voucher Promo',
      discountType: body.discountType || 'Persen',
      discountValue: Number(body.discountValue || 10),
      finalPriceRp: Number(body.finalPriceRp || 0),
      outlets: Array.isArray(body.outlets) && body.outlets.length > 0 ? body.outlets : ['Klinik Utama', 'Klinik Pratama', 'Apotek'],
      validUntil: body.validUntil || '2026-12-31',
      quotaUsed: 0,
      quotaMax: Number(body.quotaMax || 100),
      status: 'Aktif'
    };
    repo.state.promosPackages.unshift(promo);
    repo.bumpMasterVersion();
    repo.appendAudit(user, 'Marketing', 'CREATE_PROMO', `Membuat promo ${promo.code} - ${promo.name}`);
    repo.save();
    return promo;
  }, { module: 'MK', action: 'create' });

  router.get('/api/marketing/loyalty', () => ({
    rules: repo.state.loyaltyRules,
    accounts: repo.state.loyaltyAccounts
  }), { module: 'MK', action: 'view' });

  router.put('/api/marketing/loyalty/rules', ({ body, user }) => {
    Object.assign(repo.state.loyaltyRules, body);
    repo.appendAudit(user, 'Marketing', 'UPDATE_LOYALTY_RULES', 'Memperbarui aturan poin loyalitas pasien');
    repo.save();
    return repo.state.loyaltyRules;
  }, { module: 'MK', action: 'edit' });

  router.post('/api/marketing/loyalty/adjust', ({ body, user }) => {
    const acc = repo.state.loyaltyAccounts.find((a) => a.id === body.id);
    if (!acc) return { status: 404, body: { error: 'Member tidak ditemukan' } };
    acc.points = Math.max(0, Number(acc.points) + Number(body.deltaPoints || 0));
    acc.lastActivity = repo.todayDate();
    if (acc.points >= repo.state.loyaltyRules.platinumMin) acc.tier = 'Platinum';
    else if (acc.points >= repo.state.loyaltyRules.goldMin) acc.tier = 'Gold';
    else acc.tier = 'Silver';
    repo.appendAudit(user, 'Marketing', 'ADJUST_LOYALTY', `Menyesuaikan poin ${acc.patientName} (${body.deltaPoints})`);
    repo.save();
    return acc;
  }, { module: 'MK', action: 'edit' });

  router.get('/api/marketing/broadcasts', () => repo.state.broadcastCampaigns, { module: 'MK', action: 'view' });

  router.post('/api/marketing/broadcasts', ({ body, user }) => {
    const count = Number(body.targetCount || repo.state.consolidatedPatients.length * 42);
    const camp = {
      id: `BRD-${Date.now().toString().slice(-4)}`,
      title: body.title || 'Kampanye Informasi Pasien',
      channel: body.channel || 'WhatsApp',
      segment: body.segment || 'Semua Pasien Aktif',
      targetCount: count,
      sentCount: count,
      readRate: '86%',
      scheduledAt: repo.nowIsoMinute(),
      template: body.template || 'Halo {nama}, dapatkan info layanan terbaru di {outlet}.',
      status: 'Terkirim'
    };
    repo.state.broadcastCampaigns.unshift(camp);
    repo.appendAudit(user, 'Marketing', 'SEND_BROADCAST', `Mengirim broadcast ${camp.channel}: ${camp.title}`);
    repo.save();
    return camp;
  }, { module: 'MK', action: 'create' });

  router.get('/api/marketing/surveys', () => repo.state.satisfactionSurveys, { module: 'MK', action: 'view' });

  router.put('/api/marketing/surveys/:id', ({ params, body, user }) => {
    const srv = repo.state.satisfactionSurveys.find((s) => s.id === params.id);
    if (!srv) return { status: 404, body: { error: 'Survei tidak ditemukan' } };
    srv.followUpStatus = body.followUpStatus || 'Selesai';
    repo.appendAudit(user, 'Marketing', 'FOLLOWUP_SURVEY', `Menindaklanjuti ulasan pasien ${srv.patientName}`);
    repo.save();
    return srv;
  }, { module: 'MK', action: 'edit' });
}
