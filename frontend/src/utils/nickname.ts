/** Rules mirror the API: letters, numbers, spaces, _, -, — (em dash) only. */
const NICKNAME_RE = /^[\p{L}\p{N}\s_\-—]+$/u;

export const MAX_NICKNAME_LENGTH = 50;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function validateNicknameInput(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return null;
  if (t.length > MAX_NICKNAME_LENGTH) {
    return `Nickname must be at most ${MAX_NICKNAME_LENGTH} characters.`;
  }
  if (!NICKNAME_RE.test(t)) {
    return "Use only letters, numbers, spaces, underscore (_), hyphen (-), or em dash (—).";
  }
  return null;
}

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Choose a JPEG, PNG, GIF, or WebP image.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return `Image must be at most ${MAX_AVATAR_BYTES / 1024 / 1024} MB.`;
  }
  return null;
}
