import { createHash, randomBytes } from "node:crypto";

const AUTH_URL = "https://oauth.zaloapp.com/v4/permission";
const TOKEN_URL = "https://oauth.zaloapp.com/v4/access_token";
const PROFILE_URL = "https://graph.zalo.me/v2.0/me";

export type ZaloProfile = {
  id: string;
  name: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
  error?: number;
  message?: string;
};

type ZaloTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  error?: number;
  error_name?: string;
  error_reason?: string;
  error_description?: string;
};

export function createPkcePair() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier, "ascii")
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

export function createState() {
  return randomBytes(32).toString("base64url");
}

export function createOneTimeTicket() {
  return randomBytes(32).toString("base64url");
}

export function hashTicket(ticket: string) {
  return createHash("sha256").update(ticket).digest("hex");
}

export function isZaloOAuthConfigured() {
  return Boolean(
    process.env.ZALO_APP_ID?.trim() &&
      process.env.ZALO_APP_SECRET?.trim() &&
      process.env.ZALO_REDIRECT_URI?.trim() &&
      process.env.ZALO_AUTH_SUCCESS_REDIRECT?.trim()
  );
}

function requireZaloConfig() {
  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;
  const redirectUri = process.env.ZALO_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error(
      "Zalo OAuth is not configured. Set ZALO_APP_ID, ZALO_APP_SECRET and ZALO_REDIRECT_URI."
    );
  }

  return { appId, appSecret, redirectUri };
}

export function buildAuthorizationUrl(
  state: string,
  codeChallenge: string
) {
  const { appId, redirectUri } = requireZaloConfig();
  const url = new URL(AUTH_URL);

  url.searchParams.set("app_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string
) {
  const { appId, appSecret } = requireZaloConfig();
  const body = new URLSearchParams({
    code,
    app_id: appId,
    grant_type: "authorization_code",
    code_verifier: codeVerifier
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: appSecret
    },
    body
  });

  const data = (await response.json()) as ZaloTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error_reason ||
        data.error_name ||
        "Zalo token exchange failed."
    );
  }

  return data;
}

export async function getZaloProfile(accessToken: string) {
  const url = new URL(PROFILE_URL);
  url.searchParams.set("fields", "id,name,picture");

  const response = await fetch(url, {
    headers: {
      access_token: accessToken
    }
  });

  const data = (await response.json()) as ZaloProfile;

  if (!response.ok || !data.id || (data.error && data.error !== 0)) {
    throw new Error(data.message || "Could not read Zalo profile.");
  }

  return data;
}
