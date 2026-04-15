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
  { sku: 'TC_005',      nhan: 'Dr.FS',   ten: 'Dabo Black Force Serum 120ml',                gv: 124308, ny: 629000 },
  { sku: 'SRM_097',     nhan: 'Dr.FS',   ten: 'SRM Teatrea 100g',                            gv: 61705, ny: 349000 },
  { sku: 'SRM_104',     nhan: 'Dr.FS',   ten: 'SRM Charcoal 100g',                           gv: 61863, ny: 229000 },
];

// CK cố định theo nhóm KH × nhãn
const CK_GROUPS = {
  N1: { ten: 'VIP Đối tác chiến lược', mota: 'Nhà phân phối & chuỗi lớn toàn quốc',          Glanzen: 0.60, Laborie: 0.35, 'Dr.FS': 0.45 },
  N2: { ten: 'Chuỗi & Sàn TMĐT',       mota: 'Chuỗi salon đa chi nhánh và sàn thương mại điện tử', Glanzen: 0.50, Laborie: 0.33, 'Dr.FS': 0.40 },
  N3: { ten: 'Đại lý sỉ',              mota: 'Đại lý phân phối khu vực',                     Glanzen: 0.45, Laborie: 0.30, 'Dr.FS': 0.35 },
  N4: { ten: 'Salon/Barber lớn',       mota: 'Salon, Barber shop quy mô lớn',                Glanzen: 0.35, Laborie: 0.25, 'Dr.FS': 0.30 },
  N5: { ten: 'Salon/Barber tiêu chuẩn',mota: 'Salon và cửa hàng tiêu chuẩn',                 Glanzen: 0.25, Laborie: 0.20, 'Dr.FS': 0.20 },
  NQ: { ten: 'Nhượng Quyền 30Shine',   mota: 'Salon trong hệ thống NQ 30Shine',              Glanzen: 0,    Laborie: 0.50, 'Dr.FS': 0   },
};

// Chương trình KM
const PROGRAMS = {
  CT1: {
    ten: 'Glanzen × Glanzen',
    slogan: 'Mua Glanzen — Tặng Glanzen',
    nhom_apply: ['N3','N4','N5'],
    skus: ['SAP_GLZL60','SAP_080','GOM_016','GOM_017','XTP_009'],
    ck_nhan: 'Glanzen',
    tiers: [
      { ten: 'Bậc 1', min_dt_thuc: 5_000_000,  qua_text: '1 Sáp Claywax 60g + 1 Magic Spray',
        qua: [{sku:'SAP_GLZ60', sl:1},{sku:'XD_009', sl:1}] },
      { ten: 'Bậc 2', min_dt_thuc: 10_000_000, qua_text: '3 Sáp Claywax 60g + 2 Magic Spray',
        qua: [{sku:'SAP_GLZ60', sl:3},{sku:'XD_009', sl:2}] },
      { ten: 'Bậc 3', min_dt_thuc: 20_000_000, qua_text: '5 Sáp Claywax + 3 Magic Spray + 2 Booster cũ',
        qua: [{sku:'SAP_GLZ60', sl:5},{sku:'XD_009', sl:3},{sku:'XTP_007', sl:2}] },
    ],
  },
  CT2: {
    ten: 'Glanzen × Laborie',
    slogan: 'Mua Glanzen — Tặng Laborie Premium',
    nhom_apply: ['N1','N2'],
    skus: ['SAP_GLZL60','SAP_080','GOM_016','GOM_017','XTP_009'],
    ck_nhan: 'Glanzen',
    tiers: [
      { ten: 'Bậc 1', min_dt_thuc: 10_000_000, qua_text: '3 chai Laborie 250ml',
        qua_sl: 3, qua_options: ['DG_269','DG_273','DG_272','DX_201','TD_054','MN_046','TD_053'] },
      { ten: 'Bậc 2', min_dt_thuc: 20_000_000, qua_text: '5 Laborie 250ml + 2 Mask 100ml',
        qua_sl: 5, qua_fixed: [{sku:'MN_046', sl:2}] },
      { ten: 'Bậc 3', min_dt_thuc: 35_000_000, qua_text: '8 Laborie + 3 Mask + 2 Serum 30ml',
        qua_sl: 8, qua_fixed: [{sku:'MN_046', sl:3},{sku:'TD_053', sl:2}] },
      { ten: 'Bậc 4', min_dt_thuc: 50_000_000, qua_text: '12 Laborie + 5 Mask + 3 Serum 30ml',
        qua_sl: 12, qua_fixed: [{sku:'MN_046', sl:5},{sku:'TD_053', sl:3}] },
      { ten: 'VIP',   min_dt_thuc: 80_000_000, qua_text: '20 Laborie + 5 Mask + 3 Serum + 1 Mask 500ml',
        qua_sl: 20, qua_fixed: [{sku:'MN_046', sl:5},{sku:'TD_053', sl:3}] },
    ],
  },
  CT3: {
    ten: 'Laborie Xả Kho',
    slogan: 'Giá 201.000đ/chai — Tặng kèm theo số chai mua',
    nhom_apply: ['N1','N2','N3','N4','N5','NQ'],
    skus: ['DG_269','DG_273','DG_272','DX_201','TD_054','MN_046','TD_053'],
    ck_nhan: 'Laborie', ck_fixed: 0.50,
    tier_by: 'qty', // theo số chai, không theo tiền
    tiers: [
      { ten: 'Bậc 1', min_qty: 10,  qua_text: 'Tặng 2 chai Laborie 250ml', qua_sl: 2 },
      { ten: 'Bậc 2', min_qty: 20,  qua_text: 'Tặng 5 chai Laborie 250ml', qua_sl: 5 },
      { ten: 'Bậc 3', min_qty: 50,  qua_text: 'Tặng 15 chai Laborie 250ml', qua_sl: 15 },
      { ten: 'Bậc 4', min_qty: 100, qua_text: 'Tặng 35 chai + 5 Mask 100ml', qua_sl: 35,
        qua_fixed: [{sku:'MN_046', sl:5}] },
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
