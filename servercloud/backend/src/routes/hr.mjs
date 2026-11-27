import { hashPassword, sanitizeUserForClient } from '../core/security.mjs';

export function registerHrRoutes(router, repo) {
  // Users (also supports edge branch creation when unauthenticated with restricted safe roles)
  router.get('/api/users', () => repo.state.users.map(sanitizeUserForClient), { module: 'HR', action: 'view' });

  router.post('/api/users', ({ body, user }) => {
    const targetOutlet = body.outlet || 'Klinik Utama';
    const allowedRolesForEdge = ['Dokter', 'Perawat', 'Apoteker', 'Kasir', 'Pendaftaran', 'Admin Outlet'];
    let requestedRole = body.role || 'Dokter';
    if (!user && !allowedRolesForEdge.includes(requestedRole)) {
      requestedRole = 'Pendaftaran';
    }

    const outletObj = repo.state.outlets.find((o) => o.name.toLowerCase() === targetOutlet.toLowerCase());
    const isOnline = outletObj ? outletObj.isOnline : true;
    const allowedOutlets = Array.isArray(body.allowedOutlets) && body.allowedOutlets.length > 0
      ? body.allowedOutlets
      : body.multiOutlet === 'Ya'
      ? repo.state.outlets.filter((o) => o.status !== 'Arsip').map((o) => o.name)
      : [targetOutlet];

    const newUser = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      employeeId: body.employeeId || null,
      name: body.name || 'Dewi Anggraini',
      role: requestedRole,
      outlet: targetOutlet,
      allowedOutlets,
      status: 'Aktif',
      syncStatus: isOnline ? 'Tersinkron' : 'Menunggu (offline)',
      email: body.email || `user.${Date.now().toString().slice(-4)}@klinik.id`,
      passwordHash: hashPassword(body.password || '123456'),
      nik: body.nik || '3275010101900001',
      strSip: body.strSip || '-',
      strExpiry: body.strExpiry || '2029-12-31',
      ihsId: requestedRole === 'Dokter' || requestedRole === 'Apoteker' ? `IHS-PRAC-${Math.floor(10000 + Math.random() * 89999)}` : '-',
      twoFaEnabled: false
    };

    repo.state.users.push(newUser);
    repo.bumpMasterVersion();
    repo.appendSyncLog({
      direction: 'CLOUD -> LOKAL',
      outlet: targetOutlet,
      entityType: 'UserOutlet',
      summary: `User ${newUser.name} (${newUser.role})`,
      status: isOnline ? 'Tersinkron' : 'Menunggu (Offline)'
    });
    repo.appendAudit(user || { email: 'edge-branch', role: 'LocalServer' }, 'HR', 'CREATE_USER', `Membuat user ${newUser.name} (${newUser.role})`);
    repo.save();
    return sanitizeUserForClient(newUser);
  }, { public: true });

  router.put('/api/users/:id', ({ params, body, user }) => {
    const idx = repo.state.users.findIndex((u) => u.id === params.id);
    if (idx === -1) return { status: 404, body: { error: 'User tidak ditemukan' } };

    const prev = repo.state.users[idx];
    const targetOutlet = body.outlet || prev.outlet;
    const outletObj = repo.state.outlets.find((o) => o.name.toLowerCase() === targetOutlet.toLowerCase());
    const isOnline = outletObj ? outletObj.isOnline : true;

    const allowedOutlets = Array.isArray(body.allowedOutlets)
      ? body.allowedOutlets
      : body.multiOutlet === 'Ya'
      ? repo.state.outlets.filter((o) => o.status !== 'Arsip').map((o) => o.name)
      : body.outlet
      ? [targetOutlet]
      : prev.allowedOutlets;

    repo.state.users[idx] = {
      ...prev,
      name: body.name ?? prev.name,
      role: body.role ?? prev.role,
      outlet: targetOutlet,
      allowedOutlets,
      status: body.status ?? prev.status,
      email: body.email ?? prev.email,
      nik: body.nik ?? prev.nik,
      strSip: body.strSip ?? prev.strSip,
      syncStatus: isOnline ? 'Tersinkron' : 'Menunggu (offline)'
    };

    repo.bumpMasterVersion();
    repo.appendSyncLog({
      direction: 'CLOUD -> LOKAL',
      outlet: targetOutlet,
      entityType: 'UpdateUser',
      summary: `Update User ${repo.state.users[idx].name} (${repo.state.users[idx].status})`,
      status: isOnline ? 'Tersinkron' : 'Menunggu (Offline)'
    });
    repo.appendAudit(user, 'HR', 'UPDATE_USER', `Mengubah user ${repo.state.users[idx].name}`);
    repo.save();
    return sanitizeUserForClient(repo.state.users[idx]);
  }, { module: 'HR', action: 'edit' });

  router.post('/api/users/:id/reset-password', ({ params, body, user }) => {
    const target = repo.state.users.find((u) => u.id === params.id);
    if (!target) return { status: 404, body: { error: 'User tidak ditemukan' } };
    const nextPass = String(body.newPassword || '123456');
    target.passwordHash = hashPassword(nextPass);
    repo.appendAudit(user, 'HR', 'RESET_PASSWORD', `Reset password untuk akun ${target.email}`);
    repo.save();
    return { success: true, message: `Password ${target.name} berhasil direset` };
  }, { module: 'HR', action: 'edit' });

  router.delete('/api/users/:id', ({ params, user }) => {
    const idx = repo.state.users.findIndex((u) => u.id === params.id);
    if (idx === -1) return { status: 404, body: { error: 'User tidak ditemukan' } };
    if (repo.state.users[idx].email === 'owner@klinik.id') {
      return { status: 400, body: { error: 'Akun Owner utama tidak dapat dihapus' } };
    }
    const removed = repo.state.users.splice(idx, 1)[0];
    repo.bumpMasterVersion();
    repo.appendSyncLog({
      direction: 'CLOUD -> LOKAL',
      outlet: removed.outlet,
      entityType: 'HapusUser',
      summary: `Hapus User ${removed.name}`,
      status: 'Tersinkron'
    });
    repo.appendAudit(user, 'HR', 'DELETE_USER', `Menghapus user ${removed.name}`);
    repo.save();
    return { success: true, deletedId: params.id };
  }, { module: 'HR', action: 'delete' });

  // Employees
  router.get('/api/hr/employees', () => repo.state.employees, { module: 'HR', action: 'view' });

  router.post('/api/hr/employees', ({ body, user }) => {
    const emp = {
      id: `EMP-${Date.now().toString().slice(-4)}`,
      nip: body.nip || `2026${Math.floor(1000 + Math.random() * 8999)}`,
      name: body.name || 'Pegawai Baru',
      nik: body.nik || '',
      department: body.department || 'Medis & Poliklinik',
      position: body.position || 'Staf Operasional',
      employmentStatus: body.employmentStatus || 'Tetap',
      outlet: body.outlet || 'Klinik Utama',
      joinDate: body.joinDate || repo.todayDate(),
      phone: body.phone || '',
      bankAccount: body.bankAccount || '',
      baseSalary: Number(body.baseSalary || 4500000),
      status: 'Aktif'
    };
    repo.state.employees.unshift(emp);
    repo.appendAudit(user, 'HR', 'CREATE_EMPLOYEE', `Menambahkan data karyawan ${emp.name} (${emp.nip})`);
    repo.save();
    return emp;
  }, { module: 'HR', action: 'create' });

  router.put('/api/hr/employees/:id', ({ params, body, user }) => {
    const emp = repo.state.employees.find((e) => e.id === params.id);
    if (!emp) return { status: 404, body: { error: 'Karyawan tidak ditemukan' } };
    Object.assign(emp, {
      name: body.name ?? emp.name,
      nik: body.nik ?? emp.nik,
      department: body.department ?? emp.department,
      position: body.position ?? emp.position,
      employmentStatus: body.employmentStatus ?? emp.employmentStatus,
      outlet: body.outlet ?? emp.outlet,
      phone: body.phone ?? emp.phone,
      bankAccount: body.bankAccount ?? emp.bankAccount,
      baseSalary: body.baseSalary !== undefined ? Number(body.baseSalary) : emp.baseSalary,
      status: body.status ?? emp.status
    });
    repo.appendAudit(user, 'HR', 'UPDATE_EMPLOYEE', `Memperbarui data karyawan ${emp.name}`);
    repo.save();
    return emp;
  }, { module: 'HR', action: 'edit' });

  // Roles & Permissions
  router.get('/api/hr/roles', () => repo.state.rolePermissions, { module: 'HR', action: 'view' });

  router.put('/api/hr/roles/:role', ({ params, body, user }) => {
    const target = repo.state.rolePermissions.find((r) => r.role.toLowerCase() === params.role.toLowerCase());
    if (!target) return { status: 404, body: { error: 'Role tidak ditemukan' } };
    if (body.matrix) target.matrix = body.matrix;
    if (body.modules) target.modules = body.modules;
    if (body.scope) target.scope = body.scope;
    repo.bumpMasterVersion();
    repo.appendSyncLog({
      direction: 'CLOUD -> LOKAL',
      outlet: 'Semua Outlet',
      entityType: 'RolePermission',
      summary: `Update hak akses RBAC role ${target.role}`,
      status: 'Tersinkron'
    });
    repo.appendAudit(user, 'HR', 'UPDATE_RBAC', `Mengubah matriks izin role ${target.role}`);
    repo.save();
    return target;
  }, { module: 'HR', action: 'edit' });

  // Schedules, Attendance, Leaves
  router.get('/api/hr/schedules', () => ({
    schedules: repo.state.schedules,
    attendance: repo.state.attendanceLogs,
    leaves: repo.state.leaveRequests
  }), { module: 'HR', action: 'view' });

  router.post('/api/hr/schedules', ({ body, user }) => {
    const item = {
      id: `SCH-${Date.now().toString().slice(-4)}`,
      staffName: body.staffName || 'Dr. Andi Wijaya',
      role: body.role || 'Dokter',
      outlet: body.outlet || 'Klinik Utama',
      poli: body.poli || 'Poli Umum',
      day: body.day || 'Senin - Jumat',
      shift: body.shift || '08:00 - 14:00',
      quota: Number(body.quota || 30),
      status: 'Aktif'
    };
    repo.state.schedules.unshift(item);
    repo.bumpMasterVersion();
    repo.appendAudit(user, 'HR', 'CREATE_SCHEDULE', `Menambahkan jadwal ${item.staffName} (${item.outlet})`);
    repo.save();
    return item;
  }, { module: 'HR', action: 'create' });

  router.put('/api/hr/leaves/:id', ({ params, body, user }) => {
    const lv = repo.state.leaveRequests.find((l) => l.id === params.id);
    if (!lv) return { status: 404, body: { error: 'Pengajuan cuti tidak ditemukan' } };
    lv.status = body.status || 'Disetujui';
    repo.appendAudit(user, 'HR', 'APPROVE_LEAVE', `Status cuti ${lv.staffName} diubah menjadi ${lv.status}`);
    repo.save();
    return lv;
  }, { module: 'HR', action: 'approve' });

  // Medical Credentials (STR/SIP/IHS)
  router.get('/api/hr/credentials', () => repo.state.medicalCredentials, { module: 'HR', action: 'view' });

  router.post('/api/hr/credentials', ({ body, user }) => {
    const cred = {
      id: `CRD-${Date.now().toString().slice(-4)}`,
      staffName: body.staffName || 'Tenaga Medis Baru',
      profession: body.profession || 'Dokter Umum',
      outlet: body.outlet || 'Klinik Utama',
      strNo: body.strNo || '',
      sipNo: body.sipNo || '',
      expiryDate: body.expiryDate || '2029-12-31',
      ihsId: body.ihsId || `IHS-PRAC-${Math.floor(10000 + Math.random() * 89999)}`,
      skpPoints: Number(body.skpPoints || 30),
      status: body.status || 'Aktif'
    };
    repo.state.medicalCredentials.unshift(cred);
    repo.appendAudit(user, 'HR', 'CREATE_CREDENTIAL', `Menambahkan STR/SIP ${cred.staffName}`);
    repo.save();
    return cred;
  }, { module: 'HR', action: 'create' });

  router.put('/api/hr/credentials/:id', ({ params, body, user }) => {
    const cred = repo.state.medicalCredentials.find((c) => c.id === params.id);
    if (!cred) return { status: 404, body: { error: 'Data STR/SIP tidak ditemukan' } };
    Object.assign(cred, {
      strNo: body.strNo ?? cred.strNo,
      sipNo: body.sipNo ?? cred.sipNo,
      expiryDate: body.expiryDate ?? cred.expiryDate,
      ihsId: body.ihsId ?? cred.ihsId,
      skpPoints: body.skpPoints !== undefined ? Number(body.skpPoints) : cred.skpPoints,
      status: body.status ?? cred.status
    });
    repo.appendAudit(user, 'HR', 'UPDATE_CREDENTIAL', `Memperbarui STR/SIP ${cred.staffName}`);
    repo.save();
    return cred;
  }, { module: 'HR', action: 'edit' });

  // Payroll & Doctor Fees
  router.get('/api/hr/payroll', () => ({
    doctorFees: repo.state.doctorFees,
    feeRules: repo.state.doctorFeeRules,
    payrolls: repo.state.payrolls
  }), { module: 'HR', action: 'view' });

  router.put('/api/hr/fee-rules/:id', ({ params, body, user }) => {
    const rule = repo.state.doctorFeeRules.find((r) => r.id === params.id);
    if (!rule) return { status: 404, body: { error: 'Aturan jasa medis tidak ditemukan' } };
    Object.assign(rule, {
      sharePercent: body.sharePercent !== undefined ? Number(body.sharePercent) : rule.sharePercent,
      fixedPerVisit: body.fixedPerVisit !== undefined ? Number(body.fixedPerVisit) : rule.fixedPerVisit,
      visiteRate: body.visiteRate !== undefined ? Number(body.visiteRate) : rule.visiteRate
    });
    repo.appendAudit(user, 'HR', 'UPDATE_FEE_RULE', `Mengubah skema jasa medis ${rule.serviceCategory}`);
    repo.save();
    return rule;
  }, { module: 'HR', action: 'edit' });

  router.post('/api/hr/payroll/finalize', ({ body, user }) => {
    const period = body.period || '2026-11';
    const pending = repo.state.payrolls.filter((p) => p.period === period && p.status !== 'Dibayar / Diposting');
    if (pending.length === 0) {
      return { status: 400, body: { message: `Seluruh slip gaji periode ${period} sudah difinalisasi` } };
    }
    const totalGross = pending.reduce((s, p) => s + Number(p.baseSalary) + Number(p.medicalFee) + Number(p.allowance), 0);
    const totalTax = pending.reduce((s, p) => s + Number(p.taxPph21), 0);
    const totalNet = pending.reduce((s, p) => s + Number(p.netPay), 0);

    for (const p of pending) {
      p.status = 'Dibayar / Diposting';
    }

    const journal = repo.postJournal({
      outlet: 'Pusat (Cloud VPS)',
      source: 'Payroll & Jasa Medis',
      description: `Finalisasi Payroll & Jasa Medis Periode ${period} (${pending.length} SDM)`,
      codePrefix: 'JRN-PAY',
      lines: [
        { accountCode: '5101', accountName: 'Beban HPP Obat & Jasa Medis Dokter', debit: totalGross, credit: 0 },
        { accountCode: '2201', accountName: 'Hutang Pajak (PPN / PPh 21 / PPh 23)', debit: 0, credit: totalTax },
        { accountCode: '1101', accountName: 'Kas & Bank Operasional Cabang', debit: 0, credit: totalNet }
      ]
    });

    const hqAcc = repo.state.cashBankAccounts.find((a) => a.id === 'ACC-HQ-BCA');
    if (hqAcc) hqAcc.balanceRp = Math.max(0, hqAcc.balanceRp - totalNet);

    repo.appendAudit(user, 'HR', 'FINALIZE_PAYROLL', `Finalisasi payroll ${period} senilai ${repo.formatRp(totalGross)}`);
    repo.save();
    return { success: true, finalizedCount: pending.length, totalGross, journal };
  }, { module: 'HR', action: 'approve' });

  // Recruitment & Performance
  router.get('/api/hr/recruitment', () => ({
    requisitions: repo.state.jobRequisitions,
    applicants: repo.state.applicants,
    performance: repo.state.performanceReviews
  }), { module: 'HR', action: 'view' });

  router.post('/api/hr/recruitment/requisitions', ({ body, user }) => {
    const req = {
      id: `JOB-${Date.now().toString().slice(-3)}`,
      title: body.title || 'Posisi Baru',
      outlet: body.outlet || 'Klinik Utama',
      headcount: Number(body.headcount || 1),
      urgency: body.urgency || 'Sedang',
      applicantsCount: 0,
      status: 'Terbuka'
    };
    repo.state.jobRequisitions.unshift(req);
    repo.appendAudit(user, 'HR', 'CREATE_JOB_REQ', `Membuka lowongan ${req.title} di ${req.outlet}`);
    repo.save();
    return req;
  }, { module: 'HR', action: 'create' });

  router.put('/api/hr/recruitment/applicants/:id', ({ params, body, user }) => {
    const apl = repo.state.applicants.find((a) => a.id === params.id);
    if (!apl) return { status: 404, body: { error: 'Pelamar tidak ditemukan' } };
    apl.stage = body.stage || apl.stage;
    if (apl.stage === 'Diterima' && !repo.state.employees.some((e) => e.name === apl.name)) {
      repo.state.employees.unshift({
        id: `EMP-${Date.now().toString().slice(-4)}`,
        nip: `2026${Math.floor(1000 + Math.random() * 8999)}`,
        name: apl.name,
        nik: '',
        department: 'Operasional Klinik',
        position: 'Karyawan Baru (Rekrutmen)',
        employmentStatus: 'Kontrak',
        outlet: apl.outlet,
        joinDate: repo.todayDate(),
        phone: apl.phone,
        bankAccount: '-',
        baseSalary: 4500000,
        status: 'Aktif'
      });
    }
    repo.appendAudit(user, 'HR', 'UPDATE_APPLICANT', `Tahap pelamar ${apl.name} -> ${apl.stage}`);
    repo.save();
    return apl;
  }, { module: 'HR', action: 'edit' });

  router.post('/api/hr/performance', ({ body, user }) => {
    const rev = {
      id: `KPI-${Date.now().toString().slice(-3)}`,
      period: body.period || 'Q4 2026',
      staffName: body.staffName || 'Rina Putri',
      outlet: body.outlet || 'Klinik Pratama',
      kpiScore: Number(body.kpiScore || 85),
      attendanceScore: Number(body.attendanceScore || 90),
      patientFeedback: Number(body.patientFeedback || 4.7),
      status: 'Selesai'
    };
    repo.state.performanceReviews.unshift(rev);
    repo.appendAudit(user, 'HR', 'CREATE_KPI', `Input penilaian KPI ${rev.staffName} (${rev.kpiScore})`);
    repo.save();
    return rev;
  }, { module: 'HR', action: 'create' });
}
