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
- [x] Zalo OAuth V4 + PKCE
- [x] Session/JWT nội bộ
- [x] Dashboard dữ liệu thật
- [x] Danh bạ có tìm kiếm
- [x] Audit log
- [x] Mini App → Zalo token → backend → JWT nội bộ
- [ ] Cấu hình App ID/App Secret thật trên môi trường triển khai
- [ ] Khởi tạo Mini App bằng Mini App ID thật và kiểm thử Device Mode

## Bảo mật hiện tại

- Endpoint quản trị yêu cầu JWT.
- Phân quyền bằng role trước thao tác ghi.
- Xóa nghiệp vụ dùng soft-disable để giữ dấu vết.
- Audit ghi actor, hành động, entity, IP và user-agent.
- Dev login phải được tắt ở production bằng `ALLOW_DEV_AUTH=false`.
- App Secret chỉ tồn tại phía server.
- OAuth dùng PKCE + state.
- Callback dùng one-time ticket 2 phút, không đưa JWT vào URL.
- Zalo account chỉ được link sau khi người dùng đã có phiên nội bộ hợp lệ.

## Definition of done

1. CI xanh.
2. PostgreSQL + schema + seed chạy được.
3. Web Admin/API/Mini App build thành công.
4. OAuth flow build và typecheck thành công.
5. Dependency audit không còn lỗi high/critical có thể sửa bằng upgrade hợp lý.
