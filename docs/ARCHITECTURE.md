# Architecture — Hospital Zalo Hub

## 1. Channels

- **Zalo OA**: kênh thông báo/chăm sóc và điểm vào Mini App.
- **Zalo Mini App**: giao diện nhanh cho nhân viên trên điện thoại.
- **Web Admin**: quản trị người dùng, khoa/phòng, quyền, audit.
- **REST API**: nghiệp vụ dùng chung cho Admin và Mini App.

## 2. Core services

- Node.js 22
- Next.js cho Web Admin
- Fastify cho API
- React + Vite cho Mini App
- PostgreSQL + Prisma

## 3. Security boundary

Repository này không chứa khóa Zalo, thông tin đăng nhập production hoặc dữ liệu bệnh nhân.

MVP ưu tiên dữ liệu hành chính nội bộ. Nếu mở rộng sang hội chẩn có thông tin người bệnh, cần bổ sung:
- phân quyền chi tiết theo vai trò và khoa/phòng;
- mã hóa khi truyền/lưu trữ;
- audit truy cập hồ sơ;
- thời hạn lưu trữ;
- quy trình đồng ý/chia sẻ;
- chính sách backup/restore và xử lý sự cố.

## 4. Sprint roadmap

### Sprint 1
SSO/identity → users → departments → RBAC → dashboard → directory → audit log.

### Sprint 2
Thông báo → xác nhận đã đọc → Notification Center → Zalo OA.

### Sprint 3
Nhóm trao đổi/hội chẩn → tệp nội bộ → storage.

### Sprint 4
AI utilities → chuyển đổi file → OCR/tóm tắt theo phạm vi cho phép.
