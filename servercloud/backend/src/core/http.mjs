export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Preview-Role'
};

export function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return true;
  }
  return false;
}

export function sendJson(res, payload, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_HEADERS
  });
  res.end(JSON.stringify(payload));
}

export function sendDownload(res, content, contentType, filename) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    ...CORS_HEADERS
  });
  res.end(content);
}

export function readBody(req, maxBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload terlalu besar'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * Matches a URL pathname against an Express-style pattern (e.g. '/api/outlets/:id/archive').
 * Returns null if no match, or an object of decoded params.
 */
export function matchRoute(pattern, pathname) {
  const pParts = pattern.split('/').filter(Boolean);
  const uParts = pathname.split('/').filter(Boolean);
  if (pParts.length !== uParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) {
      params[pParts[i].slice(1)] = decodeURIComponent(uParts[i]);
    } else if (pParts[i] !== uParts[i]) {
      return null;
    }
  }
  return params;
}

export class RouteRegistry {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler, options = {}) {
    this.routes.push({ method: method.toUpperCase(), pattern, handler, options });
  }

  get(pattern, handler, options) { this.add('GET', pattern, handler, options); }
  post(pattern, handler, options) { this.add('POST', pattern, handler, options); }
  put(pattern, handler, options) { this.add('PUT', pattern, handler, options); }
  patch(pattern, handler, options) { this.add('PATCH', pattern, handler, options); }
  delete(pattern, handler, options) { this.add('DELETE', pattern, handler, options); }

  find(method, pathname) {
    const upper = method.toUpperCase();
    for (const route of this.routes) {
      if (route.method !== upper) continue;
      const params = matchRoute(route.pattern, pathname);
      if (params) return { route, params };
    }
    return null;
  }
}
