"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../../../../lib/api";

export default function ZaloCallbackPage() {
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập Zalo...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ticket");
    const error = params.get("error");

    if (error) {
      setMessage(`Không thể xác thực Zalo: ${error}`);
      return;
    }

    if (!ticket) {
      setMessage("Callback không có ticket hợp lệ.");
      return;
    }

    fetch(`${API_URL}/v1/auth/zalo/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket })
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message ?? "Không hoàn tất được đăng nhập.");
        }

        window.localStorage.setItem("hospital_hub_token", data.token);
        window.location.replace("/");
      })
      .catch((err) => {
        setMessage(
          err instanceof Error ? err.message : "Không hoàn tất được đăng nhập."
        );
      });
  }, []);

  return (
    <main className="shell auth-callback">
      <section className="login-panel">
        <div>
          <p className="eyebrow">ZALO OAUTH</p>
          <h2>{message}</h2>
          <p className="muted">
            Ticket xác thực chỉ dùng một lần và hết hạn sau vài phút.
          </p>
        </div>
        <a className="button ghost" href="/">Về trang chủ</a>
      </section>
    </main>
  );
}
