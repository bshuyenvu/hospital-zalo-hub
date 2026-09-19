"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminHeader from "../../components/AdminHeader";
import { apiFetch, getToken } from "../../lib/api";

type Department = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  activeUsers: number;
};

export default function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!getToken()) {
      setError("Hãy đăng nhập từ trang Tổng quan trước.");
      return;
    }

    try {
      const data = await apiFetch<{ items: Department[] }>(
        "/v1/departments?includeInactive=true"
      );
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được khoa/phòng.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    try {
      await apiFetch("/v1/departments", {
        method: "POST",
        body: JSON.stringify({
          code: String(form.get("code") ?? ""),
          name: String(form.get("name") ?? "")
        })
      });
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được khoa/phòng.");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(item: Department, active: boolean) {
    try {
      if (active) {
        await apiFetch(`/v1/departments/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: true })
        });
      } else {
        await apiFetch(`/v1/departments/${item.id}`, {
          method: "DELETE"
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được.");
    }
  }

  return (
    <main className="shell">
      <AdminHeader />

      <section className="page-heading">
        <div>
          <p className="eyebrow">CƠ CẤU TỔ CHỨC</p>
          <h1 className="page-title">Khoa / Phòng</h1>
          <p className="muted">
            Danh mục đơn vị dùng chung cho phân quyền và danh bạ nội bộ.
          </p>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="workspace two-columns">
        <form className="panel-form" onSubmit={createDepartment}>
          <h2>Thêm khoa/phòng</h2>
          <label>
            Mã đơn vị
            <input name="code" required placeholder="HSTC" />
          </label>
          <label>
            Tên khoa/phòng
            <input name="name" required placeholder="Khoa Hồi sức tích cực" />
          </label>
          <button className="button primary" disabled={busy} type="submit">
            {busy ? "Đang lưu..." : "Thêm khoa/phòng"}
          </button>
        </form>

        <section className="data-panel">
          <div className="toolbar">
            <div>
              <h2>Danh mục</h2>
              <small>{items.length} đơn vị</small>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Khoa/phòng</th>
                  <th>Nhân sự</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><span className="tag">{item.code}</span></td>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.activeUsers}</td>
                    <td>
                      <span className={item.isActive ? "state active" : "state"}>
                        {item.isActive ? "Hoạt động" : "Đã ngưng"}
                      </span>
                    </td>
                    <td className="actions">
                      {item.isActive ? (
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() => void setActive(item, false)}
                        >
                          Ngưng
                        </button>
                      ) : (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void setActive(item, true)}
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
