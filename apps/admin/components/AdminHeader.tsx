"use client";

import { clearToken, getToken } from "../lib/api";

export default function AdminHeader() {
  const loggedIn = Boolean(getToken());

  function logout() {
    clearToken();
    window.location.href = "/";
  }

  return (
    <header className="admin-header">
      <a className="brand" href="/">
        <span className="brand-mark">H</span>
        <span>
          <strong>Hospital Hub</strong>
          <small>Cổng nội bộ</small>
        </span>
      </a>

      <nav className="admin-nav" aria-label="Điều hướng quản trị">
        <a href="/">Tổng quan</a>
        <a href="/users">Nhân sự</a>
        <a href="/departments">Khoa/phòng</a>
        <a href="/directory">Danh bạ</a>
        <a href="/audit">Audit</a>
      </nav>

      {loggedIn ? (
        <button className="button ghost small" type="button" onClick={logout}>
          Đăng xuất
        </button>
      ) : (
        <span className="pill">Chưa đăng nhập</span>
      )}
    </header>
  );
}
