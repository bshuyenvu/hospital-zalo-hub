"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminHeader from "../../components/AdminHeader";
import { apiFetch, getToken } from "../../lib/api";

type DirectoryUser = {
  id: string;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  role: string;
  department: { id: string; code: string; name: string } | null;
};

export default function DirectoryPage() {
  const [items, setItems] = useState<DirectoryUser[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function load(term = search) {
    if (!getToken()) {
      setError("Hãy đăng nhập từ trang Tổng quan trước.");
      return;
    }

    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set("search", term.trim());
      const data = await apiFetch<{ items: DirectoryUser[] }>(
        `/v1/directory?${params.toString()}`
      );
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh bạ.");
    }
  }

  useEffect(() => {
    void load("");
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  return (
    <main className="shell">
      <AdminHeader />

      <section className="page-heading">
        <div>
          <p className="eyebrow">TRA CỨU NỘI BỘ</p>
          <h1 className="page-title">Danh bạ</h1>
          <p className="muted">Tìm nhanh nhân sự đang hoạt động theo tên hoặc mã.</p>
        </div>
        <form className="search-form large" onSubmit={submit}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nhập tên hoặc mã nhân sự"
          />
          <button className="button primary" type="submit">Tìm kiếm</button>
        </form>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="directory-grid">
        {items.map((item) => (
          <article className="person-card" key={item.id}>
            <div className="person-avatar">
              {item.fullName
                .split(" ")
                .slice(-2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <strong>{item.fullName}</strong>
              <p>{item.department?.name ?? "Chưa phân khoa/phòng"}</p>
              <small>{item.employeeCode} · {item.role}</small>
              {item.phone && <a href={`tel:${item.phone}`}>{item.phone}</a>}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
