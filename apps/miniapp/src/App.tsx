import { useState } from "react";
import { getAccessToken } from "zmp-sdk";
import DirectoryView from "./DirectoryView";
import AnnouncementsView from "./AnnouncementsView";
import ConsultationView from "./ConsultationView";
import FilesView from "./FilesView";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const tools = [
  { icon: "👥", label: "Danh bạ", note: "Tìm nhanh đồng nghiệp" },
  { icon: "📣", label: "Thông báo", note: "Tin nội bộ bệnh viện" },
  { icon: "💬", label: "Hội chẩn", note: "Khung tích hợp nhóm" },
  { icon: "📁", label: "Tệp nội bộ", note: "Tài liệu dùng chung" },
  { icon: "🧰", label: "Tiện ích", note: "Công cụ dành cho nhân viên" },
  { icon: "🤖", label: "Trợ lý AI", note: "Bật ở sprint sau" }
];

type InternalUser = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  department?: {
    id: string;
    code: string;
    name: string;
  } | null;
};

export default function App() {
  const [activeView, setActiveView] = useState<"home" | "directory" | "announcements" | "consultations" | "files">("home");
  const [user, setUser] = useState<InternalUser | null>(null);
  const [internalToken, setInternalToken] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "Xác thực Zalo để truy cập các tiện ích nội bộ."
  );
  const [busy, setBusy] = useState(false);

  const isAuthenticated = Boolean(user && internalToken);

  async function loginWithZalo() {
    setBusy(true);

    try {
      const zaloAccessToken = await getAccessToken();

      if (!zaloAccessToken) {
        throw new Error("Zalo chưa cấp access token cho Mini App.");
      }

      const response = await fetch(`${API_URL}/v1/auth/zalo/miniapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accessToken: zaloAccessToken
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ?? "Không xác thực được tài khoản Zalo."
        );
      }

      setInternalToken(data.token);
      setUser(data.user);
      setStatus("Đã xác thực Zalo và phiên nội bộ đã được tạo.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Không thể đăng nhập bằng Zalo."
      );
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setActiveView("home");
    setInternalToken(null);
    setUser(null);
    setStatus("Đã đăng xuất khỏi phiên nội bộ.");
  }

  if (activeView === "directory" && internalToken) {
    return (
      <DirectoryView
        token={internalToken}
        onBack={() => setActiveView("home")}
      />
    );
  }

  if (activeView === "announcements" && internalToken && user) {
    return (
      <AnnouncementsView
        token={internalToken}
        role={user.role}
        onBack={() => setActiveView("home")}
      />
    );
  }

  if (activeView === "consultations" && internalToken && user) {
    return (
      <ConsultationView
        token={internalToken}
        role={user.role}
        userId={user.id}
        onBack={() => setActiveView("home")}
      />
    );
  }

  if (activeView === "files" && internalToken && user) {
    return (
      <FilesView
        token={internalToken}
        role={user.role}
        userId={user.id}
        onBack={() => setActiveView("home")}
      />
    );
  }

  return (
    <main className="app">
      <header className="top">
        <div>
          <span className="badge">Huyền Vũ Hub</span>
          <h1>{user ? `Xin chào, ${user.fullName}` : "Xin chào 👋"}</h1>
          <p>
            {user?.department?.name ?? "Cổng tiện ích nội bộ trên Zalo"}
          </p>
        </div>
        <div className="avatar">
          {user
            ? user.fullName
                .split(" ")
                .slice(-2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()
            : "HV"}
        </div>
      </header>

      <section className={isAuthenticated ? "notice success" : "notice"}>
        <span>{isAuthenticated ? "✅" : "🔐"}</span>
        <div>
          <strong>
            {isAuthenticated ? "Đã xác thực nhân sự" : "Đăng nhập bằng Zalo"}
          </strong>
          <p>{status}</p>
          {isAuthenticated ? (
            <button className="auth-button secondary" type="button" onClick={logout}>
              Đăng xuất
            </button>
          ) : (
            <button
              className="auth-button"
              type="button"
              disabled={busy}
              onClick={() => void loginWithZalo()}
            >
              {busy ? "Đang xác thực..." : "Xác thực Zalo"}
            </button>
          )}
        </div>
      </section>

      <section>
        <h2>Tiện ích</h2>
        <div className="tools">
          {tools.map((tool) => (
            <button
              className="tool"
              key={tool.label}
              type="button"
              disabled={!isAuthenticated}
              onClick={() => {
                if (tool.label === "Danh bạ") {
                  setActiveView("directory");
                  return;
                }

                if (tool.label === "Thông báo") {
                  setActiveView("announcements");
                  return;
                }

                if (tool.label === "Hội chẩn") {
                  setActiveView("consultations");
                  return;
                }

                if (tool.label === "Tệp nội bộ") {
                  setActiveView("files");
                  return;
                }

                setStatus(`${tool.label} đang được triển khai theo lộ trình.`);
              }}
            >
              <span className="icon">{tool.icon}</span>
              <span>
                <strong>{tool.label}</strong>
                <small>{isAuthenticated ? tool.note : "Cần đăng nhập trước"}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <nav className="nav" aria-label="Điều hướng chính">
        <button type="button">🏠<span>Trang chủ</span></button>
        <button type="button" disabled={!isAuthenticated} onClick={() => setActiveView("announcements")}>🔔<span>Thông báo</span></button>
        <button type="button" disabled={!isAuthenticated}>👤<span>Cá nhân</span></button>
      </nav>
    </main>
  );
}
