/* ============================================
   PRICING & PNL LOGIC
============================================ */

// Tính CK áp cho nhóm × CT (có thể bị override theo KH)
// ck_override: {Glanzen, Laborie, 'Dr.FS'} — nếu có giá trị > 0 thì ưu tiên hơn nhóm
function getCkForOrder(nhom, ct_id, ck_override) {
  const ct = PROGRAMS[ct_id];
  if (!ct) return 0;
  // CT3 có ck_fixed cho tất cả — nhưng override KH vẫn thắng
  if (ck_override && ct.ck_nhan && ck_override[ct.ck_nhan] > 0) {
    return ck_override[ct.ck_nhan];
  }
  if (ct.ck_fixed !== undefined) return ct.ck_fixed;
  const group = CK_GROUPS[nhom];
  if (!group) return 0;
  return group[ct.ck_nhan] || 0;
}

// Xác định bậc hiện tại
function getCurrentTier(ct_id, dt_thuc, qty) {
  const ct = PROGRAMS[ct_id];
  let active = null;
  for (const t of ct.tiers) {
    if (ct.tier_by === 'qty') {
      if (qty >= (t.min_qty || 0)) active = t;
    } else {
      if (dt_thuc >= (t.min_dt_thuc || 0)) active = t;
    }
  }
  return active;
}

// Tính giá vốn quà (có thể NV chưa chọn đủ, trả về upper bound theo gợi ý)
function calcGiftCOGS(tier, ct_id, qua_user) {
  // qua_user: array {sku, sl} do NV nhập
  if (qua_user && qua_user.length) {
    return qua_user.reduce((s, q) => {
      const sku = skuById(q.sku);
      return s + (sku ? sku.gv * q.sl : 0);
    }, 0);
  }
  // Fallback tính theo tier gợi ý
  if (!tier) return 0;
  let total = 0;
  if (tier.qua) {
    tier.qua.forEach(q => {
      const sku = skuById(q.sku);
      if (sku) total += sku.gv * q.sl;
    });
  }
  if (tier.qua_fixed) {
    tier.qua_fixed.forEach(q => {
      const sku = skuById(q.sku);
      if (sku) total += sku.gv * q.sl;
    });
  }
  // Quà tuỳ chọn (CT2/CT3): ước bằng GV BQ
  if (tier.qua_sl && !tier.qua_options) {
    // Default Laborie 250ml BQ
    const avg = 118948;
    total += avg * tier.qua_sl;
  }
  return total;
}

// Tính PnL đầy đủ từ order state
function calcPnL(state) {
  // state: { ct_id, nhom, lines: [{sku, sl}], qua_user: [{sku, sl}] }
  const ct = PROGRAMS[state.ct_id];
  const ck = getCkForOrder(state.nhom, state.ct_id, state.ck_override);

  let dt_ny = 0, dt_thuc = 0, cogs = 0, qty = 0;
  const lines_detail = (state.lines || []).map(l => {
    const sku = skuById(l.sku);
    if (!sku || !l.sl) return null;
    const gia_ny = sku.ny;
    const gia_sau_ck = gia_ny * (1 - ck);
    const thanh_tien = gia_sau_ck * l.sl;
    const gv_line = sku.gv * l.sl;
    dt_ny += gia_ny * l.sl;
    dt_thuc += thanh_tien;
    cogs += gv_line;
    qty += l.sl;
    return { ...l, ten: sku.ten, nhan: sku.nhan, gia_ny, gia_sau_ck, thanh_tien, gv_line };
  }).filter(Boolean);

  const tier = getCurrentTier(state.ct_id, dt_thuc, qty);
  const gv_qua = calcGiftCOGS(tier, state.ct_id, state.qua_user);

  const ck_kh_amount = dt_ny - dt_thuc;
  const ck_nv = dt_thuc * COST_CONFIG.ck_nv;
  const van_hanh = dt_thuc * COST_CONFIG.van_hanh;
  const gm = dt_ny - ck_kh_amount - cogs;
  const ln_thuan = gm - ck_nv - van_hanh - gv_qua;
  const pct_ln_ny = dt_ny > 0 ? ln_thuan / dt_ny : 0;
  const pct_ln_thuc = dt_thuc > 0 ? ln_thuan / dt_thuc : 0;

  return {
    ct_id: state.ct_id,
    ct_name: ct ? ct.ten : '',
    nhom: state.nhom,
    ck_kh: ck,
    lines: lines_detail,
    tier,
    qty,
    dt_ny, dt_thuc, ck_kh_amount,
    cogs, ck_nv, van_hanh, gv_qua,
    gm, ln_thuan, pct_ln_ny, pct_ln_thuc,
  };
}

function tierStatus(pct_ln_ny) {
  if (pct_ln_ny >= COST_CONFIG.muc_tieu_ln_ny) return { cls: 'pass', text: '✅ ĐẠT mục tiêu LN ≥15%/NY' };
  if (pct_ln_ny >= 0.10) return { cls: 'warn', text: '⚠️ LN 10-15%/NY — chấp nhận được' };
  return { cls: 'fail', text: '❌ LN <10%/NY — cần xem lại' };
}
