# -*- coding: utf-8 -*-
"""Add field vào bảng Customers + Orders (non-destructive)."""
import sys, io, requests, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APP_ID = 'cli_a93e680784785eee'
APP_SECRET = 'xRW6pe0OeMuhckxbh6faBhiGjfFkpEjC'
APP_TOKEN = 'OxKQbdhtuaoF1xssJjxlClBLgkc'
BASE = 'https://open.larksuite.com/open-apis'

TBL_CUSTOMERS = 'tblEjS2mRdt4pn1E'
TBL_ORDERS    = 'tbliaoGSVMsnr6tI'

def tok():
    return requests.post(f'{BASE}/auth/v3/tenant_access_token/internal',
        json={'app_id': APP_ID, 'app_secret': APP_SECRET}).json()['tenant_access_token']

T = tok()
H = {'Authorization': f'Bearer {T}', 'Content-Type': 'application/json'}

def list_fields(tbl):
    r = requests.get(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables/{tbl}/fields?page_size=100',
                     headers=H).json()
    return [f['field_name'] for f in r.get('data', {}).get('items', [])]

def add_field(tbl, field_name, type_id, extra=None):
    existing = list_fields(tbl)
    if field_name in existing:
        print(f'  ⊘ {field_name}: đã tồn tại')
        return
    body = {'field_name': field_name, 'type': type_id}
    if extra: body.update(extra)
    r = requests.post(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables/{tbl}/fields',
                      headers=H, json=body).json()
    print(f'  + {field_name}: code={r.get("code")} msg={r.get("msg")}')

print('═══ Customers: thêm Email HĐ, CCCD, Họ tên người đại diện ═══')
print('Existing fields:', list_fields(TBL_CUSTOMERS))
add_field(TBL_CUSTOMERS, 'Email HĐ', 1)
add_field(TBL_CUSTOMERS, 'CCCD', 1)
add_field(TBL_CUSTOMERS, 'Họ tên người đại diện', 1)

print('\n═══ Orders: thêm Địa chỉ giao đơn, SĐT nhận, Người nhận ═══')
print('Existing fields:', list_fields(TBL_ORDERS))
add_field(TBL_ORDERS, 'Địa chỉ giao', 1)
add_field(TBL_ORDERS, 'SĐT nhận hàng', 1)
add_field(TBL_ORDERS, 'Người nhận hàng', 1)

print('\n✓ DONE')
