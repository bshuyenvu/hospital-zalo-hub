"use client";

import { useEffect, useState } from "react";
import AdminHeader from "../../../components/AdminHeader";
import { apiFetch, getToken } from "../../../lib/api";

type IntegrationStatus = {
  socialOAuth: {
    ready: boolean;
    appIdConfigured: boolean;
    appSecretConfigured: boolean;
    redirectUriConfigured: boolean;
    successRedirectConfigured: boolean;
    redirectUri: string | null;
    successRedirect: string | null;
  };
  officialAccount: {
    ready: boolean;
    oauthConfigured: boolean;
    connected: boolean;
    oaId: string | null;
    oaName: string | null;
    accessExpiresAt: string | null;
    refreshExpiresAt: string | null;
    connectedAt: string | null;
    redirectUri: string | null;
    codeChallenge: string | null;
    webhookSecretConfigured: boolean;
  };
  miniApp: {
    ready: boolean;
    miniAppIdConfigured: boolean;
  };
  security: {
    productionReady: boolean;
    devAuthEnabled: boolean;
    sessionSecretSafe: boolean;
  };
  overallReady: boolean;
};

function Mark({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? "state active" : "state"}>
      {ok ? "Đã cấu hình" : "Chưa cấu hình"}
    </span>
  );
}

function dateText(value: string | null) {
  if (!value) return "Không có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export default function ZaloIntegrationPage() {
  const [data, setData] = useState<IntegrationStatus | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!getToken()) {
      setError("Hãy đăng nhập bằng tài khoản Admin trước.");
      return;
    }

    try {
      const status = await apiFetch<IntegrationStatus>(
        "/v1/integrations/zalo/status"
      );
      setData(status);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không đọc được trạng thái tích hợp Zalo."
      );
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oa = params.get("oa");
    if (oa === "connected") {
      setNotice("Đã kết nối Zalo Official Account thành công.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (oa === "error") {
      setError(
        `Kết nối Zalo OA thất bại: ${params.get("reason") ?? "unknown"}`
      );
      window.history.replaceState({}, "", window.location.pathname);
    }

    void load();
  }, []);

  async function connectOA() {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await apiFetch<{ authorizationUrl: string }>(
        "/v1/integrations/zalo/oa/start"
      );
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không khởi tạo được OA OAuth."
      );
      setBusy(false);
    }
  }

  async function refreshOA() {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await apiFetch("/v1/integrations/zalo/oa/refresh", {
        method: "POST"
      });
      setNotice("Đã làm mới OA access token.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không làm mới được OA token."
      );
    } finally {
      setBusy(false);
    }
  }

  async function disconnectOA() {
    if (!window.confirm("Ngắt kết nối Zalo Official Account khỏi Hospital Hub?")) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await apiFetch("/v1/integrations/zalo/oa", {
        method: "DELETE"
      });
      setNotice("Đã ngắt kết nối Zalo OA.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không ngắt được kết nối OA."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <AdminHeader />

      <section className="page-heading">
        <div>
          <p className="eyebrow">TÍCH HỢP</p>
          <h1 className="page-title">Zalo</h1>
          <p className="muted">
            Social OAuth, Official Account và Mini App được kiểm tra mà không
            hiển thị App Secret, access token hay refresh token.
          </p>
        </div>
        {data && (
          <span className={data.overallReady ? "status" : "status pending"}>
            <span className="dot" />
            {data.overallReady ? "Sẵn sàng production" : "Cần cấu hình thêm"}
          </span>
        )}
      </section>

      {notice && <div className="alert">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      {data && (
        <>
          <section className="grid integration-grid">
            <article className="card">
              <p>Social OAuth V4</p>
              <strong>{data.socialOAuth.ready ? "Ready" : "Pending"}</strong>
              <Mark ok={data.socialOAuth.ready} />
            </article>
            <article className="card">
              <p>Zalo Official Account</p>
              <strong>{data.officialAccount.ready ? "Ready" : "Pending"}</strong>
              <Mark ok={data.officialAccount.ready} />
            </article>
            <article className="card">
              <p>Zalo Mini App</p>
              <strong>{data.miniApp.ready ? "Ready" : "Pending"}</strong>
              <Mark ok={data.miniApp.ready} />
            </article>
            <article className="card">
              <p>Production security</p>
              <strong>{data.security.productionReady ? "Ready" : "Pending"}</strong>
              <Mark ok={data.security.productionReady} />
            </article>
          </section>

          <section className="data-panel config-panel">
            <div className="toolbar">
              <div>
                <p className="eyebrow">SOCIAL OAUTH V4</p>
                <h2>Web Login / Account Linking</h2>
              </div>
              <Mark ok={data.socialOAuth.ready} />
            </div>
            <div className="config-list">
              <div><span>ZALO_APP_ID</span><Mark ok={data.socialOAuth.appIdConfigured} /></div>
              <div><span>ZALO_APP_SECRET</span><Mark ok={data.socialOAuth.appSecretConfigured} /></div>
              <div><span>ZALO_REDIRECT_URI</span><Mark ok={data.socialOAuth.redirectUriConfigured} /></div>
              <div><span>ZALO_AUTH_SUCCESS_REDIRECT</span><Mark ok={data.socialOAuth.successRedirectConfigured} /></div>
            </div>
            <div className="config-note">
              <strong>Callback API</strong>
              <code>{data.socialOAuth.redirectUri ?? "Chưa cấu hình"}</code>
              <strong>Callback Web Admin</strong>
              <code>{data.socialOAuth.successRedirect ?? "Chưa cấu hình"}</code>
            </div>
          </section>

          <section className="data-panel config-panel">
            <div className="toolbar">
              <div>
                <p className="eyebrow">OFFICIAL ACCOUNT OAUTH</p>
                <h2>{data.officialAccount.oaName ?? "Zalo Official Account"}</h2>
              </div>
              <div className="login-actions">
                {data.officialAccount.connected ? (
                  <>
                    <button
                      type="button"
                      className="button ghost"
                      disabled={busy}
                      onClick={() => void refreshOA()}
                    >
                      Làm mới token
                    </button>
                    <button
                      type="button"
                      className="button ghost"
                      disabled={busy}
                      onClick={() => void disconnectOA()}
                    >
                      Ngắt kết nối
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="button primary"
                    disabled={busy || !data.officialAccount.oauthConfigured}
                    onClick={() => void connectOA()}
                  >
                    {busy ? "Đang xử lý..." : "Kết nối OA"}
                  </button>
                )}
              </div>
            </div>

            <div className="config-list">
              <div>
                <span>OA OAuth/PKCE server</span>
                <Mark ok={data.officialAccount.oauthConfigured} />
              </div>
              <div>
                <span>OA đã cấp quyền</span>
                <Mark ok={data.officialAccount.connected} />
              </div>
              <div>
                <span>OA Webhook Secret (tùy chọn)</span>
                <Mark ok={data.officialAccount.webhookSecretConfigured} />
              </div>
              <div>
                <span>ZALO_MINI_APP_ID</span>
                <Mark ok={data.miniApp.miniAppIdConfigured} />
              </div>
            </div>

            <div className="config-note">
              <strong>OA Callback URL</strong>
              <code>{data.officialAccount.redirectUri ?? "Chưa cấu hình"}</code>
              <strong>Code Challenge</strong>
              <code>{data.officialAccount.codeChallenge ?? "Chưa cấu hình"}</code>
              <strong>OA ID</strong>
              <code>{data.officialAccount.oaId ?? "Chưa kết nối"}</code>
              <strong>Access token hết hạn</strong>
              <code>{dateText(data.officialAccount.accessExpiresAt)}</code>
              <strong>Refresh token hết hạn</strong>
              <code>{dateText(data.officialAccount.refreshExpiresAt)}</code>
            </div>
          </section>

          <section className="data-panel config-panel">
            <div className="toolbar">
              <div>
                <p className="eyebrow">SECURITY</p>
                <h2>Điều kiện trước production</h2>
              </div>
              <Mark ok={data.security.productionReady} />
            </div>
            <div className="config-list">
              <div>
                <span>Dev login phải tắt</span>
                <Mark ok={!data.security.devAuthEnabled} />
              </div>
              <div>
                <span>SESSION_SECRET tối thiểu 32 ký tự và không dùng giá trị mẫu</span>
                <Mark ok={data.security.sessionSecretSafe} />
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
