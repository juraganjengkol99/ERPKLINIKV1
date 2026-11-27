import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleCors, readBody, sendJson, RouteRegistry } from './src/core/http.mjs';
import { verifyJwt, checkPermission } from './src/core/security.mjs';
import { StoreRepository } from './src/store/repository.mjs';
import { registerAuthDashboardRoutes } from './src/routes/auth_dashboard.mjs';
import { registerOutletRoutes } from './src/routes/outlets.mjs';
import { registerHrRoutes } from './src/routes/hr.mjs';
import { registerFinanceAccountingRoutes } from './src/routes/finance_accounting.mjs';
import { registerSupplyChainRoutes } from './src/routes/supplychain.mjs';
import { registerGaMarketingRoutes } from './src/routes/ga_marketing.mjs';
import { registerIntegrationsReportsSettingsRoutes } from './src/routes/integrations_settings.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'Data');

const repo = new StoreRepository(dataDir);
repo.initDatabase();

const router = new RouteRegistry();
registerAuthDashboardRoutes(router, repo);
registerOutletRoutes(router, repo);
registerHrRoutes(router, repo);
registerFinanceAccountingRoutes(router, repo);
registerSupplyChainRoutes(router, repo);
registerGaMarketingRoutes(router, repo);
registerIntegrationsReportsSettingsRoutes(router, repo);

const PORT = Number(process.env.PORT || 5180);

const server = http.createServer(async (req, res) => {
  if (handleCors(req, res)) return;

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const match = router.find(req.method || 'GET', url.pathname);

  if (!match) {
    return sendJson(res, { status: 'Cloud VPS Sync Hub v2 Active', path: url.pathname });
  }

  const { route, params } = match;
  let authUser = null;

  const authHeader = String(req.headers['authorization'] || '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyJwt(token);
    if (payload) {
      authUser = repo.state.users.find((u) => u.id === payload.sub && u.status !== 'Nonaktif') || null;
    }
  }

  if (!route.options?.public) {
    if (!authUser) {
      return sendJson(res, { message: 'Sesi login tidak valid atau kedaluwarsa. Silakan login kembali.' }, 401);
    }
    if (route.options?.module) {
      const allowed = checkPermission(repo.state, authUser, route.options.module, route.options.action || 'view');
      if (!allowed) {
        return sendJson(res, { message: `Akses ditolak: Role ${authUser.role} tidak memiliki izin ${route.options.action || 'view'} pada modul ${route.options.module}` }, 403);
      }
    }
  }

  try {
    const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '') ? await readBody(req) : {};
    const result = await route.handler({ req, res, params, query: url.searchParams, body, user: authUser });

    if (result && result.__handled) return;
    if (result && typeof result === 'object' && 'status' in result && 'body' in result && Object.keys(result).length === 2) {
      return sendJson(res, result.body, result.status);
    }
    return sendJson(res, result ?? { ok: true }, 200);
  } catch (err) {
    console.error('[API Error]', url.pathname, err);
    return sendJson(res, { message: err?.message || 'Terjadi kesalahan pada server' }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`Cloud VPS Sync Hub v2 (Modular + MySQL/JSON) listening on http://localhost:${PORT}`);
});
