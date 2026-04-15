"""
Sync ảnh từ Lark Drive folder → assets/brand/
Chạy lại mỗi khi thêm/sửa/xoá ảnh trong folder Lark.
"""
import requests, json, re, sys
from pathlib import Path

APP_ID = 'cli_a93e680784785eee'
APP_SECRET = 'xRW6pe0OeMuhckxbh6faBhiGjfFkpEjC'
FOLDER_TOKEN = 'UMH8fhzHPlGEIqdK7dOl1nZRgic'  # folder Logo
OUT_DIR = Path(__file__).parent / 'assets' / 'brand'
OUT_DIR.mkdir(parents=True, exist_ok=True)

BASE = 'https://open.larksuite.com/open-apis'

def slug(name):
    # bỏ dấu tiếng Việt, chuyển về slug
    import unicodedata
    s = unicodedata.normalize('NFD', name)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.replace('Đ','D').replace('đ','d')
    s = re.sub(r'[^a-zA-Z0-9._-]+', '_', s).strip('_').lower()
    return s

def main():
    tok = requests.post(f'{BASE}/auth/v3/tenant_access_token/internal',
        json={'app_id': APP_ID, 'app_secret': APP_SECRET}).json()['tenant_access_token']
    H = {'Authorization': f'Bearer {tok}'}

    r = requests.get(f'{BASE}/drive/v1/files?folder_token={FOLDER_TOKEN}&page_size=100', headers=H).json()
    if r.get('code') != 0:
        print('Error:', r); sys.exit(1)

    files = r['data']['files']
    manifest = []
    for f in files:
        name = f['name']
        ftoken = f['token']
        ftype = f.get('type', '')
        if ftype != 'file':
            print(f'  skip non-file: {name}'); continue
        ext = Path(name).suffix.lower()
        if ext not in ['.png','.jpg','.jpeg','.svg','.webp','.gif']:
            print(f'  skip non-image: {name}'); continue
        local_name = slug(Path(name).stem) + ext
        out = OUT_DIR / local_name
        # Download media
        dl = requests.get(f'{BASE}/drive/v1/files/{ftoken}/download', headers=H)
        if dl.status_code == 200 and dl.content:
            out.write_bytes(dl.content)
            manifest.append({'original': name, 'file': local_name, 'token': ftoken})
            print(f'  ✓ {name}  →  {local_name}  ({len(dl.content):,} bytes)')
        else:
            print(f'  ✗ Lỗi tải {name}: HTTP {dl.status_code} — {dl.text[:200]}')

    mf = OUT_DIR / 'manifest.json'
    mf.write_text(json.dumps({'folder_token': FOLDER_TOKEN, 'files': manifest},
        ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'\nĐã sync {len(manifest)} file → {OUT_DIR}')
    print(f'Manifest: {mf}')

if __name__ == '__main__':
    main()
