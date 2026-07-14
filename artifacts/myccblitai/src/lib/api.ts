export function getApiBaseUrl(): string {
  return "/api/ccb/";
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${trimmed}`;
}
