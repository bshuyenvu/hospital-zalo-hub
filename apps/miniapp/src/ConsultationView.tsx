import { useEffect, useMemo, useState, type FormEvent } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type Person = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  department?: { id: string; code: string; name: string } | null;
};

type ConsultationListItem = {
  id: string;
  title: string;
  summary: string;
  priority: "ROUTINE" | "URGENT";
  status: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  owner: { id: string; fullName: string; employeeCode: string };
  department: { id: string; code: string; name: string } | null;
  _count: { participants: number; messages: number };
};

type ConsultationDetail = ConsultationListItem & {
  participants: Array<{
    user: Person;
    joinedAt: string;
  }>;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; fullName: string; employeeCode: string };
  }>;
};

type Props = {
  token: string;
  role: string;
  onBack: () => void;
};

export default function ConsultationView({ token, role, onBack }: Props) {
  const [items, setItems] = useState<ConsultationListItem[]>([]);
  const [directory, setDirectory] = useState<Person[]>([]);
  const [selected, setSelected] = useState<ConsultationDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">("OPEN");
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT">("ROUTINE");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const canAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  async function loadList() {
    setBusy(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const response = await fetch(`${API_URL}/v1/consultations?${params}`, {
        headers
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? "Không tải được ca hội chẩn.");
      setItems(data.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được ca hội chẩn.");
    } finally {
      setBusy(false);
    }
  }

  async function loadDirectory() {
    try {
      const response = await fetch(`${API_URL}/v1/directory?limit=50`, { headers });
      const data = await response.json();
      if (response.ok) setDirectory(data.items ?? []);
    } catch {
      // Có thể tạo ca không thêm thành viên và mời sau.
    }
  }

  async function openCase(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/v1/consultations/${id}`, {
        headers
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? "Không mở được ca hội chẩn.");
      setSelected(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không mở được ca hội chẩn.");
    } finally {
      setBusy(false);
    }
  }

  async function createCase(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/v1/consultations`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim(),
          priority,
          participantIds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? "Không tạo được ca hội chẩn.");
      setTitle("");
      setSummary("");
      setPriority("ROUTINE");
      setParticipantIds([]);
      setComposerOpen(false);
      setMessage("Đã tạo ca hội chẩn.");
      await loadList();
      await openCase(data.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tạo được ca hội chẩn.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selected || !messageBody.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${API_URL}/v1/consultations/${selected.id}/messages`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ body: messageBody.trim() })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? "Không gửi được trao đổi.");
      setMessageBody("");
      await openCase(selected.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không gửi được trao đổi.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: "OPEN" | "CLOSED") {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${API_URL}/v1/consultations/${selected.id}/status`,
        {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ status: next })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? "Không đổi được trạng thái.");
      await openCase(selected.id);
      await loadList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không đổi được trạng thái.");
    } finally {
      setBusy(false);
    }
  }

  function toggleParticipant(id: string) {
    setParticipantIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  useEffect(() => {
    void loadDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  if (selected) {
    return (
      <main className="app consultation-screen">
        <div className="screen-header">
          <button className="back-button" type="button" onClick={() => setSelected(null)}>
            ←
          </button>
          <div>
            <span className="badge">Huyền Vũ Hub</span>
            <h1>Hội chẩn</h1>
            <p>{selected.status === "OPEN" ? "Đang mở" : "Đã đóng"}</p>
          </div>
        </div>

        <section className={`consultation-summary ${selected.priority === "URGENT" ? "urgent" : ""}`}>
          <span className="announcement-meta">
            {selected.priority === "URGENT" ? "Khẩn" : "Thường"}
            {selected.department ? ` · ${selected.department.name}` : ""}
          </span>
          <h2>{selected.title}</h2>
          <p>{selected.summary}</p>
          <small>
            Người tạo: {selected.owner.fullName} · {selected.participants.length} thành viên
          </small>
        </section>

        <section className="consultation-participants">
          <h2>Thành viên</h2>
          <div className="participant-chips">
            {selected.participants.map(({ user }) => (
              <span key={user.id}>{user.fullName}</span>
            ))}
          </div>
        </section>

        <section>
          <h2>Trao đổi</h2>
          <div className="consultation-thread">
            {selected.messages.length === 0 ? (
              <div className="empty-state">Chưa có trao đổi.</div>
            ) : null}
            {selected.messages.map((entry) => (
              <article className="consultation-message" key={entry.id}>
                <strong>{entry.author.fullName}</strong>
                <small>{new Date(entry.createdAt).toLocaleString("vi-VN")}</small>
                <p>{entry.body}</p>
              </article>
            ))}
          </div>
        </section>

        {message ? <div className="inline-message">{message}</div> : null}

        {selected.status === "OPEN" ? (
          <form className="consultation-reply" onSubmit={sendMessage}>
            <textarea
              rows={3}
              maxLength={5000}
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder="Nhập ý kiến hội chẩn..."
              required
            />
            <button type="submit" disabled={busy || !messageBody.trim()}>
              {busy ? "Đang gửi..." : "Gửi ý kiến"}
            </button>
          </form>
        ) : null}

        <div className="consultation-actions">
          {(selected.owner.id || canAdmin) ? (
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={() =>
                void changeStatus(selected.status === "OPEN" ? "CLOSED" : "OPEN")
              }
            >
              {selected.status === "OPEN" ? "Đóng ca hội chẩn" : "Mở lại ca"}
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="app consultation-screen">
      <div className="screen-header">
        <button className="back-button" type="button" onClick={onBack}>←</button>
        <div>
          <span className="badge">Huyền Vũ Hub</span>
          <h1>Hội chẩn</h1>
          <p>{items.length} ca đang hiển thị</p>
        </div>
      </div>

      <div className="consultation-toolbar">
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "ALL" | "OPEN" | "CLOSED")
          }
        >
          <option value="OPEN">Đang mở</option>
          <option value="CLOSED">Đã đóng</option>
          <option value="ALL">Tất cả</option>
        </select>
        <button type="button" onClick={() => setComposerOpen((value) => !value)}>
          {composerOpen ? "Đóng" : "＋ Tạo ca"}
        </button>
      </div>

      {composerOpen ? (
        <form className="consultation-composer" onSubmit={createCase}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Tiêu đề ca hội chẩn"
            maxLength={180}
            required
          />
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Tóm tắt vấn đề cần hội chẩn"
            rows={5}
            maxLength={10000}
            required
          />
          <label className="field-label">
            Mức độ
            <select value={priority} onChange={(event) => setPriority(event.target.value as "ROUTINE" | "URGENT")}>
              <option value="ROUTINE">Thường</option>
              <option value="URGENT">Khẩn</option>
            </select>
          </label>
          <div className="participant-picker">
            <span className="field-label">Mời thành viên</span>
            <div>
              {directory.map((person) => (
                <label key={person.id}>
                  <input
                    type="checkbox"
                    checked={participantIds.includes(person.id)}
                    onChange={() => toggleParticipant(person.id)}
                  />
                  <span>
                    {person.fullName}
                    {person.department ? ` · ${person.department.name}` : ""}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Đang tạo..." : "Tạo ca hội chẩn"}
          </button>
        </form>
      ) : null}

      {message ? <div className="inline-message">{message}</div> : null}

      <section className="consultation-list" aria-busy={busy}>
        {!busy && items.length === 0 ? (
          <div className="empty-state">Chưa có ca hội chẩn phù hợp.</div>
        ) : null}
        {items.map((item) => (
          <button
            className={`consultation-card ${item.priority === "URGENT" ? "urgent" : ""}`}
            type="button"
            key={item.id}
            onClick={() => void openCase(item.id)}
          >
            <span className="consultation-card-main">
              <span className="announcement-meta">
                {item.priority === "URGENT" ? "Khẩn" : "Thường"} · {item.status === "OPEN" ? "Đang mở" : "Đã đóng"}
              </span>
              <strong>{item.title}</strong>
              <small>{item.owner.fullName}{item.department ? ` · ${item.department.name}` : ""}</small>
              <small>{item._count.participants} thành viên · {item._count.messages} trao đổi</small>
            </span>
            <span className="chevron">›</span>
          </button>
        ))}
      </section>
    </main>
  );
}
