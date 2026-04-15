# 30SHINE B2B Portal

Cổng thông tin chính sách giá & chương trình ưu đãi B2B / Nhượng Quyền 30Shine — Tháng 4/2026.

## Pha A (hiện tại) — Static HTML trên GitHub Pages

- `index.html` — Landing trang chủ
- `bang-gia.html` — Bảng giá 3 nhãn (Glanzen / Laborie / Dr.FS) + CK theo nhóm
- `chuong-trinh.html` — Chi tiết 3 chương trình CT1 / CT2 / CT3
- `sale.html` — Sale Portal: tạo đơn, tự tính bậc, PnL realtime, xuất báo giá PDF

## Pha B (sắp tới)

- Lark OAuth login (Sale + Admin)
- Cloudflare Worker proxy cho Lark Open API
- Nút **Lưu nháp / Gửi báo giá / Chốt đơn** ghi Lark Base
- Admin panel: sửa master giá, CK theo nhóm, user

## Tech

Vanilla HTML/CSS/JS — không build step. Deploy GitHub Pages thẳng.

## Brand

- Primary: `#1E3A8A` Royal Blue
- Accent: `#F5C518` Gold
- Font: Inter / Montserrat
