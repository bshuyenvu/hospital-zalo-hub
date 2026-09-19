# Sprint 1 — Foundation

## Mục tiêu

Có một hệ thống nội bộ chạy được, xác định đúng người dùng và có nền tảng phân quyền/audit trước khi thêm các tính năng nhắn tin hoặc AI.

## Checklist

- [x] Monorepo
- [x] PostgreSQL + Prisma schema
- [x] API service
- [x] Web Admin shell
- [x] Mini App shell
- [x] CI
- [x] Codespaces config
- [x] Seed khoa/phòng
- [x] CRUD nhân sự
- [x] CRUD khoa/phòng
- [x] RBAC middleware
- [ ] Zalo OAuth thật
- [x] Session/JWT nội bộ
- [x] Dashboard dữ liệu thật
- [x] Danh bạ có tìm kiếm
- [x] Audit log cho thao tác quản trị

## Bảo mật hiện tại

- Endpoint quản trị yêu cầu JWT.
- Phân quyền bằng role trước thao tác ghi.
- Xóa nghiệp vụ dùng soft-disable để giữ dấu vết.
- Audit ghi actor, hành động, entity, IP và user-agent.
- Dev login phải được tắt ở production bằng `ALLOW_DEV_AUTH=false`.
- Zalo App Secret/OA Secret chỉ cấu hình qua environment variables.

## Definition of done

1. CI xanh.
2. `docker compose up -d postgres` chạy PostgreSQL.
3. `npm run db:push` tạo schema.
4. `npm run db:seed` tạo danh mục mẫu và ADMIN001.
5. Admin chạy ở port 3000.
6. API chạy ở port 4000 và `GET /health` trả `ok: true`.
7. Mini App chạy ở port 5173.
8. CRUD/RBAC/dashboard/audit build thành công.
9. Checkpoint còn lại của Sprint 1: Zalo OAuth thật.
