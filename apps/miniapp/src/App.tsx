const tools = [
  { icon: "👥", label: "Danh bạ", note: "Tìm nhanh đồng nghiệp" },
  { icon: "📣", label: "Thông báo", note: "Tin nội bộ bệnh viện" },
  { icon: "💬", label: "Hội chẩn", note: "Khung tích hợp nhóm" },
  { icon: "📁", label: "Tệp nội bộ", note: "Tài liệu dùng chung" },
  { icon: "🧰", label: "Tiện ích", note: "Công cụ dành cho nhân viên" },
  { icon: "🤖", label: "Trợ lý AI", note: "Bật ở sprint sau" },
];

export default function App() {
  return (
    <main className="app">
      <header className="top">
        <div>
          <span className="badge">Hospital Hub</span>
          <h1>Xin chào 👋</h1>
          <p>Cổng tiện ích nội bộ trên Zalo</p>
        </div>
        <div className="avatar">HV</div>
      </header>

      <section className="notice">
        <span>📌</span>
        <div>
          <strong>Mini App MVP đã sẵn sàng</strong>
          <p>Đang chờ cấu hình Zalo App ID/OA để bật đăng nhập thật.</p>
        </div>
      </section>

      <section>
        <h2>Tiện ích</h2>
        <div className="tools">
          {tools.map((tool) => (
            <button className="tool" key={tool.label} type="button">
              <span className="icon">{tool.icon}</span>
              <span>
                <strong>{tool.label}</strong>
                <small>{tool.note}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <nav className="nav" aria-label="Điều hướng chính">
        <button type="button">🏠<span>Trang chủ</span></button>
        <button type="button">🔔<span>Thông báo</span></button>
        <button type="button">👤<span>Cá nhân</span></button>
      </nav>
    </main>
  );
}
