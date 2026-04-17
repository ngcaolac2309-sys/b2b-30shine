# -*- coding: utf-8 -*-
"""Sync Lark Base MasterPrice với data.js hiện tại (gv BQGQ + CK mới)."""
import sys, io, requests, json, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APP_ID = 'cli_a93e680784785eee'
APP_SECRET = 'xRW6pe0OeMuhckxbh6faBhiGjfFkpEjC'
APP_TOKEN = 'OxKQbdhtuaoF1xssJjxlClBLgkc'
TBL = 'tblFXOMf6rEZ6Bj0'
BASE = 'https://open.larksuite.com/open-apis'

# Giá vốn BQGQ mới + CK mới từ data.js
UPDATES = {
    'SAP_GLZL60': {'gv': 51395, 'ny': 500000},
    'SAP_080':    {'gv': 47849, 'ny': 349000},
    'GOM_016':    {'gv': 41396, 'ny': 349000},
    'GOM_017':    {'gv': 41395, 'ny': 249000},
    'XTP_009':    {'gv': 56021, 'ny': 340000},
    'SAP_GLZ60':  {'gv': 52329, 'ny': 249000},
    'XTP_007':    {'gv': 28082, 'ny': 249000},
    'XD_009':     {'gv': 28542, 'ny': 229000},
    'DG_269':     {'gv': 119544, 'ny': 402000},
    'DG_273':     {'gv': 115528, 'ny': 402000},
    'DG_272':     {'gv': 115264, 'ny': 402000},
    'DX_201':     {'gv': 115182, 'ny': 402000},
    'TD_054':     {'gv': 115267, 'ny': 402000},
    'MN_046':     {'gv': 115182, 'ny': 402000},
    'TD_053':     {'gv': 115182, 'ny': 402000},
    'TC_005':     {'gv': 124256, 'ny': 629000},
    'SRM_097':    {'gv': 61996, 'ny': 349000},
    'SRM_104':    {'gv': 61831, 'ny': 229000},
}

# CK mới theo nhãn
CK_BY_BRAND = {
    'Glanzen':       {'N1': 0.60, 'N2': 0.50, 'N3': 0.45, 'N4': 0.35, 'N5': 0.25},
    'Laborie':       {'N1': 0.45, 'N2': 0.41, 'N3': 0.37, 'N4': 0.34, 'N5': 0.30},
    'Dr. For Skin':  {'N1': 0.40, 'N2': 0.38, 'N3': 0.35, 'N4': 0.33, 'N5': 0.30},
}

tok = requests.post(f'{BASE}/auth/v3/tenant_access_token/internal',
    json={'app_id': APP_ID, 'app_secret': APP_SECRET}).json()['tenant_access_token']
H = {'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json'}

# Fetch existing records
r = requests.get(f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables/{TBL}/records?page_size=100',
                 headers=H).json()
items = r['data']['items']
print(f'Lark Base MasterPrice: {len(items)} records\n')

def pick(v):
    if isinstance(v, str): return v
    if isinstance(v, dict) and 'text' in v: return v['text']
    if isinstance(v, list) and v and isinstance(v[0], dict): return v[0].get('text','')
    return str(v) if v else ''

updates = []
for it in items:
    f = it['fields']
    sku = pick(f.get('Mã SKU', ''))
    nhan = pick(f.get('Nhãn', ''))
    if sku not in UPDATES: continue

    u = UPDATES[sku]
    ck = CK_BY_BRAND.get(nhan, {})
    patch = {
        'Giá vốn': u['gv'],
        'Giá NY': u['ny'],
    }
    for n in ['N1','N2','N3','N4','N5']:
        if n in ck:
            patch[f'CK {n}'] = ck[n]

    old_gv = f.get('Giá vốn', 0) or 0
    old_ny = f.get('Giá NY', 0) or 0
    changed = old_gv != u['gv'] or old_ny != u['ny']
    for n in ['N1','N2','N3','N4','N5']:
        old_ck = float(f.get(f'CK {n}', 0) or 0)
        if n in ck and abs(old_ck - ck[n]) > 0.001: changed = True

    if changed:
        updates.append({'record_id': it['record_id'], 'fields': patch})
        print(f'  UPDATE {sku:<14} gv {old_gv:>8} → {u["gv"]:>8} | ny {old_ny:>8} → {u["ny"]:>8}')

if not updates:
    print('\nKhông có thay đổi.')
else:
    print(f'\n═══ Updating {len(updates)} records ═══')
    r = requests.post(
        f'{BASE}/bitable/v1/apps/{APP_TOKEN}/tables/{TBL}/records/batch_update',
        headers=H, json={'records': updates}).json()
    print(f'code={r.get("code")} msg={r.get("msg")}')

print('\n✓ DONE')
