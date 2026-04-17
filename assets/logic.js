/* ============================================
   PRICING & PNL LOGIC
============================================ */

// Tính CK áp cho nhóm × CT (có thể bị override theo KH)
// ck_override: {Glanzen, Laborie, 'Dr. For Skin'} — nếu có giá trị > 0 thì ưu tiên hơn nhóm
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

// Xác định bậc hiện tại (nhom cần cho SVIP nhom_only check)
function getCurrentTier(ct_id, dt_thuc, qty, nhom) {
  const ct = PROGRAMS[ct_id];
  let active = null;
  for (const t of ct.tiers) {
    // Check nhom_only: SVIP chỉ dành cho nhóm chỉ định
    if (t.nhom_only && t.nhom_only !== nhom) continue;

    if (ct.tier_by === 'qty') {
      if (qty >= (t.min_qty || 0)) active = t;
    } else {
      // SVIP hỗ trợ OR: đạt dt_thuc HOẶC đạt qty (500 SP)
      const dt_ok = dt_thuc >= (t.min_dt_thuc || 0);
      const qty_ok = t.svip && qty >= 500;
      if (dt_ok || qty_ok) active = t;
    }
  }
  return active;
}

// Tính tổng giá trị quà (NY) do Sale chọn
function calcGiftNyValue(qua_user) {
  if (!qua_user || !qua_user.length) return 0;
  return qua_user.reduce((s, q) => {
    const sku = skuById(q.sku);
    return s + (sku ? sku.ny * q.sl : 0);
  }, 0);
}

// Ngưỡng max (CK + quà)/NY theo nhãn CT — Sale nội bộ, không hiện cho KH
const GIFT_MAX_PCT = {
  Glanzen: { N1: 0.75, N2: 0.60, N3: 0.55, N4: 0.48, N5: 0.38 },
  Laborie: { N1: 0.60, N2: 0.55, N3: 0.50, N4: 0.48, N5: 0.45 },
  'Dr. For Skin': { N1: 0.55, N2: 0.52, N3: 0.50, N4: 0.48, N5: 0.45 },
};

// Tính quà đề xuất thực tế (scale theo order NY, đảm bảo không vượt ngưỡng)
// Trả [{sku, sl, ten}] — SL đã scale + round
function calcSuggestedGifts(state, pnl) {
  const ct = PROGRAMS[state.ct_id];
  const tier = pnl.tier;
  if (!tier || !pnl.dt_ny) return [];

  const brand = ct.ck_nhan;
  const maxMap = GIFT_MAX_PCT[brand];
  const pct_max = maxMap ? (maxMap[state.nhom] || 0.55) : 0.55;
  const ck = pnl.ck_kh;

  // Budget quà (NY) = (max% - CK%) × order NY
  const gift_budget = Math.max(0, (pct_max - ck) * pnl.dt_ny);

  // Thu thập danh sách quà gốc từ tier
  let base_gifts = [];
  if (tier.qua) {
    base_gifts = tier.qua.map(q => ({ sku: q.sku, sl: q.sl }));
  }
  if (tier.qua_fixed) {
    tier.qua_fixed.forEach(q => base_gifts.push({ sku: q.sku, sl: q.sl }));
  }
  if (tier.qua_sl) {
    // Quà tự chọn: ước bằng Laborie BQ 402k NY
    const opts = tier.qua_options || ['DG_269','DG_273','DG_272'];
    const per = Math.ceil(tier.qua_sl / opts.length);
    opts.forEach(sku => base_gifts.push({ sku, sl: per }));
  }
  if (!base_gifts.length) return [];

  // Tính tổng NY gốc của danh sách quà
  let base_total_ny = 0;
  base_gifts.forEach(g => {
    const s = skuById(g.sku);
    if (s) base_total_ny += s.ny * g.sl;
  });
  if (base_total_ny <= 0) return [];

  // Scale ratio: nếu tổng NY gốc > budget → scale xuống
  const ratio = base_total_ny <= gift_budget ? 1 : gift_budget / base_total_ny;

  return base_gifts.map(g => {
    const s = skuById(g.sku);
    const scaled = Math.max(0, Math.round(g.sl * ratio));
    return { sku: g.sku, sl: scaled, ten: s ? s.ten : g.sku };
  }).filter(g => g.sl > 0);
}

// Kiểm tra gift vượt ngưỡng → trả {ok, pct_total, pct_max, over}
function checkGiftLimit(state, pnl) {
  const ct = PROGRAMS[state.ct_id];
  if (!ct || !pnl.dt_ny) return { ok: true, pct_total: 0, pct_max: 1 };
  const brand = ct.ck_nhan;
  const maxMap = GIFT_MAX_PCT[brand];
  const pct_max = maxMap ? (maxMap[state.nhom] || 0.55) : 0.55;
  const gift_ny = calcGiftNyValue(state.qua_user);
  const pct_total = (pnl.ck_kh_amount + gift_ny) / pnl.dt_ny;
  return {
    ok: pct_total <= pct_max,
    pct_total: Math.round(pct_total * 1000) / 10,
    pct_max: Math.round(pct_max * 1000) / 10,
    over: pct_total > pct_max,
    gift_ny,
  };
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

  const tier = getCurrentTier(state.ct_id, dt_thuc, qty, state.nhom);
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
