"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../../../../lib/api";

const errorMessages: Record<string, string> = {
  missing_code_or_state:
    "Đây là URL callback kỹ thuật của Zalo và không nên mở trực tiếp. Hãy trở về trang chủ rồi bắt đầu bằng nút Đăng nhập bằng Zalo.",
  oauth_state_expired:
    "Phiên đăng nhập Zalo đã hết hạn. Hãy trở về trang chủ và thử lại.",
  zalo_account_not_linked:
    "Tài khoản Zalo này chưa được liên kết với hồ sơ nhân sự nội bộ.",
  zalo_account_already_linked:
    "Tài khoản Zalo này đã được liên kết với một nhân sự khác.",
  internal_user_not_found:
    "Không tìm thấy tài khoản nội bộ đang hoạt động để liên kết Zalo.",
  zalo_oauth_failed:
    "Zalo không hoàn tất được quá trình xác thực. Vui lòng thử lại từ trang chủ."
};

export default function ZaloCallbackPage() {
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập Zalo...");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ticket");
    const error = params.get("error");

    if (error) {
      setIsError(true);
      setMessage(
        errorMessages[error] ??
          `Không thể xác thực Zalo: ${error}`
      );
      return;
    }

    if (!ticket) {
      setIsError(true);
      setMessage(
        "Callback không có ticket hợp lệ. Hãy trở về trang chủ và bắt đầu lại luồng đăng nhập."
      );
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
        setIsError(true);
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
            {isError
              ? "Callback chỉ có dữ liệu hợp lệ khi được Zalo chuyển về sau một phiên đăng nhập."
              : "Ticket xác thực chỉ dùng một lần và hết hạn sau vài phút."}
          </p>
        </div>
        <a className="button ghost" href="/">Về trang chủ</a>
      </section>
    </main>
  );
}
