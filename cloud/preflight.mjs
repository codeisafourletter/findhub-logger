import { fileURLToPath } from "node:url";
import { loadAuthState } from "./auth-state-store.mjs";

export const defaultAuthPath = fileURLToPath(new URL("./.auth/auth-state.enc", import.meta.url));
export function isBase64(value) {
  return typeof value === "string" && value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value) && Buffer.from(value, "base64").toString("base64") === value;
}

export async function inspectConfiguration(environment = process.env, { encryptedPath = defaultAuthPath, now = Date.now() } = {}) {
  const checks = [];
  const add = (name, status, action) => checks.push({ name, status, action });
  const key = environment.AUTH_STATE_KEY_B64;
  const validKey = isBase64(key) && Buffer.from(key, "base64").length === 32;
  add("AUTH_STATE_KEY_B64", validKey ? "pass" : "fail", validKey ? "32-byte encryption key is configured." : "Configure a base64-encoded 32-byte key; never paste it into logs.");
  let validEndpoint = false;
  try { const endpoint = new URL(environment.SHEET_ENDPOINT); validEndpoint = endpoint.protocol === "https:" && !endpoint.username && !endpoint.password; } catch { /* No values in diagnostics. */ }
  add("SHEET_ENDPOINT", validEndpoint ? "pass" : "fail", validEndpoint ? "HTTPS receiver URL is configured." : "Configure the HTTPS Sheet receiver URL without embedded credentials.");
  add("SHEET_SECRET", environment.SHEET_SECRET?.trim() ? "pass" : "fail", environment.SHEET_SECRET?.trim() ? "Receiver shared secret is configured." : "Configure the same shared secret used by the Sheet receiver.");
  let state;
  if (validKey) {
    try {
      state = await loadAuthState({ encryptedPath, encodedKey: key, fallbackBase64: environment.AUTH_STATE_B64 });
      if (!Array.isArray(state?.cookies) || !Array.isArray(state?.origins) || state.cookies.some(cookie => typeof cookie?.name !== "string" || typeof cookie?.value !== "string")) throw new Error("invalid storage state");
      add("AUTH_STATE", "pass", "Saved browser-state structure is readable; Google authentication is not verified.");
      const cookies = state.cookies;
      if (!cookies.length || cookies.every(cookie => typeof cookie.expires === "number" && cookie.expires > 0 && cookie.expires * 1000 <= now)) {
        add("AUTH_EXPIRY", "warn", "No unexpired or session cookies were found. Refresh Google sign-in before relying on collection.");
      }
    } catch {
      add("AUTH_STATE", "fail", "Browser state is missing, malformed, or cannot be decrypted. Refresh sign-in; if the key changed, reset the rolling cache epoch too.");
    }
  } else add("AUTH_STATE", "not_checked", "A valid encryption key is required to inspect saved browser state.");
  return { ok: !checks.some(check => check.status === "fail"), scope: "offline_configuration_only", liveAuthentication: "not_verified", checks };
}
