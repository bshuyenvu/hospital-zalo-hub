import { useEffect, useState, type FormEvent } from "react";
import { openPhone } from "zmp-sdk";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type Department = {
  id: string;
  code: string;
  name: string;
};

type DirectoryItem = {
  id: string;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  role: string;
  department: Department | null;
};

type DirectoryDetail = DirectoryItem & {
  email: string | null;
};

type Props = {
  token: string;
  onBack: () => void;
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Quản trị hệ thống",
  ADMIN: "Quản trị",
  DEPARTMENT_MANAGER: "Quản lý khoa/phòng",
  DOCTOR: "Bác sĩ",
  NURSE: "Điều dưỡng",
  STAFF: "Nhân viên",
  VIEWER: "Người xem"
};

export default function DirectoryView({ token, onBack }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<DirectoryDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  async function loadDirectory(nextPage = page) {
    setBusy(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "20"
      });

      if (search.trim()) params.set("search", search.trim());
      if (departmentId) params.set("departmentId", departmentId);

      const response = await fetch(`${API_URL}/v1/directory?${params}`, {
        headers: authHeaders
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Không tải được danh bạ.");
      }

      setItems(data.items ?? []);
      setPage(data.meta?.page ?? nextPage);
      setPages(data.meta?.pages ?? 1);
      setTotal(data.meta?.total ?? 0);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không tải được danh bạ."
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadDepartments() {
    try {
      const response = await fetch(`${API_URL}/v1/departments`, {
        headers: authHeaders
      });
      const data = await response.json();
      if (response.ok) {
        setDepartments(data.items ?? []);
      }
    } catch {
      // Danh bạ vẫn hoạt động nếu danh sách khoa/phòng tạm thời chưa tải được.
    }
  }

  async function openProfile(id: string) {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/v1/directory/${id}`, {
        headers: authHeaders
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Không tải được hồ sơ liên hệ.");
      }

      setSelected(data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không tải được hồ sơ liên hệ."
      );
    } finally {
      setBusy(false);
    }
  }

  async function callPhone(phone: string) {
    try {
      await openPhone({ phoneNumber: phone });
    } catch {
      setMessage("Không mở được ứng dụng gọi điện trên thiết bị này.");
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void loadDirectory(1);
  }

  useEffect(() => {
    void loadDepartments();
    void loadDirectory(1);
    // Chỉ chạy khi mở màn hình.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadDirectory(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  return (
    <main className="app directory-screen">
      <div className="screen-header">
        <button className="back-button" type="button" onClick={onBack}>
          ←
        </button>
        <div>
          <span className="badge">Huyền Vũ Hub</span>
          <h1>Danh bạ nội bộ</h1>
          <p>{total} nhân sự phù hợp</p>
        </div>
      </div>

      <form className="directory-filters" onSubmit={submitSearch}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tên hoặc mã nhân sự"
          aria-label="Tìm nhân sự"
        />
        <select
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
          aria-label="Lọc khoa phòng"
        >
          <option value="">Tất cả khoa/phòng</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy}>
          {busy ? "Đang tìm..." : "Tìm kiếm"}
        </button>
      </form>

      {message ? <div className="inline-message">{message}</div> : null}

      <section className="directory-list" aria-busy={busy}>
        {!busy && items.length === 0 ? (
          <div className="empty-state">Không có nhân sự phù hợp.</div>
        ) : null}

        {items.map((item) => (
          <button
            className="directory-card"
            type="button"
            key={item.id}
            onClick={() => void openProfile(item.id)}
          >
            <span className="directory-avatar">
              {item.fullName
                .split(" ")
                .slice(-2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className="directory-main">
              <strong>{item.fullName}</strong>
              <small>
                {roleLabels[item.role] ?? item.role}
                {item.department ? ` · ${item.department.name}` : ""}
              </small>
              <small>{item.employeeCode}</small>
            </span>
            <span className="chevron">›</span>
          </button>
        ))}
      </section>

      {pages > 1 ? (
        <div className="pagination">
          <button
            type="button"
            disabled={busy || page <= 1}
            onClick={() => void loadDirectory(page - 1)}
          >
            Trước
          </button>
          <span>
            {page}/{pages}
          </span>
          <button
            type="button"
            disabled={busy || page >= pages}
            onClick={() => void loadDirectory(page + 1)}
          >
            Sau
          </button>
        </div>
      ) : null}

      {selected ? (
        <div className="profile-sheet" role="dialog" aria-modal="true">
          <button
            className="sheet-backdrop"
            type="button"
            aria-label="Đóng"
            onClick={() => setSelected(null)}
          />
          <div className="profile-card">
            <div className="profile-handle" />
            <span className="directory-avatar large">
              {selected.fullName
                .split(" ")
                .slice(-2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            <h2>{selected.fullName}</h2>
            <p>{roleLabels[selected.role] ?? selected.role}</p>
            <dl>
              <div>
                <dt>Mã nhân sự</dt>
                <dd>{selected.employeeCode}</dd>
              </div>
              <div>
                <dt>Khoa/phòng</dt>
                <dd>{selected.department?.name ?? "Chưa phân khoa/phòng"}</dd>
              </div>
              {selected.phone ? (
                <div>
                  <dt>Điện thoại</dt>
                  <dd>{selected.phone}</dd>
                </div>
              ) : null}
              {selected.email ? (
                <div>
                  <dt>Email</dt>
                  <dd>{selected.email}</dd>
                </div>
              ) : null}
            </dl>

            <div className="profile-actions">
              {selected.phone ? (
                <button
                  type="button"
                  onClick={() => void callPhone(selected.phone!)}
                >
                  📞 Gọi điện
                </button>
              ) : null}
              <button
                className="secondary"
                type="button"
                onClick={() => setSelected(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
