const modules = [
  { title: "Nhân sự", value: "300+", note: "Danh bạ nội bộ theo khoa/phòng" },
  { title: "Khoa / Phòng", value: "Sẵn sàng", note: "Quản lý cơ cấu tổ chức" },
  { title: "Phân quyền", value: "7 vai trò", note: "RBAC cho quản trị và chuyên môn" },
  { title: "Audit log", value: "Bật", note: "Theo dõi thao tác quản trị" },
];

const sprint = [
  "Đăng nhập và nhận diện người dùng",
  "Quản lý nhân sự",
  "Quản lý khoa/phòng",
  "Role & permission",
  "Dashboard thật",
  "Danh bạ nội bộ",
  "Audit log",
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">HOSPITAL ZALO HUB · MVP 0.1</p>
          <h1>Cổng nội bộ bệnh viện</h1>
          <p className="subtitle">
            Một điểm truy cập cho nhân sự, thông báo, trao đổi nội bộ và tiện ích
            Zalo — thiết kế để mở rộng dần mà không trộn dữ liệu bệnh nhân vào
            kênh công cộng.
          </p>
        </div>
        <div className="status">
          <span className="dot" />
          Sprint 1 đang triển khai
        </div>
      </section>

      <section className="grid">
        {modules.map((item) => (
          <article className="card" key={item.title}>
            <p>{item.title}</p>
            <strong>{item.value}</strong>
            <span>{item.note}</span>
          </article>
        ))}
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">SPRINT 1</p>
          <h2>Nền tảng quản trị nội bộ</h2>
        </div>
        <ol>
          {sprint.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel compact">
        <div>
          <p className="eyebrow">TÍCH HỢP TIẾP THEO</p>
          <h2>Zalo OA + Mini App</h2>
        </div>
        <p>
          Skeleton đã tách riêng Mini App và API. Khi cấu hình App ID/OA ID,
          luồng OAuth, thông báo OA và menu tiện ích sẽ được bật mà không cần đổi
          kiến trúc.
        </p>
      </section>
    </main>
  );
}
