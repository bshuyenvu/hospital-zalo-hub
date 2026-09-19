"use client";

import { useEffect, useMemo, useState } from "react";
import AdminHeader from "../components/AdminHeader";
import { apiFetch, devLogin, getToken } from "../lib/api";

type DashboardData = {
  activeUsers: number;
  activeDepartments: number;
  roles: Array<{ role: string; count: number }>;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string | null;
    createdAt: string;
    actor: {
      fullName: string;
      employeeCode: string;
    } | null;
  }>;
};

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const roleCount = useMemo(
    () => dashboard?.roles.filter((item) => item.count > 0).length ?? 0,
    [dashboard]
  );

  async function loadDashboard() {
    try {
      const data = await apiFetch<DashboardData>("/v1/dashboard");
      setDashboard(data);
      setLoggedIn(true);
      setError("");
    } catch (err) {
      setDashboard(null);
      setError(
        err instanceof Error ? err.message : "Không tải được dữ liệu dashboard."
      );
    }
  }

  useEffect(() => {
    const hasToken = Boolean(getToken());
    setLoggedIn(hasToken);
    if (hasToken) {
      void loadDashboard();
    }
  }, []);

  async function loginDemo() {
    setBusy(true);
    try {
      await devLogin();
      setLoggedIn(true);
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không đăng nhập được tài khoản thử nghiệm."
      );
    } finally {
      setBusy(false);
    }
  }

  const modules = [
    {
      title: "Nhân sự",
      value: dashboard?.activeUsers ?? "—",
      note: "Tài khoản đang hoạt động"
    },
    {
      title: "Khoa / Phòng",
      value: dashboard?.activeDepartments ?? "—",
      note: "Đơn vị đang hoạt động"
    },
    {
      title: "Vai trò đang dùng",
      value: dashboard ? roleCount : "—",
      note: "Trong 7 vai trò RBAC"
    },
    {
      title: "Audit gần nhất",
      value: dashboard?.recentAudit.length ?? "—",
      note: "Hoạt động mới được ghi nhận"
    }
  ];

  return (
    <main className="shell">
      <AdminHeader />

      <section className="hero">
        <div>
          <p className="eyebrow">HOSPITAL ZALO HUB · MVP 0.2</p>
          <h1>Cổng nội bộ bệnh viện</h1>
          <p className="subtitle">
            Quản trị nhân sự, khoa/phòng, phân quyền và danh bạ trên một nền tảng
            dùng chung; sẵn sàng làm backend cho Zalo Mini App.
          </p>
        </div>
        <div className={loggedIn ? "status" : "status pending"}>
          <span className="dot" />
          {loggedIn ? "Đã xác thực" : "Chưa đăng nhập"}
        </div>
      </section>

      {!loggedIn && (
        <section className="login-panel">
          <div>
            <p className="eyebrow">CHẾ ĐỘ PHÁT TRIỂN</p>
            <h2>Đăng nhập thử nghiệm</h2>
            <p className="muted">
              Sau khi chạy database và seed, dùng ADMIN001 để kiểm thử toàn bộ
              luồng quản trị. Production phải đặt ALLOW_DEV_AUTH=false.
            </p>
          </div>
          <button
            className="button primary"
            type="button"
            disabled={busy}
            onClick={() => void loginDemo()}
          >
            {busy ? "Đang đăng nhập..." : "Đăng nhập ADMIN001"}
          </button>
        </section>
      )}

      {error && <div className="alert error">{error}</div>}

      <section className="grid">
        {modules.map((item) => (
          <article className="card" key={item.title}>
            <p>{item.title}</p>
            <strong>{item.value}</strong>
            <span>{item.note}</span>
          </article>
        ))}
      </section>

      <section className="quick-links">
        <a href="/users">
          <span>👥</span>
          <strong>Quản lý nhân sự</strong>
          <small>Thêm, phân quyền, ngưng/kích hoạt tài khoản</small>
        </a>
        <a href="/departments">
          <span>🏥</span>
          <strong>Khoa / Phòng</strong>
          <small>Quản lý cơ cấu tổ chức</small>
        </a>
        <a href="/directory">
          <span>🔎</span>
          <strong>Danh bạ nội bộ</strong>
          <small>Tìm nhanh đồng nghiệp theo tên hoặc mã</small>
        </a>
        <a href="/audit">
          <span>🛡️</span>
          <strong>Audit log</strong>
          <small>Theo dõi thao tác quan trọng</small>
        </a>
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">SPRINT 1 · PHẦN 2</p>
          <h2>Nền tảng quản trị đã nối API thật</h2>
        </div>
        <ol>
          <li><span>01</span>Seed khoa/phòng và tài khoản ADMIN001</li>
          <li><span>02</span>JWT + RBAC cho endpoint quản trị</li>
          <li><span>03</span>CRUD nhân sự và khoa/phòng</li>
          <li><span>04</span>Danh bạ có tìm kiếm</li>
          <li><span>05</span>Dashboard dữ liệu thật</li>
          <li><span>06</span>Audit log cho thao tác quản trị</li>
          <li><span>07</span>Zalo OAuth là checkpoint tiếp theo</li>
        </ol>
      </section>

      {dashboard && dashboard.recentAudit.length > 0 && (
        <section className="data-panel recent-panel">
          <div className="toolbar">
            <div>
              <p className="eyebrow">HOẠT ĐỘNG GẦN ĐÂY</p>
              <h2>Audit mới nhất</h2>
            </div>
            <a className="button ghost" href="/audit">Xem tất cả</a>
          </div>
          <div className="activity-list">
            {dashboard.recentAudit.map((item) => (
              <div key={item.id}>
                <span className="tag">{item.action}</span>
                <p>
                  <strong>{item.actor?.fullName ?? "Hệ thống"}</strong>
                  <small>
                    {item.entityType ?? "System"} ·{" "}
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </small>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
