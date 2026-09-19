export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type SessionUser = {
  sub: string;
  employeeCode: string;
  fullName: string;
  role: string;
  departmentId: string | null;
};

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("hospital_hub_token");
}

export function clearToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("hospital_hub_token");
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  tokenOverride?: string | null
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenOverride === undefined ? getToken() : tokenOverride;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};

  if (!response.ok) {
    throw new Error(
      data?.message ?? `API error ${response.status}: ${response.statusText}`
    );
  }

  return data as T;
}

export async function devLogin(employeeCode = "ADMIN001") {
  const data = await apiFetch<{
    token: string;
    expiresIn: string;
    user: {
      id: string;
      employeeCode: string;
      fullName: string;
      role: string;
      department?: { id: string; code: string; name: string } | null;
    };
  }>(
    "/v1/auth/dev-login",
    {
      method: "POST",
      body: JSON.stringify({ employeeCode })
    },
    null
  );

  window.localStorage.setItem("hospital_hub_token", data.token);
  return data;
}
