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
- [ ] Seed khoa/phòng
- [ ] CRUD nhân sự
- [ ] CRUD khoa/phòng
- [ ] RBAC middleware
- [ ] Zalo OAuth thật
- [ ] Session/JWT nội bộ
- [ ] Dashboard dữ liệu thật
- [ ] Danh bạ có tìm kiếm
- [ ] Audit log cho thao tác quản trị

## Definition of done
1. CI xanh.
2. `docker compose up -d postgres` chạy PostgreSQL.
3. `npm run db:push` tạo schema.
4. Admin chạy ở port 3000.
5. API chạy ở port 4000 và `GET /health` trả `ok: true`.
6. Mini App chạy ở port 5173.
