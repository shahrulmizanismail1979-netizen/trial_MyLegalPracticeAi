export function requireGeneratedText(
  payload: unknown,
  field: string,
  label = "AI response",
): string {
  if (!payload || typeof payload !== "object") {
    throw new Error(`${label} was not returned. Please try again.`);
  }
  const value = (payload as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} was incomplete. Please try again.`);
  }
  return value;
}