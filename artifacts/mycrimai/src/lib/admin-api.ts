const API_BASE = "/api/crim";

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

export const adminApi = {
  login: (password: string) =>
    request("/admin/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request("/admin/logout", { method: "POST" }),
  session: () => request("/admin/session"),

  listAccessCodes: () => request("/admin/access-codes"),
  createAccessCode: (label: string, expiresAt?: string | null) =>
    request("/admin/access-codes", { method: "POST", body: JSON.stringify({ label, expiresAt }) }),
  bulkCreateAccessCodes: (count: number, labelPrefix: string, expiresAt?: string | null) =>
    request("/admin/access-codes/bulk", { method: "POST", body: JSON.stringify({ count, labelPrefix, expiresAt }) }),
  updateAccessCode: (id: number, updates: { label?: string; isActive?: boolean; expiresAt?: string | null }) =>
    request(`/admin/access-codes/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
  releaseAccessCode: (id: number) =>
    request(`/admin/access-codes/${id}/release`, { method: "POST" }),
  deleteAccessCode: (id: number) =>
    request(`/admin/access-codes/${id}`, { method: "DELETE" }),

  list: (resource: string) => request(`/admin/${resource}`),
  create: (resource: string, data: any) =>
    request(`/admin/${resource}`, { method: "POST", body: JSON.stringify(data) }),
  update: (resource: string, id: number, data: any) =>
    request(`/admin/${resource}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (resource: string, id: number) =>
    request(`/admin/${resource}/${id}`, { method: "DELETE" }),
};
