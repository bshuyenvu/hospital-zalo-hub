# Hospital Zalo Hub

Cổng nội bộ bệnh viện tích hợp Zalo OA + Zalo Mini App + Web Admin + API.

## Mục tiêu MVP
- Đăng nhập/nhận diện người dùng nội bộ
- Danh bạ nhân sự theo khoa/phòng
- Phân quyền cơ bản
- Dashboard quản trị
- Audit log
- Nền tảng sẵn sàng để tích hợp Zalo OA, thông báo, file và AI ở các sprint sau

## Kiến trúc
- `apps/admin`: Next.js Web Admin
- `apps/api`: Fastify REST API
- `apps/miniapp`: React + Vite, khung Zalo Mini App
- `packages/db`: Prisma + PostgreSQL
- `docs`: tài liệu kiến trúc và sprint

> Không commit khóa bí mật, token Zalo hoặc dữ liệu bệnh nhân vào repository.
