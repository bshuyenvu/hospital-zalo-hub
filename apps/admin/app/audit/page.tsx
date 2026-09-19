"use client";

import { useEffect, useState } from "react";
import AdminHeader from "../../components/AdminHeader";
import { apiFetch, getToken } from "../../lib/api";

type AuditItem = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  actor: {
    employeeCode: string;
    fullName: string;
    role: string;
  } | null;
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      setError("Hãy đăng nhập từ trang Tổng quan trước.");
      return;
    }

    apiFetch<{ items: AuditItem[] }>("/v1/audit?limit=100")
      .then((data) => setItems(data.items))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Không tải được audit log.")
      );
  }, []);

  return (
    <main className="shell">
      <AdminHeader />

      <section className="page-heading">
        <div>
          <p className="eyebrow">AN TOÀN HỆ THỐNG</p>
          <h1 className="page-title">Audit log</h1>
          <p className="muted">
            Lịch sử đăng nhập và thao tác quản trị quan trọng.
          </p>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="data-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                  <td>
                    <strong>{item.actor?.fullName ?? "Hệ thống"}</strong>
                    <small>{item.actor?.employeeCode ?? "—"}</small>
                  </td>
                  <td><span className="tag">{item.action}</span></td>
                  <td>{item.entityType ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
