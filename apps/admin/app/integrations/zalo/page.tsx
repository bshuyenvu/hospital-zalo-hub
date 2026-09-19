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
    oaIdConfigured: boolean;
    oaSecretConfigured: boolean;
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

export default function ZaloIntegrationPage() {
  const [data, setData] = useState<IntegrationStatus | null>(null);
  const [error, setError] = useState("");

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
    void load();
  }, []);

  return (
    <main className="shell">
      <AdminHeader />

      <section className="page-heading">
        <div>
          <p className="eyebrow">TÍCH HỢP</p>
          <h1 className="page-title">Zalo</h1>
          <p className="muted">
            Kiểm tra cấu hình Social OAuth, Official Account, Mini App và các
            điều kiện production mà không hiển thị khóa bí mật.
          </p>
        </div>
        {data && (
          <span className={data.overallReady ? "status" : "status pending"}>
            <span className="dot" />
            {data.overallReady ? "Sẵn sàng production" : "Cần cấu hình thêm"}
          </span>
        )}
      </section>

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
                <p className="eyebrow">OA + MINI APP</p>
                <h2>Kênh Zalo nội bộ</h2>
              </div>
            </div>
            <div className="config-list">
              <div><span>ZALO_OA_ID</span><Mark ok={data.officialAccount.oaIdConfigured} /></div>
              <div><span>ZALO_OA_SECRET</span><Mark ok={data.officialAccount.oaSecretConfigured} /></div>
              <div><span>ZALO_MINI_APP_ID</span><Mark ok={data.miniApp.miniAppIdConfigured} /></div>
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
