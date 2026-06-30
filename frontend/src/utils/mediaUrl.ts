// Empty default = same-origin (served by PHP in prod, proxied by Vite in dev).
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

/** Turn API-relative paths (e.g. /uploads/...) into a full URL for <img src>. */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url || !String(url).trim()) return undefined;
  const u = String(url).trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return `${API_BASE}/${u}`;
}
