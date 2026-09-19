import { useEffect, useState, type FormEvent } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type Department = {
  id: string;
  code: string;
  name: string;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  publishedAt: string;
  expiresAt: string | null;
  unread: boolean;
  readAt: string | null;
  author: {
    id: string;
    fullName: string;
    employeeCode: string;
  };
  targetDepartment: Department | null;
};

type Props = {
  token: string;
  role: string;
  onBack: () => void;
};

const priorityLabels = {
  NORMAL: "Bình thường",
  IMPORTANT: "Quan trọng",
  URGENT: "Khẩn"
} as const;

export default function AnnouncementsView({ token, role, onBack }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<Announcement["priority"]>("NORMAL");
  const [targetDepartmentId, setTargetDepartmentId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const headers = {
    Authorization: `Bearer ${token}`
  };

  async function loadAnnouncements() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/v1/announcements?limit=30`, {
        headers
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Không tải được thông báo.");
      }

      setItems(data.items ?? []);
      setUnreadCount(data.meta?.unreadCount ?? 0);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không tải được thông báo."
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadDepartments() {
    if (!isAdmin) return;

    try {
      const response = await fetch(`${API_URL}/v1/departments`, { headers });
      const data = await response.json();
      if (response.ok) setDepartments(data.items ?? []);
    } catch {
      // Form vẫn có thể gửi thông báo toàn viện.
    }
  }

  async function openAnnouncement(item: Announcement) {
    setExpandedId((current) => (current === item.id ? null : item.id));

    if (!item.unread) return;

    try {
      const response = await fetch(
        `${API_URL}/v1/announcements/${item.id}/read`,
        {
          method: "POST",
          headers
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Không cập nhật được trạng thái đã đọc.");
      }

      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, unread: false, readAt: data.readAt }
            : entry
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không cập nhật được trạng thái đã đọc."
      );
    }
  }

  async function createAnnouncement(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/v1/announcements`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          priority,
          targetDepartmentId: targetDepartmentId || null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Không tạo được thông báo.");
      }

      setTitle("");
      setBody("");
      setPriority("NORMAL");
      setTargetDepartmentId("");
      setExpiresAt("");
      setComposerOpen(false);
      setMessage("Đã phát hành thông báo.");
      await loadAnnouncements();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không tạo được thông báo."
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadAnnouncements();
    void loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="app announcements-screen">
      <div className="screen-header">
        <button className="back-button" type="button" onClick={onBack}>
          ←
        </button>
        <div>
          <span className="badge">Huyền Vũ Hub</span>
          <h1>Thông báo</h1>
          <p>{unreadCount > 0 ? `${unreadCount} chưa đọc` : "Đã đọc hết"}</p>
        </div>
      </div>

      {isAdmin ? (
        <button
          className="primary-wide"
          type="button"
          onClick={() => setComposerOpen((value) => !value)}
        >
          {composerOpen ? "Đóng trình soạn" : "＋ Tạo thông báo"}
        </button>
      ) : null}

      {composerOpen ? (
        <form className="announcement-composer" onSubmit={createAnnouncement}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Tiêu đề thông báo"
            maxLength={180}
            required
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Nội dung"
            rows={6}
            maxLength={10000}
            required
          />
          <div className="form-grid">
            <label>
              Mức độ
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as Announcement["priority"])
                }
              >
                <option value="NORMAL">Bình thường</option>
                <option value="IMPORTANT">Quan trọng</option>
                <option value="URGENT">Khẩn</option>
              </select>
            </label>
            <label>
              Phạm vi
              <select
                value={targetDepartmentId}
                onChange={(event) => setTargetDepartmentId(event.target.value)}
              >
                <option value="">Toàn viện</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field-label">
            Hết hạn (không bắt buộc)
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Đang phát hành..." : "Phát hành"}
          </button>
        </form>
      ) : null}

      {message ? <div className="inline-message">{message}</div> : null}

      <section className="announcement-list" aria-busy={busy}>
        {!busy && items.length === 0 ? (
          <div className="empty-state">Chưa có thông báo nào.</div>
        ) : null}

        {items.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <article
              className={`announcement-card priority-${item.priority.toLowerCase()} ${
                item.unread ? "unread" : ""
              }`}
              key={item.id}
            >
              <button
                className="announcement-toggle"
                type="button"
                onClick={() => void openAnnouncement(item)}
              >
                <span className="announcement-dot" />
                <span className="announcement-heading">
                  <span className="announcement-meta">
                    {priorityLabels[item.priority]}
                    {item.targetDepartment
                      ? ` · ${item.targetDepartment.name}`
                      : " · Toàn viện"}
                  </span>
                  <strong>{item.title}</strong>
                  <small>
                    {new Date(item.publishedAt).toLocaleString("vi-VN")} ·{" "}
                    {item.author.fullName}
                  </small>
                </span>
                <span className="chevron">{expanded ? "⌃" : "›"}</span>
              </button>
              {expanded ? (
                <div className="announcement-body">
                  <p>{item.body}</p>
                  {item.expiresAt ? (
                    <small>
                      Hiệu lực đến:{" "}
                      {new Date(item.expiresAt).toLocaleString("vi-VN")}
                    </small>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
