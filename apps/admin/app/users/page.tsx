"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminHeader from "../../components/AdminHeader";
import { apiFetch, getToken } from "../../lib/api";

type Department = {
  id: string;
  code: string;
  name: string;
};

type UserItem = {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  department: Department | null;
};

const roles = [
  "SUPER_ADMIN",
  "ADMIN",
  "DEPARTMENT_MANAGER",
  "DOCTOR",
  "NURSE",
  "STAFF",
  "VIEWER"
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadUsers(term = search) {
    if (!getToken()) {
      setError("Hãy đăng nhập từ trang Tổng quan trước.");
      return;
    }

    try {
      setError("");
      const params = new URLSearchParams();
      if (term.trim()) params.set("search", term.trim());
      params.set("includeInactive", "true");
      const data = await apiFetch<{ items: UserItem[] }>(
        `/v1/users?${params.toString()}`
      );
      setUsers(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được nhân sự.");
    }
  }

  async function loadDepartments() {
    try {
      const data = await apiFetch<{ items: Department[] }>("/v1/departments");
      setDepartments(data.items);
    } catch {
      // The users request will surface the auth/API error.
    }
  }

  useEffect(() => {
    void loadDepartments();
    void loadUsers("");
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    try {
      await apiFetch("/v1/users", {
        method: "POST",
        body: JSON.stringify({
          employeeCode: String(form.get("employeeCode") ?? ""),
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? "").trim() || null,
          phone: String(form.get("phone") ?? "").trim() || null,
          role: String(form.get("role") ?? "STAFF"),
          departmentId:
            String(form.get("departmentId") ?? "").trim() || null
        })
      });

      event.currentTarget.reset();
      await loadUsers("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được nhân sự.");
    } finally {
      setBusy(false);
    }
  }

  async function disableUser(user: UserItem) {
    if (!window.confirm(`Ngưng tài khoản ${user.fullName}?`)) return;

    try {
      await apiFetch(`/v1/users/${user.id}`, { method: "DELETE" });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không ngưng được tài khoản.");
    }
  }

  async function reactivateUser(user: UserItem) {
    try {
      await apiFetch(`/v1/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true })
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kích hoạt lại được.");
    }
  }

  return (
    <main className="shell">
      <AdminHeader />

      <section className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ</p>
          <h1 className="page-title">Nhân sự</h1>
          <p className="muted">
            Quản lý mã nhân viên, khoa/phòng, vai trò và trạng thái tài khoản.
          </p>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="workspace two-columns">
        <form className="panel-form" onSubmit={createUser}>
          <h2>Thêm nhân sự</h2>
          <label>
            Mã nhân sự
            <input name="employeeCode" required placeholder="NV001" />
          </label>
          <label>
            Họ tên
            <input name="fullName" required placeholder="Nguyễn Văn A" />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="email@benhvien.vn" />
          </label>
          <label>
            Điện thoại
            <input name="phone" placeholder="09..." />
          </label>
          <label>
            Vai trò
            <select name="role" defaultValue="STAFF">
              {roles.map((role) => (
                <option value={role} key={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Khoa/phòng
            <select name="departmentId" defaultValue="">
              <option value="">Chưa phân khoa/phòng</option>
              {departments.map((department) => (
                <option value={department.id} key={department.id}>
                  {department.code} · {department.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button primary" disabled={busy} type="submit">
            {busy ? "Đang lưu..." : "Thêm nhân sự"}
          </button>
        </form>

        <section className="data-panel">
          <div className="toolbar">
            <div>
              <h2>Danh sách</h2>
              <small>{users.length} kết quả đang hiển thị</small>
            </div>
            <form
              className="search-form"
              onSubmit={(event) => {
                event.preventDefault();
                void loadUsers();
              }}
            >
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên, mã, email..."
              />
              <button className="button ghost" type="submit">
                Tìm
              </button>
            </form>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nhân sự</th>
                  <th>Khoa/phòng</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.fullName}</strong>
                      <small>{user.employeeCode}</small>
                    </td>
                    <td>{user.department?.name ?? "—"}</td>
                    <td><span className="tag">{user.role}</span></td>
                    <td>
                      <span className={user.isActive ? "state active" : "state"}>
                        {user.isActive ? "Hoạt động" : "Đã ngưng"}
                      </span>
                    </td>
                    <td className="actions">
                      {user.isActive ? (
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() => void disableUser(user)}
                        >
                          Ngưng
                        </button>
                      ) : (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void reactivateUser(user)}
                        >
                          Kích hoạt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
