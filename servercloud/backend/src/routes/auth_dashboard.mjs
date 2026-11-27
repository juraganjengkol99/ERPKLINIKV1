import {
  verifyPassword,
  signJwt,
  generateTotpSecret,
  verifyTotpCode,
  computeTotpCode,
  sanitizeOutletForClient,
  sanitizeUserForClient,
  mapUserRoleToCloudRole
} from '../core/security.mjs';
import { CLOUD_MENU } from '../store/seed.mjs';

export function registerAuthDashboardRoutes(router, repo) {
  router.get('/api/cloud-info', () => {
    const active = repo.state.outlets.filter((o) => o.status !== 'Arsip');
    const online = active.filter((o) => o.isOnline).length;
    return {
      brand: 'Klinik Group',
      subtitle: 'Server pusat (VPS)',
      mode: 'cloud',
      connectionText: `${online}/${active.length} outlet online`,
      connectionStatus: online === active.length ? 'ok' : 'warn'
    };
  }, { public: true });

  router.get('/api/menu', () => CLOUD_MENU, { public: true });

  router.post('/api/auth/login', ({ body, req }) => {
    const emailInput = String(body.email || '').trim().toLowerCase();
    const passwordInput = String(body.password || '');
    const otpInput = String(body.otp || '').trim();

    const user = repo.state.users.find(
      (u) => (u.email || '').toLowerCase() === emailInput || u.name.toLowerCase() === emailInput
    );
    if (!user) {
      return { status: 401, body: { success: false, message: 'Email atau username tidak ditemukan di database' } };
    }
    if (user.status === 'Nonaktif') {
      return { status: 403, body: { success: false, message: 'Akun ini berstatus Nonaktif. Hubungi Admin Pusat.' } };
    }
    if (!verifyPassword(passwordInput, user.passwordHash)) {
      repo.appendAudit({ email: emailInput, role: user.role }, 'Auth', 'LOGIN_FAILED', `Percobaan login gagal untuk ${emailInput}`);
      repo.save(false);
      return { status: 401, body: { success: false, message: 'Password salah (default demo: 123456)' } };
    }

    if (user.twoFaEnabled && user.twoFaSecret) {
      if (!otpInput) {
        return {
          status: 200,
          body: {
            success: false,
            requires2fa: true,
            message: 'Masukkan kode OTP 6 digit dari Authenticator Anda'
          }
        };
      }
      if (!verifyTotpCode(user.twoFaSecret, otpInput)) {
        return { status: 401, body: { success: false, requires2fa: true, message: 'Kode OTP 2FA tidak valid' } };
      }
    }

    const sessionId = `SES-${Date.now().toString().slice(-6)}`;
    const cloudRole = mapUserRoleToCloudRole(user.role);
    const token = signJwt({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      cloudRole,
      sessionId
    });

    repo.state.activeSessions.unshift({
      sessionId,
      userEmail: user.email,
      userName: user.name,
      role: cloudRole,
      device: String(req.headers['user-agent'] || 'Web Browser').slice(0, 48),
      ip: req.socket?.remoteAddress || '127.0.0.1',
      loginAt: repo.nowIsoMinute()
    });
    if (repo.state.activeSessions.length > 30) {
      repo.state.activeSessions = repo.state.activeSessions.slice(0, 30);
    }

    repo.appendAudit({ email: user.email, role: cloudRole }, 'Auth', 'LOGIN_SUCCESS', `Login berhasil ke Cloud VPS (${cloudRole})`);
    repo.save(false);

    return {
      success: true,
      token,
      user: sanitizeUserForClient(user)
    };
  }, { public: true });

  router.get('/api/auth/me', ({ user }) => sanitizeUserForClient(user), { module: 'DB', action: 'view' });

  router.post('/api/auth/2fa/setup', ({ user }) => {
    const dbUser = repo.state.users.find((u) => u.id === user.id);
    if (!dbUser) return { status: 404, body: { message: 'User tidak ditemukan' } };
    const secret = dbUser.twoFaPendingSecret || generateTotpSecret();
    dbUser.twoFaPendingSecret = secret;
    repo.save(false);
    return {
      secret,
      otpauthUri: `otpauth://totp/ERPKlinikCloud:${encodeURIComponent(dbUser.email)}?secret=${secret}&issuer=ERPKlinikCloud`,
      currentDemoCode: computeTotpCode(secret, 0)
    };
  }, { module: 'PS', action: 'view' });

  router.post('/api/auth/2fa/verify', ({ user, body }) => {
    const dbUser = repo.state.users.find((u) => u.id === user.id);
    if (!dbUser || !dbUser.twoFaPendingSecret) {
      return { status: 400, body: { message: 'Setup 2FA belum dimulai' } };
    }
    if (!verifyTotpCode(dbUser.twoFaPendingSecret, body.code)) {
      return { status: 400, body: { message: 'Kode OTP 6 digit tidak cocok' } };
    }
    dbUser.twoFaSecret = dbUser.twoFaPendingSecret;
    delete dbUser.twoFaPendingSecret;
    dbUser.twoFaEnabled = true;
    repo.appendAudit(user, 'Keamanan', 'ENABLE_2FA', `Mengaktifkan 2FA TOTP untuk ${dbUser.email}`);
    repo.save();
    return { success: true, twoFaEnabled: true };
  }, { module: 'PS', action: 'view' });

  router.post('/api/auth/2fa/disable', ({ user }) => {
    const dbUser = repo.state.users.find((u) => u.id === user.id);
    if (!dbUser) return { status: 404, body: { message: 'User tidak ditemukan' } };
    dbUser.twoFaEnabled = false;
    delete dbUser.twoFaSecret;
    delete dbUser.twoFaPendingSecret;
    repo.appendAudit(user, 'Keamanan', 'DISABLE_2FA', `Menonaktifkan 2FA TOTP untuk ${dbUser.email}`);
    repo.save();
    return { success: true, twoFaEnabled: false };
  }, { module: 'PS', action: 'view' });

  router.get('/api/auth/sessions', () => repo.state.activeSessions, { module: 'PS', action: 'view' });

  router.delete('/api/auth/sessions/:sessionId', ({ params, user }) => {
    repo.state.activeSessions = repo.state.activeSessions.filter((s) => s.sessionId !== params.sessionId);
    repo.appendAudit(user, 'Keamanan', 'REVOKE_SESSION', `Mencabut sesi ${params.sessionId}`);
    repo.save(false);
    return { success: true };
  }, { module: 'PS', action: 'edit' });

  router.get('/api/dashboard', () => {
    const activeOutlets = repo.state.outlets.filter((o) => o.status !== 'Arsip');
    const onlineCount = activeOutlets.filter((o) => o.isOnline).length;
    const totalVisits = activeOutlets.reduce((acc, o) => acc + (o.todayVisits || 0), 0);
    const totalRev = activeOutlets.reduce((acc, o) => acc + Number(o.todayRevenueMillions || 0), 0);
    const pendingSync = activeOutlets.reduce((acc, o) => acc + (o.pendingSyncCount || 0), 0);

    return {
      stats: [
        { label: 'Outlet online', value: `${onlineCount} dari ${activeOutlets.length}` },
        { label: 'Kunjungan hari ini', value: String(totalVisits) },
        { label: 'Pendapatan hari ini', value: `Rp ${totalRev.toFixed(1).replace('.', ',')} jt` },
        { label: 'Data menunggu sinkron', value: String(pendingSync) }
      ],
      outlets: activeOutlets.map(sanitizeOutletForClient),
      recentSyncLogs: repo.state.syncLogs.slice(0, 40),
      inventoryItems: repo.state.inventoryItems,
      stockRequests: repo.state.stockRequests,
      journalEntries: repo.state.journalEntries,
      doctorFees: repo.state.doctorFees,
      bpjsClaims: repo.state.bpjsClaims,
      unreadNotifications: repo.state.notifications.filter((n) => !n.isRead).length
    };
  }, { module: 'DB', action: 'view' });

  router.get('/api/dashboard/summary', () => {
    const activeOutlets = repo.state.outlets.filter((o) => o.status !== 'Arsip');
    const pendingRequests = repo.state.stockRequests.filter((r) => r.status !== 'Dikirim ke Cabang').length;
    const pendingPos = repo.state.purchaseOrders.filter((p) => p.status === 'Menunggu Approval').length;
    const expiredCreds = repo.state.medicalCredentials.filter((c) => c.status !== 'Aktif').length;
    const failedFhir = repo.state.fhirLogs.filter((f) => f.status !== 'Terkirim').length;

    return {
      outlets: activeOutlets.map(sanitizeOutletForClient),
      syncLogs: repo.state.syncLogs.slice(0, 15),
      actionItems: [
        { label: 'Permintaan Stok Cabang', count: pendingRequests, route: '/inventory/mutasi-antar-outlet', severity: pendingRequests > 0 ? 'warn' : 'ok' },
        { label: 'Approval Purchase Order', count: pendingPos, route: '/purchasing/purchase-order', severity: pendingPos > 0 ? 'warn' : 'ok' },
        { label: 'STR/SIP Nakes Perlu Perhatian', count: expiredCreds, route: '/hr/str-sip-kompetensi', severity: expiredCreds > 0 ? 'bad' : 'ok' },
        { label: 'Payload FHIR SATUSEHAT Gagal', count: failedFhir, route: '/integrasi/satusehat-monitoring-fhir', severity: failedFhir > 0 ? 'bad' : 'ok' }
      ],
      unreadNotifications: repo.state.notifications.filter((n) => !n.isRead).length
    };
  }, { module: 'DB', action: 'view' });

  router.get('/api/dashboard/performance', ({ query }) => {
    const range = query.get('range') || 'today';
    const multiplier = range === '7d' ? 6.8 : range === '30d' ? 28.5 : 1;
    const activeOutlets = repo.state.outlets.filter((o) => o.status !== 'Arsip');
    const rows = activeOutlets.map((o) => {
      const visits = Math.round((o.todayVisits || 0) * multiplier);
      const revenueMillions = Number(((o.todayRevenueMillions || 0) * multiplier).toFixed(2));
      const avgTicketRp = visits > 0 ? Math.round((revenueMillions * 1_000_000) / visits) : 0;
      return {
        outletId: o.outletId,
        name: o.name,
        type: o.type,
        visits,
        revenueMillions,
        avgTicketRp,
        operationalRate: o.type === 'Klinik Utama' ? '78% BOR' : o.type === 'Apotek' ? '96% Resep Terpenuhi' : '92% Antrol Tepat Waktu',
        isOnline: o.isOnline
      };
    });
    return { range, rows };
  }, { module: 'DB', action: 'view' });

  router.get('/api/notifications', () => repo.state.notifications, { module: 'DB', action: 'view' });

  router.put('/api/notifications/:id/read', ({ params }) => {
    const n = repo.state.notifications.find((item) => item.id === params.id);
    if (n) n.isRead = true;
    repo.save(false);
    return { success: true, notification: n };
  }, { module: 'DB', action: 'view' });

  router.post('/api/notifications/read-all', () => {
    repo.state.notifications.forEach((n) => (n.isRead = true));
    repo.save(false);
    return { success: true };
  }, { module: 'DB', action: 'view' });
}
