/* ============================================
   API CLIENT — Gọi Cloudflare Worker
============================================ */
// ⚠️ Cập nhật URL worker sau khi deploy
const API_BASE = (window.API_BASE_OVERRIDE || 'https://b2b-30shine-api.ngcaolac2309.workers.dev');

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (res.status === 401) {
    return { _unauth: true };
  }
  return res.json();
}

async function apiMe() {
  const r = await apiFetch('/auth/me');
  return r._unauth ? null : (r.user || null);
}

async function apiCreateOrder(payload) {
  return apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
}

async function apiUpdateOrder(recordId, patch) {
  return apiFetch(`/api/orders/${recordId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

async function apiListOrders() {
  const r = await apiFetch('/api/orders');
  return r._unauth ? [] : (r.data || []);
}

async function apiGetLines(maDon) {
  const r = await apiFetch(`/api/orders/${encodeURIComponent(maDon)}/lines`);
  return r._unauth ? [] : (r.data || []);
}

function apiLoginUrl() { return API_BASE + '/auth/login'; }
function apiLogoutUrl() { return API_BASE + '/auth/logout'; }
