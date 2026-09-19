import { useEffect, useMemo, useState, type FormEvent } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type Department = {
  id: string;
  code: string;
  name: string;
};

type InternalFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  scope: "ALL" | "DEPARTMENT";
  createdAt: string;
  uploader: {
    id: string;
    fullName: string;
    employeeCode: string;
  };
  department: Department | null;
};

type Props = {
  token: string;
  role: string;
  userId: string;
  onBack: () => void;
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesView({ token, role, userId, onBack }: Props) {
  const [items, setItems] = useState<InternalFile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scope, setScope] = useState<"ALL" | "DEPARTMENT">(
    role === "SUPER_ADMIN" || role === "ADMIN" ? "ALL" : "DEPARTMENT"
  );
  const [departmentId, setDepartmentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  async function loadFiles() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/v1/files?limit=50`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? "Không tải được danh sách tệp.");
      setItems(data.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được danh sách tệp.");
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
      // Chỉ ảnh hưởng lựa chọn phạm vi khoa/phòng.
    }
  }

  async function uploadFile(event: FormEvent) {
    event.preventDefault();
    if (!selectedFile) return;

    setBusy(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ scope });
      if (scope === "DEPARTMENT" && departmentId) {
        params.set("departmentId", departmentId);
      }

      const form = new FormData();
      form.append("file", selectedFile);

      const response = await fetch(`${API_URL}/v1/files?${params}`, {
        method: "POST",
        headers,
        body: form
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? "Không tải tệp lên được.");

      setSelectedFile(null);
      const input = document.getElementById("internal-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage("Đã tải tệp lên kho nội bộ.");
      await loadFiles();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải tệp lên được.");
    } finally {
      setBusy(false);
    }
  }

  async function download(item: InternalFile) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/v1/files/${item.id}/download`, {
        headers
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message ?? "Không tải được tệp.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.originalName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage("Đã bắt đầu tải tệp.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được tệp.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: InternalFile) {
    if (!window.confirm(`Gỡ tệp “${item.originalName}” khỏi kho nội bộ?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/v1/files/${item.id}`, {
        method: "DELETE",
        headers
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? "Không gỡ được tệp.");
      setMessage("Đã gỡ tệp.");
      await loadFiles();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không gỡ được tệp.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadFiles();
    void loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="app files-screen">
      <div className="screen-header">
        <button className="back-button" type="button" onClick={onBack}>←</button>
        <div>
          <span className="badge">Huyền Vũ Hub</span>
          <h1>Tệp nội bộ</h1>
          <p>{items.length} tệp đang hiển thị</p>
        </div>
      </div>

      <form className="file-uploader" onSubmit={uploadFile}>
        <label className="field-label">
          Chọn tệp · tối đa 20 MB
          <input
            id="internal-file-input"
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            required
          />
        </label>

        {isAdmin ? (
          <div className="form-grid">
            <label className="field-label">
              Phạm vi
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as "ALL" | "DEPARTMENT")}
              >
                <option value="ALL">Toàn viện</option>
                <option value="DEPARTMENT">Theo khoa/phòng</option>
              </select>
            </label>
            {scope === "DEPARTMENT" ? (
              <label className="field-label">
                Khoa/phòng
                <select
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                >
                  <option value="">Khoa/phòng của tôi</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : <span />}
          </div>
        ) : (
          <small className="file-scope-note">Tệp sẽ được chia sẻ trong khoa/phòng của bạn.</small>
        )}

        <button type="submit" disabled={busy || !selectedFile}>
          {busy ? "Đang xử lý..." : "Tải lên"}
        </button>
      </form>

      {message ? <div className="inline-message">{message}</div> : null}

      <section className="file-list" aria-busy={busy}>
        {!busy && items.length === 0 ? (
          <div className="empty-state">Chưa có tệp nội bộ.</div>
        ) : null}

        {items.map((item) => {
          const canRemove = isAdmin || item.uploader.id === userId;
          return (
            <article className="file-card" key={item.id}>
              <div className="file-icon">📄</div>
              <div className="file-main">
                <strong>{item.originalName}</strong>
                <small>
                  {formatBytes(item.sizeBytes)} · {item.uploader.fullName}
                </small>
                <small>
                  {item.scope === "ALL"
                    ? "Toàn viện"
                    : item.department?.name ?? "Theo khoa/phòng"}
                  {" · "}
                  {new Date(item.createdAt).toLocaleString("vi-VN")}
                </small>
              </div>
              <div className="file-actions">
                <button type="button" onClick={() => void download(item)}>
                  Tải
                </button>
                {canRemove ? (
                  <button className="danger-link" type="button" onClick={() => void remove(item)}>
                    Gỡ
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
