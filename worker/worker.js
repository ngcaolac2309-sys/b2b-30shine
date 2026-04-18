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
 *   BASE_TOKEN     = OxKQbdhtuaoF1xssJjxlClBLgkc
 *   TBL_USERS      = tblxrn5eM82mwbji
 *   TBL_MASTER     = tblFXOMf6rEZ6Bj0
 *   TBL_ORDERS     = tbliaoGSVMsnr6tI
 *   TBL_LINES      = tblPbSZyadpk6dFG
 *   TBL_CUSTOMERS  = tblEjS2mRdt4pn1E
 *   SITE_ORIGIN    = https://ngcaolac2309-sys.github.io
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

// UTF-8 safe base64
function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64decodeUtf8(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function signSession(payload, secret) {
  const body = b64encodeUtf8(JSON.stringify(payload));
  const sig = await hmacSha256(secret, body);
  return `${body}.${sig}`;
}

async function verifySession(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = await hmacSha256(secret, body);
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(b64decodeUtf8(body));
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
    'Địa chỉ giao': body.ship_addr || '',
    'SĐT nhận hàng': body.ship_phone || '',
    'Người nhận hàng': body.ship_receiver || '',
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

async function updateOrder(env, orderId, body) {
  // body có thể là patch trực tiếp, hoặc {fields, lines, qua_user, maDon} để replace lines
  const fields = body.fields || body;
  const r = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_ORDERS}/records/${orderId}`,
    { method: 'PUT', body: JSON.stringify({ fields }) });
  if (r.code !== 0) return r;

  // Nếu có lines → xóa lines cũ + insert mới
  const maDon = body.maDon;
  const hasLinesUpdate = body.lines !== undefined || body.qua_user !== undefined;
  if (hasLinesUpdate && maDon) {
    // 1. Tìm tất cả line cũ của đơn này
    const search = await larkFetch(env,
      `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_LINES}/records/search?page_size=100`,
      { method: 'POST', body: JSON.stringify({ filter: { conjunction: 'and', conditions: [
        { field_name: 'Mã đơn', operator: 'is', value: [maDon] }
      ]}})});
    const oldIds = (search?.data?.items || []).map(it => it.record_id);

    // 2. Xóa batch
    if (oldIds.length) {
      await larkFetch(env,
        `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_LINES}/records/batch_delete`,
        { method: 'POST', body: JSON.stringify({ records: oldIds }) });
    }

    // 3. Insert lines mới
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
  }
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

async function deleteOrder(env, orderId) {
  // 1. Lấy Mã đơn để xóa lines
  const orderRec = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_ORDERS}/records/${orderId}`);
  const maDonField = orderRec?.data?.record?.fields?.['Mã đơn'];
  const maDon = typeof maDonField === 'string' ? maDonField
    : (Array.isArray(maDonField) && maDonField[0]?.text) ? maDonField[0].text : '';

  // 2. Xóa tất cả lines của đơn
  if (maDon) {
    const search = await larkFetch(env,
      `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_LINES}/records/search?page_size=100`,
      { method: 'POST', body: JSON.stringify({ filter: { conjunction: 'and', conditions: [
        { field_name: 'Mã đơn', operator: 'is', value: [maDon] }
      ]}})});
    const lineIds = (search?.data?.items || []).map(it => it.record_id);
    if (lineIds.length) {
      await larkFetch(env,
        `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_LINES}/records/batch_delete`,
        { method: 'POST', body: JSON.stringify({ records: lineIds }) });
    }
  }

  // 3. Xóa order
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_ORDERS}/records/${orderId}`,
    { method: 'DELETE' });
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

async function updateMaster(env, recordId, patch) {
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_MASTER}/records/${recordId}`,
    { method: 'PUT', body: JSON.stringify({ fields: patch }) });
}

async function createMaster(env, fields) {
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_MASTER}/records`,
    { method: 'POST', body: JSON.stringify({ fields }) });
}

async function deleteMaster(env, recordId) {
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_MASTER}/records/${recordId}`,
    { method: 'DELETE' });
}

// ========== Users CRUD ==========
async function listUsers(env) {
  const r = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_USERS}/records?page_size=200`);
  return (r?.data?.items || []).map(it => ({ record_id: it.record_id, ...it.fields }));
}

async function createUser(env, fields) {
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_USERS}/records`,
    { method: 'POST', body: JSON.stringify({ fields }) });
}

async function updateUser(env, recordId, patch) {
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_USERS}/records/${recordId}`,
    { method: 'PUT', body: JSON.stringify({ fields: patch }) });
}

async function deleteUser(env, recordId) {
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_USERS}/records/${recordId}`,
    { method: 'DELETE' });
}

// ========== Customers CRUD ==========
async function listCustomers(env) {
  const r = await larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_CUSTOMERS}/records?page_size=500`);
  return (r?.data?.items || []).map(it => ({ record_id: it.record_id, ...it.fields }));
}
async function createCustomer(env, fields) {
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_CUSTOMERS}/records`,
    { method: 'POST', body: JSON.stringify({ fields }) });
}
async function updateCustomer(env, recordId, patch) {
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_CUSTOMERS}/records/${recordId}`,
    { method: 'PUT', body: JSON.stringify({ fields: patch }) });
}
async function deleteCustomer(env, recordId) {
  return larkFetch(env,
    `/bitable/v1/apps/${env.BASE_TOKEN}/tables/${env.TBL_CUSTOMERS}/records/${recordId}`,
    { method: 'DELETE' });
}

// ========== Promotion logic ==========
// Ngưỡng DT NY (VND) gợi ý lên nhóm — bám theo kết quả phân loại 2025
const PROMO_THRESHOLDS = {
  N5: { upTo: 'N4', minDt: 50_000_000, minDon: 2 },
  N4: { upTo: 'N3', minDt: 200_000_000, minDon: 5, minCkAvg: 0.38 },
  N3: { upTo: 'N2', minDt: 500_000_000, minDon: 5, minCkAvg: 0.40 },
  N2: { upTo: 'N1', minDt: 1_000_000_000, minMonths: 6 },
};

function pickGroup(f) {
  const v = f['Nhóm KH'];
  if (typeof v === 'string') return v;
  if (v?.text) return v.text;
  if (Array.isArray(v) && v[0]?.text) return v[0].text;
  return '';
}

async function listPromotions(env) {
  // Trả về danh sách KH đủ điều kiện lên bậc (đề xuất vs nhóm hiện tại)
  const custs = await listCustomers(env);
  const suggestions = [];
  for (const c of custs) {
    const cur = pickGroup(c);
    const dt = Number(c['DT NY YTD'] || 0);
    const sodon = Number(c['Số đơn YTD'] || 0);
    const months = Number(c['Số tháng mua'] || 0);
    const dt_thuc = Number(c['DT Thực YTD'] || 0);
    const ckAvg = dt > 0 ? (dt - dt_thuc) / dt : 0;

    const rule = PROMO_THRESHOLDS[cur];
    if (!rule) continue;
    const ok =
      dt >= rule.minDt &&
      (!rule.minDon   || sodon  >= rule.minDon) &&
      (!rule.minMonths|| months >= rule.minMonths) &&
      (!rule.minCkAvg || ckAvg  >= rule.minCkAvg);
    if (!ok) continue;

    suggestions.push({
      record_id: c.record_id,
      ma_kh: c['Mã KH'] || '',
      ten_kh: c['Tên KH'] || '',
      sdt: c['SĐT'] || '',
      khu_vuc: (typeof c['Khu vực'] === 'object' ? c['Khu vực']?.text : c['Khu vực']) || '',
      sale: c['Sale phụ trách'] || '',
      nhom_hien_tai: cur,
      nhom_de_xuat: rule.upTo,
      dt_ny_ytd: dt,
      dt_thuc_ytd: dt_thuc,
      so_don: sodon,
      so_thang: months,
      pct_ck_avg: Math.round(ckAvg * 1000) / 10,
      cho_duyet: !!c['Chờ duyệt lên bậc'],
    });
  }
  // Sort: lớn hơn lên trước
  suggestions.sort((a, b) => b.dt_ny_ytd - a.dt_ny_ytd);
  return suggestions;
}

async function approvePromotion(env, recordId, newGroup) {
  return updateCustomer(env, recordId, {
    'Nhóm KH': newGroup,
    'Chờ duyệt lên bậc': false,
    'Nhóm đề xuất': newGroup,
  });
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

      // GET /api/master — ai cũng xem được (sale + admin + view đều xem bảng giá)
      if (url.pathname === '/api/master' && req.method === 'GET') {
        const list = await listMaster(env);
        return json({ data: list }, 200, cors);
      }

      // Admin-only endpoints
      const requireAdmin = () => {
        if (session.role !== 'admin') return json({ err: 'admin_required' }, 403, cors);
        return null;
      };

      // POST /api/master — admin tạo SKU mới
      if (url.pathname === '/api/master' && req.method === 'POST') {
        const denied = requireAdmin(); if (denied) return denied;
        const body = await req.json();
        const r = await createMaster(env, body.fields);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }
      // PATCH /api/master/:id — admin sửa SKU
      const mMaster = url.pathname.match(/^\/api\/master\/([^\/]+)$/);
      if (mMaster && req.method === 'PATCH') {
        const denied = requireAdmin(); if (denied) return denied;
        const body = await req.json();
        const r = await updateMaster(env, mMaster[1], body);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }
      if (mMaster && req.method === 'DELETE') {
        const denied = requireAdmin(); if (denied) return denied;
        const r = await deleteMaster(env, mMaster[1]);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }

      // Users CRUD — admin only
      if (url.pathname === '/api/users' && req.method === 'GET') {
        const denied = requireAdmin(); if (denied) return denied;
        const list = await listUsers(env);
        return json({ data: list }, 200, cors);
      }
      if (url.pathname === '/api/users' && req.method === 'POST') {
        const denied = requireAdmin(); if (denied) return denied;
        const body = await req.json();
        const r = await createUser(env, body.fields);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }
      const mUser = url.pathname.match(/^\/api\/users\/([^\/]+)$/);
      if (mUser && req.method === 'PATCH') {
        const denied = requireAdmin(); if (denied) return denied;
        const body = await req.json();
        const r = await updateUser(env, mUser[1], body);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }
      if (mUser && req.method === 'DELETE') {
        const denied = requireAdmin(); if (denied) return denied;
        const r = await deleteUser(env, mUser[1]);
        return json(r, r.code === 0 ? 200 : 500, cors);
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
      // DELETE /api/orders/:id — admin only
      if (mOrder && req.method === 'DELETE') {
        const denied = requireAdmin(); if (denied) return denied;
        const r = await deleteOrder(env, mOrder[1]);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }

      // GET /api/orders/:id/lines
      const mLines = url.pathname.match(/^\/api\/orders\/([^\/]+)\/lines$/);
      if (mLines && req.method === 'GET') {
        const lines = await getOrderLines(env, mLines[1]);
        return json({ data: lines }, 200, cors);
      }

      // ─── Customers: ai cũng xem được (sale dùng để tạo đơn, admin quản lý)
      if (url.pathname === '/api/customers' && req.method === 'GET') {
        const list = await listCustomers(env);
        return json({ data: list }, 200, cors);
      }
      // Admin: CRUD Customers
      if (url.pathname === '/api/customers' && req.method === 'POST') {
        const denied = requireAdmin(); if (denied) return denied;
        const body = await req.json();
        const r = await createCustomer(env, body.fields);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }
      const mCust = url.pathname.match(/^\/api\/customers\/([^\/]+)$/);
      if (mCust && req.method === 'PATCH') {
        const denied = requireAdmin(); if (denied) return denied;
        const body = await req.json();
        const r = await updateCustomer(env, mCust[1], body);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }
      if (mCust && req.method === 'DELETE') {
        const denied = requireAdmin(); if (denied) return denied;
        const r = await deleteCustomer(env, mCust[1]);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }

      // Promotions: KH đạt ngưỡng lên bậc
      if (url.pathname === '/api/customers/promotions' && req.method === 'GET') {
        const list = await listPromotions(env);
        return json({ data: list }, 200, cors);
      }
      // Admin duyệt lên bậc
      const mApprove = url.pathname.match(/^\/api\/customers\/([^\/]+)\/approve-promotion$/);
      if (mApprove && req.method === 'POST') {
        const denied = requireAdmin(); if (denied) return denied;
        const body = await req.json();
        if (!body.nhom) return json({ err: 'missing_nhom' }, 400, cors);
        const r = await approvePromotion(env, mApprove[1], body.nhom);
        return json(r, r.code === 0 ? 200 : 500, cors);
      }

      return json({ err: 'not_found', path: url.pathname }, 404, cors);
    } catch (e) {
      return json({ err: 'server_error', message: e.message }, 500, cors);
    }
  }
};
