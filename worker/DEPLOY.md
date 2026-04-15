# Deploy Cloudflare Worker — Hướng dẫn

## Cách 1: Dashboard (dễ nhất, 5 phút)

1. Vào https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**
2. Đặt tên worker: **`b2b-30shine-api`** → **Deploy**
3. Sau khi deploy xong → **Edit code** → xoá code mẫu → paste toàn bộ `worker.js` → **Deploy**
4. Vào tab **Settings** → **Variables**:

### Environment Variables (plain)
| Name | Value |
|---|---|
| `BASE_TOKEN` | `OxKQbdhtuaoF1xssJjxlClBLgkc` |
| `TBL_USERS` | `tblxrn5eM82mwbji` |
| `TBL_MASTER` | `tblFXOMf6rEZ6Bj0` |
| `TBL_ORDERS` | `tbliaoGSVMsnr6tI` |
| `TBL_LINES` | `tblPbSZyadpk6dFG` |
| `SITE_ORIGIN` | `https://ngcaolac2309-sys.github.io` |
| `SITE_BASE_PATH` | `/b2b-30shine` |

### Secrets (click "Encrypt")
| Name | Value |
|---|---|
| `LARK_APP_ID` | `cli_a93e680784785eee` |
| `LARK_APP_SECRET` | `xRW6pe0OeMuhckxbh6faBhiGjfFkpEjC` |
| `SESSION_SECRET` | (random 32 ký tự — VD: `b2b-30sh1ne-s3cret-2026-xR7Wp9Q`) |

5. Sau khi set xong Variables → **Save and Deploy**
6. Copy URL worker (VD: `https://b2b-30shine-api.your-name.workers.dev`)

## Cập nhật Lark App — cho phép OAuth

Vào https://open.larksuite.com → chọn app **B2B 30Shine** → **Security Settings** → **Redirect URL**:
```
https://b2b-30shine-api.your-name.workers.dev/auth/callback
```

**Permissions cần bật:**
- `authen:user.email:read` — lấy email user khi login
- `authen:user_profile:read` — lấy tên/avatar
- `bitable:app` — đọc/ghi Base

Sau khi đổi permissions → **Create Version & Release** để publish lại.

## Test

Mở: `https://b2b-30shine-api.your-name.workers.dev/health`
→ Phải thấy `{"ok":true,"time":"..."}`.

## Báo lại cho Claude

Khi deploy xong, báo tôi **URL worker** để tôi cập nhật frontend trỏ đúng endpoint.
