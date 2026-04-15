/**
 * 30Shine B2B Worker — Cloudflare Worker
 * - Proxy Lark Open API với tenant_access_token tự cache
 * - Lark OAuth (v2) + session cookie (HMAC-signed)
 * - CRUD Orders / OrderLines / MasterPrice
 *
 * Secrets cần set (Cloudflare dashboard):
 *   LARK_APP_ID, LARK_APP_SECRET, SESSION_SECRET
 *
 * Env vars (plain):
 *   BASE_TOKEN = OxKQbdhtuaoF1xssJjxlClBLgkc
 *   TBL_USERS  = tblxrn5eM82mwbji
 *   TBL_MASTER = tblFXOMf6rEZ6Bj0
 *   TBL_ORDERS = tbliaoGSVMsnr6tI
 *   TBL_LINES  = tblPbSZyadpk6dFG
 *   SITE_ORIGIN = https://ngcaolac2309-sys.github.io
 *   SITE_BASE_PATH = /b2b-30shine
 */

const LARK_BASE = 'https://open.larksuite.com/open-apis';
const LARK_AUTH = 'https://accounts.larksuite.com/open-apis/authen/v1/authorize';

// ========== Utilities ==========
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function corsHeaders(origin, env) {
  const allowedOrigin = env.SITE_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin === allowedOrigin ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

async function hmacSha256(key, data) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signSession(payload, secret) {
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, '');
  const sig = await hmacSha256(secret, body);
  return `${body}.${sig}`;
}

async function verifySession(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = await hmacSha256(secret, body);
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(atob(body));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function parseCookies(req) {
  const cookie = req.headers.get('Cookie') || '';
  const out = {};
  cookie.split(';').forEach(p => {
    const [k, v] = p.split('=').map(x => (x || '').trim());
    if (k) out[k] = decodeURIComponent(v || '');
  });
  return out;
}

function setCookie(name, value, { maxAge = 86400 * 7, path = '/' } = {}) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${path}; Secure; HttpOnly; SameSite=None`;
}

// ========== Lark tenant token cache (per-isolate, ~1h) ==========
let CACHED_TOKEN = null;
let CACHED_EXP = 0;

async function getTenantToken(env) {
  const now = Date.now();
  if (CACHED_TOKEN && CACHED_EXP > now + 30000) return CACHED_TOKEN;
  const r = await fetch(`${LARK_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
  });
  const data = await r.json();
  if (data.code !== 0) throw new Error('Lark token err: ' + JSON.stringify(data));
  CACHED_TOKEN = data.tenant_access_token;
  CACHED_EXP = now + (data.expire || 7200) * 1000;
  return CACHED_TOKEN;
}

async function larkFetch(env, path, options = {}) {
  const token = await getTenantToken(env);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const r = await fetch(`${LARK_BASE}${path}`, { ...options, headers });
  return r.json();
}

// ========== User lookup ==========
async function getUserByEmail(env, email) {
  const filter = `CurrentValue.[Email]="${email}"`;
  const r = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_USERS}/records/search?page_size=1`,
    { method: 'POST', body: JSON.stringify({ filter: { conjunction: 'and', conditions: [
      { field_name: 'Email', operator: 'is', value: [email] }
    ]}})});
  const items = r?.data?.items || [];
  if (!items.length) return null;
  const f = items[0].fields;
  // Active can be boolean or string depending on field type
  const active = f['Active'] === true || f['Active'] === 'true' || f['Active'] === 1;
  return {
    record_id: items[0].record_id,
    email: typeof f['Email'] === 'string' ? f['Email'] : (f['Email']?.[0]?.text || ''),
    name: typeof f['Họ tên'] === 'string' ? f['Họ tên'] : (f['Họ tên']?.[0]?.text || email),
    role: f['Role']?.text || f['Role'] || 'view',
    active,
  };
}

// ========== Auth handlers ==========
async function handleLogin(env, url) {
  const redirectUri = encodeURIComponent(`${url.origin}/auth/callback`);
  const state = Math.random().toString(36).slice(2);
  const target = `${LARK_AUTH}?app_id=${env.LARK_APP_ID}&redirect_uri=${redirectUri}&state=${state}`;
  return Response.redirect(target, 302);
}

async function handleCallback(env, url) {
  const code = url.searchParams.get('code');
  if (!code) return new Response('Missing code', { status: 400 });

  let tokData, userData, info = {}, email = '';

  // Step 1: Exchange code for user_access_token
  try {
    const r1 = await fetch(`${LARK_BASE}/authen/v2/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: env.LARK_APP_ID,
        client_secret: env.LARK_APP_SECRET,
        code,
        redirect_uri: `${url.origin}/auth/callback`,
      }),
    });
    tokData = await r1.json();
  } catch (e) {
    return new Response('Step1 token fetch error: ' + e.message, { status: 500 });
  }

  if (!tokData || !tokData.access_token) {
    return new Response('<pre>Token exchange failed.\nResponse: ' + JSON.stringify(tokData, null, 2) + '</pre>', {
      status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // Step 2: Get user info
  try {
    const r2 = await fetch(`${LARK_BASE}/authen/v1/user_info`, {
      headers: { 'Authorization': `Bearer ${tokData.access_token}` },
    });
    userData = await r2.json();
    info = userData?.data || {};
    email = info.email || info.enterprise_email || '';
  } catch (e) {
    return new Response('Step2 user_info error: ' + e.message, { status: 500 });
  }

  if (!email) {
    return new Response(`<pre>Không lấy được email từ Lark.
user_info response: ${JSON.stringify(userData, null, 2)}
Cần scope: contact:user.email:readonly / Obtain user's email information</pre>`, {
      status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // Check whitelist
  let user;
  try {
    user = await getUserByEmail(env, email);
  } catch (e) {
    return new Response('Step3 whitelist lookup error: ' + e.message + '\nEmail: ' + email, {
      status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
  if (!user || !user.active) {
    const redirectHome = `${env.SITE_ORIGIN}${env.SITE_BASE_PATH}/login.html?err=nowl&email=${encodeURIComponent(email)}`;
    return Response.redirect(redirectHome, 302);
  }

  // Create session
  const session = {
    email: user.email,
    name: user.name || info.name || email,
    role: user.role,
    avatar: info.avatar_url || '',
    exp: Date.now() + 7 * 86400 * 1000,
  };
  const token = await signSession(session, env.SESSION_SECRET);
  const cookie = setCookie('session', token);
  const dest = user.role === 'admin'
    ? `${env.SITE_ORIGIN}${env.SITE_BASE_PATH}/sale.html`
    : `${env.SITE_ORIGIN}${env.SITE_BASE_PATH}/sale.html`;
  return new Response(null, { status: 302, headers: { 'Location': dest, 'Set-Cookie': cookie } });
}

async function getSession(req, env) {
  const cookies = parseCookies(req);
  if (!cookies.session) return null;
  return verifySession(cookies.session, env.SESSION_SECRET);
}

// ========== Order handlers ==========
async function createOrder(env, session, body) {
  // Generate mã đơn
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  const maDon = `B2B${yy}${mm}${dd}-${rnd}`;

  // Build order record
  const fields = {
    'Mã đơn': maDon,
    'Ngày đặt': d.getTime(),
    'KH': body.kh_ten || '',
    'SĐT': body.kh_sdt || '',
    'Nhóm KH': body.nhom,
    'Chương trình': body.ct_id,
    'Bậc': body.tier || '',
    'DT NY': body.dt_ny || 0,
    'DT thực thu': body.dt_thuc || 0,
    'COGS': body.cogs || 0,
    'GV quà': body.gv_qua || 0,
    'LN thuần': body.ln_thuan || 0,
    '% LN/NY': body.pct_ln_ny || 0,
    'Trạng thái': body.status || 'Nháp',
    'Sale': session.email,
    'Ghi chú': body.ghi_chu || '',
  };
  const r = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_ORDERS}/records`,
    { method: 'POST', body: JSON.stringify({ fields }) });
  if (r.code !== 0) return { err: r };
  const orderId = r.data.record.record_id;

  // Insert lines
  const allLines = [];
  (body.lines || []).forEach(l => allLines.push({ fields: {
    'Mã đơn': maDon, 'Mã SKU': l.sku, 'Tên SP': l.ten || '',
    'Loại': 'Bán', 'SL': l.sl, 'Giá NY': l.gia_ny || 0,
    'CK': body.ck_kh || 0, 'Giá sau CK': l.gia_sau_ck || 0,
    'Thành tiền': l.thanh_tien || 0, 'Giá vốn': l.gv_line || 0,
  }}));
  (body.qua_user || []).forEach(q => allLines.push({ fields: {
    'Mã đơn': maDon, 'Mã SKU': q.sku, 'Tên SP': q.ten || '',
    'Loại': 'Quà', 'SL': q.sl, 'Giá NY': q.gia_ny || 0,
    'Giá vốn': (q.gv || 0) * q.sl,
  }}));
  if (allLines.length) {
    await larkFetch(env,
      `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_LINES}/records/batch_create`,
      { method: 'POST', body: JSON.stringify({ records: allLines }) });
  }
  return { maDon, orderId };
}

async function updateOrder(env, orderId, patch) {
  const r = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_ORDERS}/records/${orderId}`,
    { method: 'PUT', body: JSON.stringify({ fields: patch }) });
  return r;
}

async function listOrders(env, email, role) {
  const conditions = [];
  if (role !== 'admin') conditions.push({ field_name: 'Sale', operator: 'is', value: [email] });
  const body = conditions.length ? { filter: { conjunction: 'and', conditions } } : {};
  const r = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_ORDERS}/records/search?page_size=100`,
    { method: 'POST', body: JSON.stringify(body) });
  const items = (r?.data?.items || []).map(it => ({
    record_id: it.record_id,
    fields: it.fields,
  }));
  return items;
}

async function getOrderLines(env, maDon) {
  const r = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_LINES}/records/search?page_size=100`,
    { method: 'POST', body: JSON.stringify({ filter: { conjunction: 'and', conditions: [
      { field_name: 'Mã đơn', operator: 'is', value: [maDon] }
    ]}}) });
  return (r?.data?.items || []).map(it => it.fields);
}

// ========== Master price ==========
async function listMaster(env) {
  const r = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_MASTER}/records?page_size=100`);
  return (r?.data?.items || []).map(it => ({ record_id: it.record_id, ...it.fields }));
}

// ========== Router ==========
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      // Public routes
      if (url.pathname === '/health') {
        return json({ ok: true, time: new Date().toISOString() }, 200, cors);
      }
      if (url.pathname === '/auth/login') return handleLogin(env, url);
      if (url.pathname === '/auth/callback') return handleCallback(env, url);

      if (url.pathname === '/auth/logout') {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${env.SITE_ORIGIN}${env.SITE_BASE_PATH}/`,
            'Set-Cookie': setCookie('session', '', { maxAge: 0 }),
            ...cors,
          }
        });
      }

      // Auth required below
      const session = await getSession(req, env);

      if (url.pathname === '/auth/me') {
        if (!session) return json({ err: 'not_authenticated' }, 401, cors);
        return json({ user: session }, 200, cors);
      }

      if (!session) return json({ err: 'not_authenticated' }, 401, cors);

      // GET /api/master
      if (url.pathname === '/api/master' && req.method === 'GET') {
        const list = await listMaster(env);
        return json({ data: list }, 200, cors);
      }

      // GET /api/orders
      if (url.pathname === '/api/orders' && req.method === 'GET') {
        const list = await listOrders(env, session.email, session.role);
        return json({ data: list }, 200, cors);
      }

      // POST /api/orders
      if (url.pathname === '/api/orders' && req.method === 'POST') {
        const body = await req.json();
        const result = await createOrder(env, session, body);
        if (result.err) return json(result, 500, cors);
        return json(result, 200, cors);
      }

      // PATCH /api/orders/:id
      const mOrder = url.pathname.match(/^\/api\/orders\/([^\/]+)$/);
      if (mOrder && req.method === 'PATCH') {
        const body = await req.json();
        const r = await updateOrder(env, mOrder[1], body);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }

      // GET /api/orders/:id/lines
      const mLines = url.pathname.match(/^\/api\/orders\/([^\/]+)\/lines$/);
      if (mLines && req.method === 'GET') {
        const lines = await getOrderLines(env, mLines[1]);
        return json({ data: lines }, 200, cors);
      }

      return json({ err: 'not_found', path: url.pathname }, 404, cors);
    } catch (e) {
      return json({ err: 'server_error', message: e.message }, 500, cors);
    }
  }
};
