type ApiErrorBody = { error?: string };

async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/firm${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(payload.error || "The request could not be completed.");
  }
  return response.json() as Promise<T>;
}

export type FirmSession = {
  manager: boolean;
  staff: boolean;
  workspaceId?: number;
};

export const getFirmSession = () => authRequest<FirmSession>("/auth/session");
export const sendManagerSetupCode = () =>
  authRequest<{ sent: true }>("/auth/manager/setup/send", {});
export const verifyManagerSetupCode = (code: string, password: string) =>
  authRequest<{ updated: true }>("/auth/manager/setup/verify", { code, password });
export const fullFirmSignout = () =>
  authRequest<{ manager: false; staff: false }>("/auth/signout", {});