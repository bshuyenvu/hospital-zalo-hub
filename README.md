# Hospital Zalo Hub

Cổng nội bộ bệnh viện tích hợp Zalo OA + Zalo Mini App + Web Admin + API.

## MVP hiện tại

- JWT + RBAC 7 vai trò
- Quản lý nhân sự và khoa/phòng
- Danh bạ nội bộ có tìm kiếm
- Dashboard + Audit log
- Zalo Social OAuth V4 với PKCE/state
- Liên kết Zalo ↔ hồ sơ nhân sự nội bộ
- One-time auth ticket, không đưa JWT vào callback URL
- Zalo Mini App dùng `getAccessToken()` rồi xác minh ở backend

## Kiến trúc

- `apps/admin`: Next.js Web Admin
- `apps/api`: Fastify REST API
- `apps/miniapp`: React + Vite + Zalo Mini App SDK
- `packages/db`: Prisma + PostgreSQL
- `docs`: tài liệu kiến trúc và sprint

## Chạy thử trong GitHub Codespaces

1. Mở repository → **Code** → **Codespaces** → tạo Codespace.
2. Tạo file môi trường:
   ```bash
   cp .env.example .env
   ```
3. Khởi động PostgreSQL:
   ```bash
   docker compose up -d postgres
   ```
4. Tạo schema và dữ liệu mẫu:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```
5. Mở 3 terminal:
   ```bash
   npm run dev:api
   npm run dev:admin
   npm run dev:miniapp
   ```

## Cấu hình Zalo Social OAuth V4

Trong Zalo for Developers, cấu hình Callback URL trùng chính xác với `ZALO_REDIRECT_URI`.

Biến môi trường bắt buộc:

```env
ZALO_APP_ID=
ZALO_APP_SECRET=
ZALO_REDIRECT_URI=https://api.example.vn/v1/auth/zalo/callback
ZALO_AUTH_SUCCESS_REDIRECT=https://hub.example.vn/auth/zalo/callback
```

Luồng an toàn:

1. Nhân sự đăng nhập nội bộ trước.
2. Chọn **Liên kết Zalo**.
3. Backend tạo PKCE verifier/challenge + state.
4. Zalo callback về API.
5. Backend xác minh profile Zalo và ghi `zaloUserId` vào đúng nhân sự.
6. Callback chỉ mang one-time ticket về Web Admin.
7. Web Admin đổi ticket lấy JWT nội bộ.

Sau khi đã liên kết, người dùng có thể đăng nhập bằng Zalo trực tiếp.

## Zalo Mini App

Project hiện có SDK `zmp-sdk`. Với Mini App ID thật, chạy `zmp init` trong `apps/miniapp`, sau đó kiểm thử bằng Device Mode.

Mini App gọi `getAccessToken()`, nhưng app secret và các API server-to-server tuyệt đối không đặt trong client.

## Nguyên tắc dữ liệu

Không commit khóa bí mật, token Zalo, mật khẩu production hoặc dữ liệu bệnh nhân vào repository. Hội chẩn có thông tin người bệnh chỉ được mở sau khi hoàn thiện phân quyền, audit, mã hóa và chính sách lưu trữ phù hợp.
