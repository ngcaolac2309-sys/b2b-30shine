# -*- coding: utf-8 -*-
"""
Tạo bảng Customers trong Lark Base + import 97 KH đã phân loại.
Bảng này được đọc bởi Worker để:
- Dropdown KH trong sale.html
- Admin quản lý info KH + CK override
- Track DT tích lũy → auto-suggest promotion
"""
import requests, json, time, sys, io
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APP_ID = 'cli_a93e680784785eee'
APP_SECRET = 'xRW6pe0OeMuhckxbh6faBhiGjfFkpEjC'
APP_TOKEN = 'OxKQbdhtuaoF1xssJjxlClBLgkc'
BASE = 'https://open.larksuite.com/open-apis'
CONFIG_PATH = Path(r'D:\WORK_STATION\VS Code\B2B 30Shine\base_config.json')
KH_JSON = Path(r'D:\WORK_STATION\VS Code\B2B 30Shine\phan_loai_kh\phan_loai_kh_b2b_2025_v2.json')

def get_token():
    r = requests.post(f'{BASE}/auth/v3/tenant_access_token/internal',
        json={'app_id': APP_ID, 'app_secret': APP_SECRET}).json()
    return r['tenant_access_token']

def H(token): return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

def list_tables(token):
    r = requests.get(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables?page_size=50',
                     headers=H(token)).json()
    return r.get('data', {}).get('items', [])

def create_table(token, name, fields):
    r = requests.post(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables',
        headers=H(token),
        json={'table': {'name': name, 'default_view_name': 'Grid', 'fields': fields}}).json()
    print(f'create_table {name}: code={r.get("code")} msg={r.get("msg")}')
    return r.get('data', {}).get('table_id')

def batch_insert(token, tid, records):
    ok = 0
    for i in range(0, len(records), 500):
        chunk = records[i:i+500]
        r = requests.post(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables/{tid}/records/batch_create',
            headers=H(token),
            json={'records': [{'fields': f} for f in chunk]}).json()
        print(f'  insert {len(chunk)}: code={r.get("code")} msg={r.get("msg")}')
        if r.get('code') == 0: ok += len(chunk)
        else: print('   ERR:', json.dumps(r, ensure_ascii=False)[:400])
        time.sleep(0.3)
    return ok

# ═══ FIELD SCHEMA ═══
# Types: 1 text, 2 number, 3 single_select, 4 multi_select, 5 datetime, 7 checkbox
FIELDS_CUSTOMERS = [
    {'field_name': 'Mã KH', 'type': 1},         # MaKH_xx (unique identifier)
    {'field_name': 'Tên KH', 'type': 1},        # Tên shop/đơn vị
    {'field_name': 'SĐT', 'type': 1},
    {'field_name': 'Khu vực', 'type': 3, 'property': {'options': [
        {'name': 'HN', 'color': 0},
        {'name': 'HCM', 'color': 1},
        {'name': 'Tỉnh khác', 'color': 2},
    ]}},
    {'field_name': 'Nhóm KH', 'type': 3, 'property': {'options': [
        {'name': n, 'color': i} for i, n in enumerate(['N1','N2','N3','N4','N5','NQ'])
    ]}},
    {'field_name': 'Loại hình', 'type': 3, 'property': {'options': [
        {'name': 'Salon/Barber', 'color': 0},
        {'name': 'Chuỗi',        'color': 1},
        {'name': 'NPP/Đại lý',   'color': 2},
        {'name': 'Ecom',         'color': 3},
        {'name': 'Spa',          'color': 4},
        {'name': 'Cá nhân',      'color': 5},
        {'name': 'Khác',         'color': 6},
    ]}},
    {'field_name': 'Sale phụ trách', 'type': 1},
    {'field_name': 'Địa chỉ giao hàng', 'type': 1},
    {'field_name': 'Địa chỉ giao 2', 'type': 1},
    {'field_name': 'Tên đặt chuẩn', 'type': 1},        # Tên đầy đủ cho hóa đơn
    {'field_name': 'Mã số thuế', 'type': 1},
    {'field_name': 'Thông tin xuất HĐ', 'type': 1},
    # ---- CK override (nếu khác chuẩn) ----
    {'field_name': 'CK Glanzen (override)', 'type': 2, 'property': {'formatter': '0.00%'}},
    {'field_name': 'CK Laborie (override)', 'type': 2, 'property': {'formatter': '0.00%'}},
    {'field_name': 'CK Dr.FS (override)',   'type': 2, 'property': {'formatter': '0.00%'}},
    # ---- DT tích lũy (update định kỳ) ----
    {'field_name': 'DT NY YTD', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'DT Thực YTD', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'Số đơn YTD', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'Số tháng mua', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'Mua gần nhất', 'type': 1},
    # ---- Nhóm đề xuất (tự tính khi đạt ngưỡng) ----
    {'field_name': 'Nhóm đề xuất', 'type': 3, 'property': {'options': [
        {'name': n, 'color': i} for i, n in enumerate(['N1','N2','N3','N4','N5','NQ'])
    ]}},
    {'field_name': 'Chờ duyệt lên bậc', 'type': 7},
    {'field_name': 'Ghi chú', 'type': 1},
    {'field_name': 'Active', 'type': 7},
    {'field_name': 'Created', 'type': 1001},
]

# ═══ MAP phân loại → loại hình (gợi ý) ═══
def infer_loai_hinh(ten, mo_ta):
    t = (ten or '').lower()
    if 'npp' in t or 'nhà phân phối' in t or 'phân phối' in t or 'đại lý' in t:
        return 'NPP/Đại lý'
    if 'ecom' in (mo_ta or '').lower() or 'sendo' in t or 'socialla' in t or 'buymed' in t:
        return 'Ecom'
    if 'chuỗi' in (mo_ta or '').lower() or 'hệ thống' in t or 'men\'s store' in t:
        return 'Chuỗi'
    if 'spa' in t: return 'Spa'
    if 'salon' in t or 'barber' in t or 'tóc' in t or 'hair' in t or 'shop' in t:
        return 'Salon/Barber'
    return 'Khác'

def norm_area(kv):
    """'HN / HCM' → 'HCM' (area chính). Nếu có HN → HN. Nếu ko có → 'Tỉnh khác'."""
    if not kv: return 'Tỉnh khác'
    parts = [p.strip() for p in str(kv).split('/')]
    if 'HCM' in parts: return 'HCM'
    if 'HN' in parts: return 'HN'
    return 'Tỉnh khác'

def main():
    token = get_token()
    existing = list_tables(token)
    print('Existing tables:')
    for t in existing:
        print(f'  {t["name"]:<20} → {t["table_id"]}')

    # Check đã có Customers chưa
    cust_tbl = next((t for t in existing if t['name'] == 'Customers'), None)
    if cust_tbl:
        print(f'\n⚠️ Table "Customers" đã tồn tại: {cust_tbl["table_id"]}')
        print('Chạy với flag --recreate để xoá + tạo lại. Mặc định: skip create, chỉ đảm bảo có table.')
        if '--recreate' in sys.argv:
            r = requests.delete(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables/{cust_tbl["table_id"]}',
                                headers=H(token)).json()
            print(f'  delete: {r.get("code")}')
            cust_tbl = None
        if '--skip-import' in sys.argv:
            print('--skip-import set → thoát.')
            return

    if not cust_tbl:
        tid = create_table(token, 'Customers', FIELDS_CUSTOMERS)
    else:
        tid = cust_tbl['table_id']

    print(f'\n✓ Customers table_id = {tid}\n')

    # ═══ Load 97 KH từ JSON ═══
    if not KH_JSON.exists():
        print(f'⚠️ Không tìm thấy {KH_JSON}. Skip import.')
        return
    with open(KH_JSON, 'r', encoding='utf-8') as f:
        kh_list = json.load(f)
    print(f'Load {len(kh_list)} KH từ {KH_JSON.name}')

    # ═══ Generate Mã KH ═══
    # Dùng ma_cn_kh nếu có, ngược lại generate MaKH_AUTO_xxx
    records = []
    auto_counter = 1000
    for kh in kh_list:
        ma_cn = kh.get('ma_cn_kh', '').strip()
        if ma_cn:
            ma_kh = ma_cn.split(' / ')[0].strip()
        else:
            ma_kh = f'MaKH_AUTO_{auto_counter}'
            auto_counter += 1

        area = norm_area(kh.get('khu_vuc', ''))
        loai_hinh = infer_loai_hinh(kh.get('ten_kh', ''), kh.get('mo_ta', ''))
        rec = {
            'Mã KH': ma_kh,
            'Tên KH': kh.get('ten_kh', '')[:100],
            'SĐT': kh.get('sdt', '').split(' / ')[0].strip(),
            'Khu vực': area,
            'Nhóm KH': kh.get('nhom', 'N5'),
            'Loại hình': loai_hinh,
            'Sale phụ trách': kh.get('seller', '').split(' / ')[0].strip(),
            'DT NY YTD': int(kh.get('dt_niem_yet', 0)),
            'DT Thực YTD': int(kh.get('dt_thuc_thu', 0)),
            'Số đơn YTD': int(kh.get('so_don', 0)),
            'Số tháng mua': int(kh.get('so_thang_mua', 0)),
            'Mua gần nhất': kh.get('last_date', ''),
            'Nhóm đề xuất': kh.get('nhom', 'N5'),
            'Ghi chú': f"Import tự động từ data 2025. Tên gốc: {kh.get('ten_raw_list', '')[:200]}",
            'Active': True,
        }
        records.append(rec)

    print(f'\nImporting {len(records)} KH vào Customers...')
    ok = batch_insert(token, tid, records)
    print(f'\n✓ Imported {ok}/{len(records)} KH')

    # Update base_config.json
    if CONFIG_PATH.exists():
        cfg = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
        cfg.setdefault('tables', {})['Customers'] = tid
        CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'✓ Updated {CONFIG_PATH}')

    print('\n═══ DONE ═══')
    print(f'Customers table ID: {tid}')
    print(f'Nhớ thêm vào Cloudflare Worker env: TBL_CUSTOMERS = {tid}')

if __name__ == '__main__':
    main()
