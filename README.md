# Hospital Zalo Hub

Cổng nội bộ bệnh viện tích hợp Zalo OA + Zalo Mini App + Web Admin + API.

## MVP hiện tại

- JWT + RBAC 7 vai trò
- Quản lý nhân sự
- Quản lý khoa/phòng
- Danh bạ nội bộ có tìm kiếm
- Dashboard quản trị dữ liệu thật
- Audit log
- Skeleton Zalo Mini App
- Callback Zalo OAuth đã có điểm nối, chờ cấu hình App/OA thật

## Kiến trúc

- `apps/admin`: Next.js Web Admin
- `apps/api`: Fastify REST API
- `apps/miniapp`: React + Vite, khung Zalo Mini App
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
6. Vào Web Admin ở port **3000** và chọn **Đăng nhập ADMIN001**.

Tài khoản phát triển chỉ hoạt động khi `ALLOW_DEV_AUTH=true`. Khi deploy production phải đặt `ALLOW_DEV_AUTH=false` và dùng secret đủ mạnh.

## Nguyên tắc dữ liệu

Không commit khóa bí mật, token Zalo, mật khẩu production hoặc dữ liệu bệnh nhân vào repository. Hội chẩn có thông tin người bệnh chỉ được mở sau khi hoàn thiện phân quyền, audit, mã hóa và chính sách lưu trữ phù hợp.
