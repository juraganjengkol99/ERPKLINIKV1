export function registerFinanceAccountingRoutes(router, repo) {
  // Keuangan: Kas & Bank
  router.get('/api/finance/accounts', () => ({
    accounts: repo.state.cashBankAccounts,
    transactions: repo.state.cashTransactions
  }), { module: 'KE', action: 'view' });

  router.post('/api/finance/accounts', ({ body, user }) => {
    const acc = {
      id: `ACC-${Date.now().toString().slice(-4)}`,
      name: body.name || 'Rekening Operasional Baru',
      type: body.type || 'Bank',
      outlet: body.outlet || 'Pusat (Cloud VPS)',
      accountNo: body.accountNo || '-',
      balanceRp: Number(body.balanceRp || 0)
    };
    repo.state.cashBankAccounts.push(acc);
    repo.appendAudit(user, 'Keuangan', 'CREATE_ACCOUNT', `Menambah rekening ${acc.name}`);
    repo.save();
    return acc;
  }, { module: 'KE', action: 'create' });

  router.post('/api/finance/transfers', ({ body, user }) => {
    const fromAcc = repo.state.cashBankAccounts.find((a) => a.id === body.fromAccountId);
    const toAcc = repo.state.cashBankAccounts.find((a) => a.id === body.toAccountId);
    const amount = Number(body.amountRp || 0);
    if (!fromAcc || !toAcc || fromAcc.id === toAcc.id || amount <= 0) {
      return { status: 400, body: { message: 'Pilih rekening asal, tujuan yang berbeda, dan nominal > 0' } };
    }
    if (fromAcc.balanceRp < amount) {
      return { status: 400, body: { message: 'Saldo rekening asal tidak mencukupi' } };
    }
    fromAcc.balanceRp -= amount;
    toAcc.balanceRp += amount;
    const tx = {
      id: `TRX-${Date.now().toString().slice(-4)}`,
      date: repo.nowIsoMinute(),
      type: 'Transfer',
      accountId: fromAcc.id,
      outlet: `${fromAcc.outlet} -> ${toAcc.outlet}`,
      category: 'Mutasi Antar Kas/Bank',
      paymentMethod: 'Transfer Internal',
      description: body.description || `Transfer dari ${fromAcc.name} ke ${toAcc.name}`,
      amountRp: amount,
      status: 'Selesai'
    };
    repo.state.cashTransactions.unshift(tx);
    repo.appendAudit(user, 'Keuangan', 'CASH_TRANSFER', `${tx.description} (${repo.formatRp(amount)})`);
    repo.save();
    return tx;
  }, { module: 'KE', action: 'create' });

  // Penerimaan & Pengeluaran
  router.get('/api/finance/receipts', () =>
    repo.state.cashTransactions.filter((t) => t.type === 'Penerimaan'), { module: 'KE', action: 'view' }
  );

  router.post('/api/finance/receipts', ({ body, user }) => {
    const amount = Number(body.amountRp || 0);
    if (amount <= 0) return { status: 400, body: { message: 'Nominal penerimaan harus > 0' } };
    const acc = repo.state.cashBankAccounts.find((a) => a.id === body.accountId) || repo.state.cashBankAccounts[0];
    if (acc) acc.balanceRp += amount;
    const tx = {
      id: `RCV-${Date.now().toString().slice(-4)}`,
      date: repo.nowIsoMinute(),
      type: 'Penerimaan',
      accountId: acc?.id || 'ACC-HQ-BCA',
      outlet: body.outlet || acc?.outlet || 'Pusat (Cloud VPS)',
      category: body.category || 'Penerimaan Lainnya',
      paymentMethod: body.method || 'Transfer Bank',
      description: body.description || 'Penerimaan kas masuk',
      amountRp: amount,
      status: 'Terverifikasi'
    };
    repo.state.cashTransactions.unshift(tx);
    repo.postJournal({
      outlet: tx.outlet,
      source: 'Keuangan',
      description: `Penerimaan: ${tx.description}`,
      codePrefix: 'JRN-RCV',
      lines: [
        { accountCode: '1101', debit: amount, credit: 0 },
        { accountCode: '4101', debit: 0, credit: amount }
      ]
    });
    repo.appendAudit(user, 'Keuangan', 'CREATE_RECEIPT', `${tx.description} (${repo.formatRp(amount)})`);
    repo.save();
    return tx;
  }, { module: 'KE', action: 'create' });

  router.get('/api/finance/expenses', () =>
    repo.state.cashTransactions.filter((t) => t.type === 'Pengeluaran'), { module: 'KE', action: 'view' }
  );

  router.post('/api/finance/expenses', ({ body, user }) => {
    const amount = Number(body.amountRp || 0);
    if (amount <= 0) return { status: 400, body: { message: 'Nominal pengeluaran harus > 0' } };
    const tx = {
      id: `EXP-${Date.now().toString().slice(-4)}`,
      date: repo.nowIsoMinute(),
      type: 'Pengeluaran',
      accountId: body.accountId || 'ACC-HQ-BCA',
      outlet: body.outlet || 'Pusat (Cloud VPS)',
      category: body.category || 'Operasional',
      paymentMethod: body.method || 'Transfer Bank',
      description: body.description || 'Pengeluaran operasional',
      amountRp: amount,
      status: 'Menunggu Approval'
    };
    repo.state.cashTransactions.unshift(tx);
    repo.appendAudit(user, 'Keuangan', 'CREATE_EXPENSE', `Pengajuan biaya: ${tx.description} (${repo.formatRp(amount)})`);
    repo.save();
    return tx;
  }, { module: 'KE', action: 'create' });

  router.post('/api/finance/expenses/:id/pay', ({ params, user }) => {
    const tx = repo.state.cashTransactions.find((t) => t.id === params.id && t.type === 'Pengeluaran');
    if (!tx) return { status: 404, body: { message: 'Voucher pengeluaran tidak ditemukan' } };
    if (tx.status === 'Dibayar') return tx;
    const acc = repo.state.cashBankAccounts.find((a) => a.id === tx.accountId) || repo.state.cashBankAccounts[0];
    if (acc) acc.balanceRp = Math.max(0, acc.balanceRp - tx.amountRp);
    tx.status = 'Dibayar';
    repo.postJournal({
      outlet: tx.outlet,
      source: 'Keuangan',
      description: `Pengeluaran (${tx.category}): ${tx.description}`,
      codePrefix: 'JRN-EXP',
      lines: [
        { accountCode: '6101', debit: tx.amountRp, credit: 0 },
        { accountCode: '1101', debit: 0, credit: tx.amountRp }
      ]
    });
    repo.appendAudit(user, 'Keuangan', 'PAY_EXPENSE', `Membayar voucher ${tx.id} (${repo.formatRp(tx.amountRp)})`);
    repo.save();
    return tx;
  }, { module: 'KE', action: 'approve' });

  // Piutang BPJS & Asuransi
  router.get('/api/finance/receivables', () => repo.state.bpjsClaims, { module: 'KE', action: 'view' });

  router.put('/api/finance/receivables/:claimNo', ({ params, body, user }) => {
    const claim = repo.state.bpjsClaims.find((c) => c.claimNo === params.claimNo);
    if (!claim) return { status: 404, body: { error: 'Klaim tidak ditemukan' } };
    const prevPaid = Number(claim.paidMillions || 0);
    const nextPaid = body.paidMillions !== undefined ? Number(body.paidMillions) : prevPaid;
    const deltaRp = Math.round((nextPaid - prevPaid) * 1_000_000);
    claim.paidMillions = nextPaid;
    claim.status = body.status || (nextPaid >= claim.amountMillions ? 'Lunas Cair' : claim.status);
    if (deltaRp > 0) {
      const hq = repo.state.cashBankAccounts.find((a) => a.id === 'ACC-HQ-BCA');
      if (hq) hq.balanceRp += deltaRp;
      repo.postJournal({
        outlet: claim.outlet,
        source: 'Pencairan Klaim',
        description: `Pencairan Klaim ${claim.claimNo} (${claim.program})`,
        codePrefix: 'JRN-KLM',
        lines: [
          { accountCode: '1101', debit: deltaRp, credit: 0 },
          { accountCode: '1102', debit: 0, credit: deltaRp }
        ]
      });
    }
    repo.appendAudit(user, 'Keuangan', 'UPDATE_RECEIVABLE', `Update klaim ${claim.claimNo} -> ${claim.status}`);
    repo.save();
    return claim;
  }, { module: 'KE', action: 'edit' });

  // Hutang Supplier
  router.get('/api/finance/payables', () => repo.state.supplierPayables, { module: 'KE', action: 'view' });

  router.post('/api/finance/payables/:id/pay', ({ params, body, user }) => {
    const ap = repo.state.supplierPayables.find((p) => p.id === params.id);
    if (!ap) return { status: 404, body: { error: 'Hutang supplier tidak ditemukan' } };
    const remaining = Math.max(0, Number(ap.totalRp) - Number(ap.paidRp));
    const payAmt = Math.min(remaining, Number(body.amountRp || remaining));
    if (payAmt <= 0) return { status: 400, body: { message: 'Tagihan sudah lunas' } };
    ap.paidRp += payAmt;
    ap.status = ap.paidRp >= ap.totalRp ? 'Lunas' : 'Cicilan / Sebagian';
    const hq = repo.state.cashBankAccounts.find((a) => a.id === 'ACC-HQ-BCA');
    if (hq) hq.balanceRp = Math.max(0, hq.balanceRp - payAmt);
    repo.postJournal({
      outlet: 'Pusat (Cloud VPS)',
      source: 'Pelunasan Hutang',
      description: `Pembayaran Hutang ${ap.supplier} (${ap.invoiceNo})`,
      codePrefix: 'JRN-AP',
      lines: [
        { accountCode: '2101', debit: payAmt, credit: 0 },
        { accountCode: '1101', debit: 0, credit: payAmt }
      ]
    });
    repo.appendAudit(user, 'Keuangan', 'PAY_AP', `Membayar hutang ${ap.invoiceNo} sebesar ${repo.formatRp(payAmt)}`);
    repo.save();
    return ap;
  }, { module: 'KE', action: 'approve' });

  // Budgets & Deposit Reconciliations
  router.get('/api/finance/budgets', () => repo.state.budgets, { module: 'KE', action: 'view' });

  router.post('/api/finance/budgets', ({ body, user }) => {
    const item = {
      id: `BDG-${Date.now().toString().slice(-3)}`,
      period: body.period || '2026-11',
      outlet: body.outlet || 'Klinik Utama',
      accountCode: body.accountCode || '6101 - Beban Operasional',
      budgetRp: Number(body.budgetRp || 0),
      actualRp: Number(body.actualRp || 0)
    };
    repo.state.budgets.unshift(item);
    repo.appendAudit(user, 'Keuangan', 'CREATE_BUDGET', `Menetapkan anggaran ${item.outlet} (${item.accountCode})`);
    repo.save();
    return item;
  }, { module: 'KE', action: 'create' });

  router.get('/api/finance/reconciliations', () => repo.state.depositReconciliations, { module: 'KE', action: 'view' });

  router.put('/api/finance/reconciliations/:id', ({ params, body, user }) => {
    const rec = repo.state.depositReconciliations.find((r) => r.id === params.id);
    if (!rec) return { status: 404, body: { error: 'Data rekonsiliasi tidak ditemukan' } };
    if (body.bankMutationRp !== undefined) {
      rec.bankMutationRp = Number(body.bankMutationRp);
      rec.varianceRp = rec.bankMutationRp - (Number(rec.localCashRp) + Number(rec.localDigitalRp));
    }
    rec.status = body.status || (rec.varianceRp === 0 ? 'Sesuai' : 'Ada Selisih');
    repo.appendAudit(user, 'Keuangan', 'VERIFY_RECONCILIATION', `Rekonsiliasi ${rec.outlet} (${rec.date}) -> ${rec.status}`);
    repo.save();
    return rec;
  }, { module: 'KE', action: 'approve' });

  // Akunting
  router.get('/api/finance', () => repo.state.journalEntries, { module: 'AK', action: 'view' });
  router.get('/api/accounting/coa', () => repo.state.chartOfAccounts, { module: 'AK', action: 'view' });

  router.post('/api/accounting/coa', ({ body, user }) => {
    if (!body.code || !body.name) return { status: 400, body: { message: 'Kode dan Nama akun wajib diisi' } };
    if (repo.state.chartOfAccounts.some((a) => a.code === body.code)) {
      return { status: 400, body: { message: `Kode akun ${body.code} sudah ada` } };
    }
    const bal = Number(body.balanceAmount || 0);
    const acc = {
      code: String(body.code),
      name: String(body.name),
      category: body.category || 'Beban Operasional',
      parentCode: body.parentCode || '',
      normalBalance: body.normalBalance || 'Debit',
      balanceAmount: bal,
      balance: repo.formatRp(bal)
    };
    repo.state.chartOfAccounts.push(acc);
    repo.state.chartOfAccounts.sort((a, b) => a.code.localeCompare(b.code));
    repo.appendAudit(user, 'Akunting', 'CREATE_COA', `Menambah akun COA ${acc.code} - ${acc.name}`);
    repo.save();
    return acc;
  }, { module: 'AK', action: 'create' });

  router.get('/api/accounting/journals', () => repo.state.journalEntries, { module: 'AK', action: 'view' });

  router.post('/api/accounting/journals', ({ body, user }) => {
    try {
      const entry = repo.postJournal({
        outlet: body.outlet || 'Pusat (Cloud VPS)',
        source: 'Manual',
        description: body.description || 'Jurnal penyesuaian manual',
        lines: body.lines || []
      });
      repo.appendAudit(user, 'Akunting', 'CREATE_JOURNAL', `Posting jurnal manual ${entry.code} (${entry.amount})`);
      repo.save();
      return entry;
    } catch (err) {
      return { status: 400, body: { message: err.message } };
    }
  }, { module: 'AK', action: 'create' });

  router.post('/api/accounting/journals/:code/reverse', ({ params, user }) => {
    const orig = repo.state.journalEntries.find((j) => j.code === params.code);
    if (!orig) return { status: 404, body: { message: 'Jurnal tidak ditemukan' } };
    const reversedLines = (orig.lines || []).map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: l.credit,
      credit: l.debit
    }));
    const rev = repo.postJournal({
      outlet: orig.outlet,
      source: 'Reversal',
      description: `Jurnal Pembalik atas ${orig.code}: ${orig.description}`,
      codePrefix: 'JRN-REV',
      lines: reversedLines
    });
    orig.status = 'Dibatalkan (Reversed)';
    repo.appendAudit(user, 'Akunting', 'REVERSE_JOURNAL', `Membalik jurnal ${orig.code} menjadi ${rev.code}`);
    repo.save();
    return rev;
  }, { module: 'AK', action: 'edit' });

  router.get('/api/accounting/ledger', ({ query }) => {
    const accountCode = query.get('accountCode') || '1101';
    const outletFilter = query.get('outlet') || 'Semua';
    const acc = repo.state.chartOfAccounts.find((a) => a.code === accountCode);
    const mutations = [];
    let running = 0;

    const chronological = [...repo.state.journalEntries].reverse();
    for (const j of chronological) {
      if (outletFilter !== 'Semua' && j.outlet !== outletFilter) continue;
      for (const line of j.lines || []) {
        if (line.accountCode === accountCode) {
          const delta = acc?.normalBalance === 'Kredit' ? line.credit - line.debit : line.debit - line.credit;
          running += delta;
          mutations.push({
            journalCode: j.code,
            date: j.date,
            outlet: j.outlet,
            description: j.description,
            debit: line.debit,
            credit: line.credit,
            runningBalance: running
          });
        }
      }
    }
    return {
      account: acc || { code: accountCode, name: 'Akun', normalBalance: 'Debit', balanceAmount: 0 },
      openingBalance: 0,
      endingBalance: acc?.balanceAmount ?? running,
      mutations: mutations.reverse()
    };
  }, { module: 'AK', action: 'view' });

  router.get('/api/accounting/statements', () => {
    const coa = repo.state.chartOfAccounts;
    const byPrefix = (prefixes) => coa.filter((a) => prefixes.some((p) => a.code.startsWith(p)) && a.code !== '1000');
    const sumAcc = (list) => list.reduce((s, a) => s + Number(a.balanceAmount || 0), 0);

    const revenues = byPrefix(['4']);
    const cogs = byPrefix(['5']);
    const opex = byPrefix(['6']);
    const assets = byPrefix(['1']);
    const liabilities = byPrefix(['2']);
    const equity = byPrefix(['3']);

    const totalRevenue = sumAcc(revenues);
    const totalCogs = sumAcc(cogs);
    const totalOpex = sumAcc(opex);
    const netProfit = totalRevenue - totalCogs - totalOpex;

    const totalAssets = assets.reduce(
      (s, a) => s + (a.normalBalance === 'Kredit' ? -Number(a.balanceAmount || 0) : Number(a.balanceAmount || 0)),
      0
    );
    const totalLiabilities = sumAcc(liabilities);
    const totalEquity = sumAcc(equity) + netProfit;

    return {
      incomeStatement: { revenues, cogs, opex, totalRevenue, totalCogs, totalOpex, grossProfit: totalRevenue - totalCogs, netProfit },
      balanceSheet: { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity },
      trialBalance: coa.filter((a) => a.code !== '1000')
    };
  }, { module: 'AK', action: 'view' });

  router.get('/api/accounting/consolidation', () => {
    const activeOutlets = repo.state.outlets.filter((o) => o.status !== 'Arsip');
    const columns = activeOutlets.map((o) => {
      const rev = Math.round(Number(o.todayRevenueMillions || 0) * 1_000_000);
      const hpp = Math.round(rev * 0.24);
      const opex = Math.round(rev * 0.14);
      return {
        entity: o.name,
        type: o.type,
        revenue: rev,
        cogs: hpp,
        opex,
        netProfit: rev - hpp - opex
      };
    });
    const eliminations = { entity: 'Eliminasi Antar-Cabang', type: 'Eliminasi', revenue: -2500000, cogs: -2500000, opex: 0, netProfit: 0 };
    return { columns, eliminations };
  }, { module: 'AK', action: 'view' });

  router.get('/api/accounting/fixed-assets', () => ({
    assets: repo.state.fixedAssets,
    runs: repo.state.depreciationRuns
  }), { module: 'AK', action: 'view' });

  router.post('/api/accounting/depreciation/run', ({ body, user }) => {
    const period = body.period || '2026-11';
    if (repo.state.depreciationRuns.some((r) => r.period === period)) {
      return { status: 400, body: { message: `Penyusutan periode ${period} sudah diposting` } };
    }
    let totalDep = 0;
    for (const ast of repo.state.fixedAssets) {
      const dep = Math.min(ast.bookValueRp, Number(ast.monthlyDepRp || 0));
      ast.accumulatedDepRp += dep;
      ast.bookValueRp = Math.max(0, ast.bookValueRp - dep);
      totalDep += dep;
    }
    const journal = repo.postJournal({
      outlet: 'Pusat (Cloud VPS)',
      source: 'Penyusutan Aset',
      description: `Penyusutan Aset Tetap Bulanan Periode ${period}`,
      codePrefix: 'JRN-DEP',
      lines: [
        { accountCode: '6101', debit: totalDep, credit: 0 },
        { accountCode: '1509', debit: 0, credit: totalDep }
      ]
    });
    const run = { id: `DEP-${period}`, period, totalAmountRp: totalDep, journalCode: journal.code, status: 'Diposting' };
    repo.state.depreciationRuns.unshift(run);
    repo.appendAudit(user, 'Akunting', 'RUN_DEPRECIATION', `Menjalankan penyusutan ${period} sebesar ${repo.formatRp(totalDep)}`);
    repo.save();
    return { run, journal };
  }, { module: 'AK', action: 'approve' });

  router.get('/api/accounting/taxes', () => repo.state.taxRecords, { module: 'AK', action: 'view' });

  router.put('/api/accounting/taxes/:id', ({ params, body, user }) => {
    const t = repo.state.taxRecords.find((x) => x.id === params.id);
    if (!t) return { status: 404, body: { error: 'Catatan pajak tidak ditemukan' } };
    t.status = body.status || 'Sudah Setor';
    repo.appendAudit(user, 'Akunting', 'UPDATE_TAX', `Status pajak ${t.taxType} (${t.period}) -> ${t.status}`);
    repo.save();
    return t;
  }, { module: 'AK', action: 'edit' });
}
