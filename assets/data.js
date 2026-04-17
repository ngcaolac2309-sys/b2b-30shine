/* ============================================
   MASTER DATA — Embedded for Pha A (sẽ fetch từ Lark Base ở Pha B)
============================================ */

const MASTER_PRICE = [
  { sku: 'SAP_GLZL60',  nhan: 'Glanzen', ten: 'Sáp Glanzen Claywax Limited 60g',           gv: 50613, ny: 500000 },
  { sku: 'SAP_080',     nhan: 'Glanzen', ten: 'Sáp Glanzen Prime Sandar wood',              gv: 47400, ny: 349000 },
  { sku: 'GOM_016',     nhan: 'Glanzen', ten: 'Gôm tạo kiểu Glanzen Prime Floral 380ml',    gv: 41339, ny: 349000 },
  { sku: 'GOM_017',     nhan: 'Glanzen', ten: 'Gôm tạo kiểu Glanzen Original 380ml',        gv: 41312, ny: 249000 },
  { sku: 'XTP_009',     nhan: 'Glanzen', ten: 'Xịt tạo phồng Glanzen 2025 X2 Booster 200ml', gv: 53569, ny: 340000 },
  { sku: 'SAP_GLZ60',   nhan: 'Glanzen', ten: 'Sáp Glanzen Claywax 60g (gốc)',              gv: 51248, ny: 249000 },
  { sku: 'XTP_007',     nhan: 'Glanzen', ten: 'Xịt tạo phồng Glanzen Booster 200ml (cũ)',    gv: 28072, ny: 249000 },
  { sku: 'XD_009',      nhan: 'Glanzen', ten: 'Xịt dưỡng tóc Glanzen Magic Spray 200ml',     gv: 28089, ny: 229000 },
  { sku: 'DG_269',      nhan: 'Laborie', ten: 'Bond Shampoo 250ml',                          gv: 123292, ny: 402000 },
  { sku: 'DG_273',      nhan: 'Laborie', ten: 'Detox Shampoo 250ml',                         gv: 123655, ny: 402000 },
  { sku: 'DG_272',      nhan: 'Laborie', ten: 'Scalp Shampoo 250ml',                         gv: 115263, ny: 402000 },
  { sku: 'DX_201',      nhan: 'Laborie', ten: 'Bond Conditioner 250ml',                      gv: 124974, ny: 402000 },
  { sku: 'TD_054',      nhan: 'Laborie', ten: 'Lipid Bond Hair Oil 30ml',                    gv: 115026, ny: 402000 },
  { sku: 'MN_046',      nhan: 'Laborie', ten: 'Molecular Repair Mask 100ml',                 gv: 115182, ny: 402000 },
  { sku: 'TD_053',      nhan: 'Laborie', ten: 'Molecular Repair Serum 30ml',                 gv: 115241, ny: 402000 },
  { sku: 'TC_005',      nhan: 'Dr. For Skin',   ten: 'Dabo Black Force Serum 120ml',                gv: 124308, ny: 629000 },
  { sku: 'SRM_097',     nhan: 'Dr. For Skin',   ten: 'SRM Teatrea 100g',                            gv: 61705, ny: 349000 },
  { sku: 'SRM_104',     nhan: 'Dr. For Skin',   ten: 'SRM Charcoal 100g',                           gv: 61863, ny: 229000 },
];

// CK cố định theo nhóm KH × nhãn
const CK_GROUPS = {
  N1: {
    ten: 'VIP — Đối tác chiến lược',
    mota: 'Nhà phân phối & chuỗi lớn toàn quốc',
    dieu_kien: 'Doanh số cam kết ≥ 300tr/năm · Hợp đồng phân phối chiến lược · Tham gia chương trình Co-Marketing',
    uu_tien: ['Giá B2B tốt nhất', 'Ưu tiên hàng mới & Limited', 'Hỗ trợ trưng bày, training', 'Sale chuyên biệt'],
    Glanzen: 0.60, Laborie: 0.35, 'Dr. For Skin': 0.40,
  },
  N2: {
    ten: 'Chuỗi & Sàn TMĐT',
    mota: 'Chuỗi salon đa chi nhánh và sàn thương mại điện tử',
    dieu_kien: 'Chuỗi ≥ 5 chi nhánh HOẶC sàn TMĐT uy tín · Doanh số ≥ 150tr/năm',
    uu_tien: ['CK cao theo số lượng', 'Hỗ trợ CTKM riêng', 'Giá sỉ ổn định'],
    Glanzen: 0.50, Laborie: 0.33, 'Dr. For Skin': 0.38,
  },
  N3: {
    ten: 'Đại lý sỉ khu vực',
    mota: 'Đại lý phân phối khu vực tỉnh/quận',
    dieu_kien: 'Đại lý có kho bãi · Doanh số ≥ 80tr/năm · Cam kết phân phối 3 nhãn',
    uu_tien: ['CK sỉ tốt', 'Hỗ trợ vận chuyển khu vực', 'Tham gia chương trình ưu đãi'],
    Glanzen: 0.45, Laborie: 0.30, 'Dr. For Skin': 0.35,
  },
  N4: {
    ten: 'Salon/Barber lớn',
    mota: 'Salon, Barber shop quy mô lớn (≥ 10 ghế)',
    dieu_kien: 'Salon/Barber ≥ 10 ghế · Đơn tối thiểu 5tr/lần · Ưu tiên lấy hàng định kỳ',
    uu_tien: ['CK hấp dẫn', 'Ưu tiên hàng Limited', 'Tham gia chương trình ưu đãi'],
    Glanzen: 0.35, Laborie: 0.25, 'Dr. For Skin': 0.33,
  },
  N5: {
    ten: 'Salon/Barber tiêu chuẩn',
    mota: 'Salon và cửa hàng tiêu chuẩn (< 10 ghế)',
    dieu_kien: 'Có giấy phép kinh doanh salon/barber · Đơn tối thiểu 3tr/lần',
    uu_tien: ['Giá sỉ cơ bản', 'Tham gia chương trình khi đạt min đơn'],
    Glanzen: 0.25, Laborie: 0.20, 'Dr. For Skin': 0.30,
  },
  NQ: {
    ten: 'Nhượng Quyền 30Shine',
    mota: 'Salon trong hệ thống nhượng quyền 30Shine',
    dieu_kien: 'Salon NQ đang hoạt động trong hệ thống · Áp dụng chính sách nội bộ',
    uu_tien: ['CT3 Laborie 50% — áp dụng chung', 'Giá nội bộ cho SP khác theo chính sách'],
    Glanzen: 0, Laborie: 0.50, 'Dr. For Skin': 0,
  },
};

// Thứ tự hiển thị ladder (thấp → cao)
const GROUP_LADDER = ['N5', 'N4', 'N3', 'N2', 'N1'];

// Chương trình KM
// ══════════════════════════════════════════════════════════════════
// 6 CHƯƠNG TRÌNH BÁN HÀNG — Tất cả nhóm đều mua được tất cả CT
// CT1-CT3: Mua Glanzen / Laborie → quà Glanzen / Laborie
// CT4-CT6: Mua Dr. For Skin → quà Glanzen / Laborie / Dr. For Skin
//
// Nguyên tắc:
// • CK tiền theo nhóm (bảng CK_GROUPS phía trên)
// • Quà tặng tăng giá trị theo bậc đơn (DT thực hoặc SL)
// • Bậc cuối cùng thiết kế sao cho N1: CK+quà ≈ 70% (Glanzen/Laborie)
//   và max 55% (Dr. For Skin)
// ══════════════════════════════════════════════════════════════════
const PROGRAMS = {

  // ─── GLANZEN ───────────────────────────────────────────────
  CT1: {
    ten: 'Glanzen × Glanzen',
    slogan: 'Mua Glanzen — Tặng Glanzen',
    nhom_apply: ['N1','N2','N3','N4','N5','NQ'],
    skus: ['SAP_GLZL60','SAP_080','GOM_016','GOM_017','XTP_009'],
    ck_nhan: 'Glanzen',
    tiers: [
      { ten: 'Bậc 1', min_dt_thuc: 5_000_000,
        qua_text: '1 Sáp Claywax 60g + 1 Magic Spray',
        qua: [{sku:'SAP_GLZ60', sl:1},{sku:'XD_009', sl:1}] },
      { ten: 'Bậc 2', min_dt_thuc: 10_000_000,
        qua_text: '3 Sáp Claywax 60g + 2 Magic Spray',
        qua: [{sku:'SAP_GLZ60', sl:3},{sku:'XD_009', sl:2}] },
      { ten: 'Bậc 3', min_dt_thuc: 20_000_000,
        qua_text: '5 Sáp Claywax + 3 Magic Spray + 2 Booster cũ',
        qua: [{sku:'SAP_GLZ60', sl:5},{sku:'XD_009', sl:3},{sku:'XTP_007', sl:2}] },
    ],
  },

  CT2: {
    ten: 'Glanzen × Laborie',
    slogan: 'Mua Glanzen — Tặng Laborie Premium',
    nhom_apply: ['N1','N2','N3','N4','N5','NQ'],
    skus: ['SAP_GLZL60','SAP_080','GOM_016','GOM_017','XTP_009'],
    ck_nhan: 'Glanzen',
    tiers: [
      { ten: 'Bậc 1', min_dt_thuc: 10_000_000,
        qua_text: '3 chai Laborie 250ml',
        qua_sl: 3, qua_options: ['DG_269','DG_273','DG_272','DX_201','TD_054','MN_046','TD_053'] },
      { ten: 'Bậc 2', min_dt_thuc: 20_000_000,
        qua_text: '5 Laborie 250ml + 2 Mask 100ml',
        qua_sl: 5, qua_fixed: [{sku:'MN_046', sl:2}] },
      { ten: 'Bậc 3', min_dt_thuc: 35_000_000,
        qua_text: '8 Laborie + 3 Mask + 2 Serum 30ml',
        qua_sl: 8, qua_fixed: [{sku:'MN_046', sl:3},{sku:'TD_053', sl:2}] },
      { ten: 'Bậc 4', min_dt_thuc: 50_000_000,
        qua_text: '12 Laborie + 5 Mask + 3 Serum 30ml',
        qua_sl: 12, qua_fixed: [{sku:'MN_046', sl:5},{sku:'TD_053', sl:3}] },
      { ten: 'VIP', min_dt_thuc: 80_000_000,
        qua_text: '20 Laborie + 5 Mask + 3 Serum + 1 Mask 500ml',
        qua_sl: 20, qua_fixed: [{sku:'MN_046', sl:5},{sku:'TD_053', sl:3}] },
    ],
  },

  // ─── LABORIE ───────────────────────────────────────────────
  CT3: {
    ten: 'Laborie Xả Kho',
    slogan: 'Giá 201.000đ/chai — Tặng kèm theo số chai mua',
    nhom_apply: ['N1','N2','N3','N4','N5','NQ'],
    skus: ['DG_269','DG_273','DG_272','DX_201','TD_054','MN_046','TD_053'],
    ck_nhan: 'Laborie', ck_fixed: 0.50,
    tier_by: 'qty',
    tiers: [
      { ten: 'Bậc 1', min_qty: 10,
        qua_text: 'Tặng 2 chai Laborie 250ml', qua_sl: 2 },
      { ten: 'Bậc 2', min_qty: 20,
        qua_text: 'Tặng 5 chai Laborie 250ml', qua_sl: 5 },
      { ten: 'Bậc 3', min_qty: 50,
        qua_text: 'Tặng 15 chai Laborie 250ml', qua_sl: 15 },
      { ten: 'Bậc 4', min_qty: 100,
        qua_text: 'Tặng 35 chai + 5 Mask 100ml',
        qua_sl: 35, qua_fixed: [{sku:'MN_046', sl:5}] },
    ],
  },

  // ─── DR. FOR SKIN ──────────────────────────────────────────
  // CK chính Dr. For Skin: N5 30% · N4 33% · N3 35% · N2 38% · N1 40%
  // Max CK + quà = 55%

  CT4: {
    ten: 'Dr. For Skin × Glanzen',
    slogan: 'Mua Dr. For Skin — Tặng Glanzen',
    nhom_apply: ['N1','N2','N3','N4','N5'],
    skus: ['TC_005','SRM_097','SRM_104'],
    ck_nhan: 'Dr. For Skin',
    // 3 bậc · Bậc 3: N1(40%)→gift ~12%→total 52% (dưới 55%)
    tiers: [
      { ten: 'Bậc 1', min_dt_thuc: 5_000_000,
        qua_text: '1 Sáp Claywax 60g + 1 Magic Spray',
        qua: [{sku:'SAP_GLZ60', sl:1},{sku:'XD_009', sl:1}] },
      { ten: 'Bậc 2', min_dt_thuc: 10_000_000,
        qua_text: '3 Sáp Claywax + 2 Magic Spray + 1 Booster cũ',
        qua: [{sku:'SAP_GLZ60', sl:3},{sku:'XD_009', sl:2},{sku:'XTP_007', sl:1}] },
      { ten: 'Bậc 3', min_dt_thuc: 20_000_000,
        qua_text: '8 Sáp Claywax + 5 Magic Spray + 3 Booster cũ',
        qua: [{sku:'SAP_GLZ60', sl:8},{sku:'XD_009', sl:5},{sku:'XTP_007', sl:3}] },
      // N5: NY~28.6tr · 13.6% · total 43.6%
    ],
  },

  CT5: {
    ten: 'Dr. For Skin × Laborie',
    slogan: 'Mua Dr. For Skin — Tặng Laborie Premium',
    nhom_apply: ['N1','N2','N3','N4','N5'],
    skus: ['TC_005','SRM_097','SRM_104'],
    ck_nhan: 'Dr. For Skin',
    // 5 bậc · VIP: N1(40%)→gift ~13%→total 53% (dưới 55%)
    tiers: [
      { ten: 'Bậc 1', min_dt_thuc: 3_000_000,
        qua_text: '1 chai Laborie 250ml (chọn loại)',
        qua_sl: 1, qua_options: ['DG_269','DG_273','DG_272','DX_201','TD_054','MN_046','TD_053'] },
      { ten: 'Bậc 2', min_dt_thuc: 5_000_000,
        qua_text: '2 Laborie 250ml + 1 Mask 100ml',
        qua_sl: 2, qua_fixed: [{sku:'MN_046', sl:1}] },
      { ten: 'Bậc 3', min_dt_thuc: 10_000_000,
        qua_text: '3 Laborie + 2 Mask + 1 Serum',
        qua_sl: 3, qua_fixed: [{sku:'MN_046', sl:2},{sku:'TD_053', sl:1}] },
      { ten: 'Bậc 4', min_dt_thuc: 15_000_000,
        qua_text: '4 Laborie + 2 Mask + 1 Serum',
        qua_sl: 4, qua_fixed: [{sku:'MN_046', sl:2},{sku:'TD_053', sl:1}] },
      { ten: 'VIP', min_dt_thuc: 25_000_000,
        qua_text: '8 Laborie + 3 Mask + 2 Serum + 1 Hair Oil',
        qua_sl: 8, qua_fixed: [{sku:'MN_046', sl:3},{sku:'TD_053', sl:2},{sku:'TD_054', sl:1}] },
      // N5: NY~35.7tr · 15.8% · total 45.8% ✓
    ],
  },

  CT6: {
    ten: 'Dr. For Skin × Dr. For Skin',
    slogan: 'Mua Dr. For Skin — Tặng Dr. For Skin',
    nhom_apply: ['N1','N2','N3','N4','N5'],
    skus: ['TC_005','SRM_097','SRM_104'],
    ck_nhan: 'Dr. For Skin',
    // 3 bậc · Bậc 3: N1(40%)→gift ~14%→total 54% (dưới 55%)
    tiers: [
      { ten: 'Bậc 1', min_dt_thuc: 3_000_000,
        qua_text: '1 SRM Charcoal 100g',
        qua: [{sku:'SRM_104', sl:1}] },
      { ten: 'Bậc 2', min_dt_thuc: 8_000_000,
        qua_text: '1 Dabo Serum + 1 SRM Teatrea',
        qua: [{sku:'TC_005', sl:1},{sku:'SRM_097', sl:1}] },
      { ten: 'Bậc 3', min_dt_thuc: 15_000_000,
        qua_text: '3 Dabo Serum + 3 SRM Teatrea + 2 SRM Charcoal',
        qua: [{sku:'TC_005', sl:3},{sku:'SRM_097', sl:3},{sku:'SRM_104', sl:2}] },
    ],
  },
};

// Chi phí vận hành (ước)
const COST_CONFIG = {
  ck_nv: 0.04,      // hoa hồng NV (trên DT thực thu)
  van_hanh: 0.05,   // chi phí kho/VC (trên DT thực thu)
  muc_tieu_ln_ny: 0.15,
};

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}
function fmtMoney(n) { return fmtNum(n) + 'đ'; }
function fmtPct(p) {
  if (p === null || p === undefined || isNaN(p)) return '—';
  return (p * 100).toFixed(1) + '%';
}
function skuById(id) { return MASTER_PRICE.find(s => s.sku === id); }
