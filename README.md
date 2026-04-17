# 30SHINE B2B Portal

Cổng thông tin chính sách giá & chương trình ưu đãi B2B / Nhượng Quyền 30Shine — Tháng 4/2026.

## Trang chính

- `index.html` — Landing page: 6 chương trình, 3 nhãn hàng, 5 bậc đại lý
- `uu-dai.html` — Chi tiết 6 CT (CT1-CT6: Glanzen / Laborie / Dr. For Skin) + bảng CK 5 bậc
- `sale.html` — Sale Portal: chọn KH (autocomplete), tạo đơn, PnL realtime, PDF báo giá
- `admin.html` — Admin: Users, Khách hàng (97 KH, CK override, duyệt bậc), Master giá, Đơn hàng
- `don-hang.html` — Lịch sử đơn hàng
- `login.html` — Lark OAuth login

## Backend

- Cloudflare Worker (`worker/worker.js`) — OAuth + CRUD Orders/Customers/Users/Master
- Lark Base — 5 bảng: Users, MasterPrice, Orders, OrderLines, Customers

## Tech

Vanilla HTML/CSS/JS — không build step. Deploy GitHub Pages thẳng.

## Brand

- Primary: `#1E3A8A` Royal Blue
- Accent: `#F5C518` Gold
- Font: Inter / Montserrat
