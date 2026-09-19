"use client";

import { useEffect, useMemo, useState } from "react";
import AdminHeader from "../components/AdminHeader";
import {
  apiFetch,
  devLogin,
  getToken,
  startZaloAuth
} from "../lib/api";

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

type AuthCapabilities = {
  zaloLoginEnabled: boolean;
  devLoginEnabled: boolean;
};

type SessionData = {
  user: {
    sub: string;
    employeeCode: string;
    fullName: string;
    role: string;
    zaloLinked: boolean;
    zaloDisplayName: string | null;
  };
};

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [zaloLinked, setZaloLinked] = useState(false);
  const [zaloName, setZaloName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const roleCount = useMemo(
    () => dashboard?.roles.filter((item) => item.count > 0).length ?? 0,
    [dashboard]
  );

  async function loadDashboard() {
    try {
      const [dashboardData, sessionData] = await Promise.all([
        apiFetch<DashboardData>("/v1/dashboard"),
        apiFetch<SessionData>("/v1/auth/session")
      ]);

      setDashboard(dashboardData);
      setLoggedIn(true);
      setZaloLinked(sessionData.user.zaloLinked);
      setZaloName(sessionData.user.zaloDisplayName);
      setError("");
    } catch (err) {
      setDashboard(null);
      setError(
        err instanceof Error ? err.message : "Không tải được dữ liệu dashboard."
      );
    }
  }

  useEffect(() => {
    void apiFetch<AuthCapabilities>("/v1/auth/capabilities", {}, null)
      .then(setCapabilities)
      .catch(() =>
        setCapabilities({
          zaloLoginEnabled: false,
          devLoginEnabled: false
        })
      );

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

  async function beginZalo(mode: "login" | "link") {
    setBusy(true);

    try {
      await startZaloAuth(mode);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không khởi tạo được đăng nhập Zalo."
      );
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
          <p className="eyebrow">HOSPITAL ZALO HUB · MVP 0.3</p>
          <h1>Cổng nội bộ bệnh viện</h1>
          <p className="subtitle">
            Quản trị nhân sự, khoa/phòng, phân quyền và danh bạ trên một nền tảng
            dùng chung; Zalo Social OAuth V4 đã được đưa vào luồng xác thực.
          </p>
        </div>
        <div className={loggedIn ? "status" : "status pending"}>
          <span className="dot" />
          {loggedIn ? "Đã xác thực" : "Chưa đăng nhập"}
        </div>
      </section>

      {!loggedIn ? (
        <section className="login-panel">
          <div>
            <p className="eyebrow">ĐĂNG NHẬP</p>
            <h2>Đăng nhập nội bộ</h2>
            <p className="muted">
              {capabilities === null
                ? "Đang kiểm tra phương thức đăng nhập..."
                : capabilities.zaloLoginEnabled
                  ? "Đăng nhập Zalo chỉ hoạt động với tài khoản đã liên kết trước với hồ sơ nhân sự nội bộ."
                  : "Hệ thống đã online nhưng Zalo App chưa được cấu hình. Sau khi nhập App ID và App Secret, nút đăng nhập Zalo sẽ tự động được mở."}
            </p>
          </div>
          <div className="login-actions">
            <button
              className="button primary"
              type="button"
              disabled={busy || !capabilities?.zaloLoginEnabled}
              onClick={() => void beginZalo("login")}
            >
              {capabilities === null
                ? "Đang kiểm tra..."
                : capabilities.zaloLoginEnabled
                  ? "Đăng nhập bằng Zalo"
                  : "Zalo chưa cấu hình"}
            </button>
            {capabilities?.devLoginEnabled && (
              <button
                className="button ghost"
                type="button"
                disabled={busy}
                onClick={() => void loginDemo()}
              >
                {busy ? "Đang xử lý..." : "Dev login ADMIN001"}
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="login-panel">
          <div>
            <p className="eyebrow">LIÊN KẾT ZALO</p>
            <h2>
              {zaloLinked
                ? `Đã liên kết${zaloName ? ` · ${zaloName}` : ""}`
                : "Chưa liên kết tài khoản Zalo"}
            </h2>
            <p className="muted">
              Việc liên kết yêu cầu phiên nội bộ hợp lệ, tránh ghép tài khoản
              chỉ dựa trên tên hiển thị.
            </p>
          </div>
          <button
            className="button primary"
            type="button"
            disabled={busy || !capabilities?.zaloLoginEnabled}
            onClick={() => void beginZalo("link")}
          >
            {!capabilities?.zaloLoginEnabled
              ? "Zalo chưa cấu hình"
              : zaloLinked
                ? "Liên kết lại Zalo"
                : "Liên kết Zalo"}
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
          <p className="eyebrow">SPRINT 1 · PHẦN 3</p>
          <h2>Zalo authentication</h2>
        </div>
        <ol>
          <li><span>01</span>OAuth V4 + PKCE + state chống CSRF</li>
          <li><span>02</span>Liên kết Zalo với nhân sự đã xác thực</li>
          <li><span>03</span>One-time ticket thay vì JWT trên callback URL</li>
          <li><span>04</span>Đăng nhập Zalo cho tài khoản đã liên kết</li>
          <li><span>05</span>Endpoint riêng cho Zalo Mini App</li>
          <li><span>06</span>Audit mọi thao tác link/login/unlink</li>
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
