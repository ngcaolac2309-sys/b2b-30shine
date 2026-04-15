"""
Setup Lark Base B2B 30Shine:
- 4 tables: Users, MasterPrice, Orders, OrderLines
- Seed MasterPrice từ file Excel, seed Users mặc định
"""
import requests, json, time, openpyxl
from pathlib import Path

APP_ID = 'cli_a93e680784785eee'
APP_SECRET = 'xRW6pe0OeMuhckxbh6faBhiGjfFkpEjC'
APP_TOKEN = 'OxKQbdhtuaoF1xssJjxlClBLgkc'
DEFAULT_TBL = 'tblkm0wF3sVprbZx'
BASE = 'https://open.larksuite.com/open-apis'

def get_token():
    r = requests.post(f'{BASE}/auth/v3/tenant_access_token/internal',
        json={'app_id': APP_ID, 'app_secret': APP_SECRET}).json()
    return r['tenant_access_token']

def H(token): return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

def create_table(token, name, fields):
    r = requests.post(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables',
        headers=H(token),
        json={'table': {'name': name, 'default_view_name': 'Grid', 'fields': fields}}).json()
    print(f'  create_table {name}:', r.get('code'), r.get('msg'))
    return r.get('data', {}).get('table_id')

def delete_table(token, tid):
    r = requests.delete(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables/{tid}', headers=H(token)).json()
    print(f'  delete_table {tid}:', r.get('code'))

def list_tables(token):
    r = requests.get(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables?page_size=50', headers=H(token)).json()
    return r.get('data', {}).get('items', [])

def batch_insert(token, tid, records):
    # Chunk 500
    for i in range(0, len(records), 500):
        chunk = records[i:i+500]
        r = requests.post(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables/{tid}/records/batch_create',
            headers=H(token),
            json={'records': [{'fields': f} for f in chunk]}).json()
        print(f'    insert {len(chunk)}:', r.get('code'), r.get('msg'))
        if r.get('code') != 0: print(json.dumps(r, ensure_ascii=False))
        time.sleep(0.3)

# Field types theo Lark API:
# 1 text, 2 number, 3 single_select, 4 multi_select, 5 datetime, 7 checkbox, 11 user, 13 phone, 15 url, 17 attachment
# 19 link (relation), 20 formula, 1001 create_time, 1002 last_modified_time

FIELDS_USERS = [
    {'field_name': 'Email', 'type': 1},
    {'field_name': 'Họ tên', 'type': 1},
    {'field_name': 'Role', 'type': 3, 'property': {'options': [
        {'name': 'admin', 'color': 0},
        {'name': 'sale',  'color': 1},
        {'name': 'view',  'color': 2},
    ]}},
    {'field_name': 'Active', 'type': 7},
    {'field_name': 'Ghi chú', 'type': 1},
    {'field_name': 'Created', 'type': 1001},
]

FIELDS_MASTER = [
    {'field_name': 'Mã SKU', 'type': 1},
    {'field_name': 'Tên SP', 'type': 1},
    {'field_name': 'Nhãn', 'type': 3, 'property': {'options': [
        {'name': 'Glanzen', 'color': 0},
        {'name': 'Laborie', 'color': 1},
        {'name': 'Dr.FS',   'color': 2},
    ]}},
    {'field_name': 'Giá vốn', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'Giá NY',  'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'CK N1', 'type': 2, 'property': {'formatter': '0.00'}},
    {'field_name': 'CK N2', 'type': 2, 'property': {'formatter': '0.00'}},
    {'field_name': 'CK N3', 'type': 2, 'property': {'formatter': '0.00'}},
    {'field_name': 'CK N4', 'type': 2, 'property': {'formatter': '0.00'}},
    {'field_name': 'CK N5', 'type': 2, 'property': {'formatter': '0.00'}},
    {'field_name': 'Active', 'type': 7},
]

FIELDS_ORDERS = [
    {'field_name': 'Mã đơn', 'type': 1},
    {'field_name': 'Ngày đặt', 'type': 5, 'property': {'date_formatter': 'yyyy-MM-dd', 'auto_fill': False}},
    {'field_name': 'KH', 'type': 1},
    {'field_name': 'SĐT', 'type': 1},
    {'field_name': 'Nhóm KH', 'type': 3, 'property': {'options': [
        {'name': n, 'color': i} for i, n in enumerate(['N1','N2','N3','N4','N5','NQ'])
    ]}},
    {'field_name': 'Chương trình', 'type': 3, 'property': {'options': [
        {'name': 'CT1', 'color': 0},
        {'name': 'CT2', 'color': 1},
        {'name': 'CT3', 'color': 2},
    ]}},
    {'field_name': 'Bậc', 'type': 1},
    {'field_name': 'DT NY', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'DT thực thu', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'COGS', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'GV quà', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'LN thuần', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': '% LN/NY', 'type': 2, 'property': {'formatter': '0.00%'}},
    {'field_name': 'Trạng thái', 'type': 3, 'property': {'options': [
        {'name': 'Báo giá', 'color': 0},
        {'name': 'Chốt đơn', 'color': 1},
        {'name': 'Đã giao', 'color': 2},
        {'name': 'Đã TT', 'color': 3},
        {'name': 'Huỷ', 'color': 4},
    ]}},
    {'field_name': 'Sale', 'type': 1},
    {'field_name': 'Ghi chú', 'type': 1},
    {'field_name': 'Created', 'type': 1001},
]

FIELDS_ORDER_LINES = [
    {'field_name': 'Mã đơn', 'type': 1},
    {'field_name': 'Mã SKU', 'type': 1},
    {'field_name': 'Tên SP', 'type': 1},
    {'field_name': 'Loại', 'type': 3, 'property': {'options': [
        {'name': 'Bán', 'color': 0},
        {'name': 'Quà', 'color': 1},
    ]}},
    {'field_name': 'SL', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'Giá NY', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'CK', 'type': 2, 'property': {'formatter': '0.00%'}},
    {'field_name': 'Giá sau CK', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'Thành tiền', 'type': 2, 'property': {'formatter': '0'}},
    {'field_name': 'Giá vốn', 'type': 2, 'property': {'formatter': '0'}},
]

def main():
    token = get_token()

    # Delete default empty table
    existing = list_tables(token)
    print('Existing tables:', [(t['name'], t['table_id']) for t in existing])

    # Create 4 tables
    tids = {}
    for name, fields in [
        ('Users', FIELDS_USERS),
        ('MasterPrice', FIELDS_MASTER),
        ('Orders', FIELDS_ORDERS),
        ('OrderLines', FIELDS_ORDER_LINES),
    ]:
        tid = create_table(token, name, fields)
        tids[name] = tid

    # Delete the default empty one
    for t in existing:
        if t['table_id'] == DEFAULT_TBL:
            delete_table(token, DEFAULT_TBL)

    # Seed MasterPrice từ Excel
    xlsx = Path(r'c:\Users\LAC\Downloads\CSGia_CTKM_B2B_T4_2026_TONG.xlsx')
    wb = openpyxl.load_workbook(xlsx, data_only=False)
    ws = wb['1.MASTER GIÁ']
    # Nhóm CK từ 2.NHÓM KH
    ws_n = wb['2.NHÓM KH']
    # Parse CK từng nhóm × nhãn
    def parse_ck(cell):
        if not cell: return 0
        s = str(cell).replace('%','').split('(')[0].strip()
        try: return float(s)/100
        except: return 0
    ck_map = {}
    for r in range(4, 9):  # N1-N5
        nhom = ws_n.cell(r, 1).value
        ck_map[nhom] = {
            'Glanzen': parse_ck(ws_n.cell(r, 4).value),
            'Laborie': parse_ck(ws_n.cell(r, 5).value),
            'Dr.FS':   parse_ck(ws_n.cell(r, 6).value),
        }

    master_records = []
    for r in range(4, 22):
        sku = ws.cell(r, 2).value
        if not sku: continue
        nhan = ws.cell(r, 3).value
        ten = ws.cell(r, 4).value
        gv = ws.cell(r, 5).value
        ny = ws.cell(r, 6).value
        rec = {
            'Mã SKU': sku,
            'Tên SP': ten,
            'Nhãn': nhan,
            'Giá vốn': gv,
            'Giá NY': ny,
            'Active': True,
        }
        for nhom in ['N1','N2','N3','N4','N5']:
            rec[f'CK {nhom}'] = ck_map.get(nhom, {}).get(nhan, 0)
        master_records.append(rec)
    print(f'\nSeeding {len(master_records)} SKU vào MasterPrice...')
    batch_insert(token, tids['MasterPrice'], master_records)

    # Seed Users mặc định
    users = [
        {'Email': 'ngcaolac2309@gmail.com', 'Họ tên': 'Admin', 'Role': 'admin', 'Active': True, 'Ghi chú': 'Owner'},
    ]
    print(f'\nSeeding {len(users)} Users...')
    batch_insert(token, tids['Users'], users)

    # Save config JSON
    config = {
        'app_token': APP_TOKEN,
        'tables': tids,
        'url': f'https://thirtyshine.sg.larksuite.com/base/{APP_TOKEN}',
    }
    Path(r'D:\WORK_STATION\VS Code\B2B 30Shine\base_config.json').write_text(
        json.dumps(config, ensure_ascii=False, indent=2), encoding='utf-8')
    print('\n=== DONE ===')
    print(json.dumps(config, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
