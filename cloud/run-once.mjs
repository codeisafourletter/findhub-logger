import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { coordinatesFromHref, detailsFromLines } from "./collector-core.mjs";
import { loadAuthState, saveAuthState } from "./auth-state-store.mjs";
import { inspectConfiguration } from "./preflight.mjs";
import { CollectorError, reportFailure } from "./diagnostics.mjs";

let stage = "configuration";
let browser;

async function collect() {
  const preflight = await inspectConfiguration();
  if (!preflight.ok) {
    console.error(JSON.stringify(preflight));
    throw new CollectorError("configuration_invalid");
  }

  const FIND_HUB_URL = process.env.FIND_HUB_URL || "https://www.google.com/android/find/people";
  const TARGET_PERSON = process.env.TARGET_PERSON || "Meme";
  const SHEET_ENDPOINT = required("SHEET_ENDPOINT");
  const SHEET_SECRET = required("SHEET_SECRET");
  const AUTH_STATE_B64 = process.env.AUTH_STATE_B64;
  const AUTH_STATE_KEY_B64 = required("AUTH_STATE_KEY_B64");
  const CHROME_BIN = process.env.CHROME_BIN || "/usr/bin/google-chrome";
  const ENCRYPTED_AUTH_PATH = fileURLToPath(new URL("./.auth/auth-state.enc", import.meta.url));

  function required(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  }

  const storageState = await loadAuthState({ encryptedPath: ENCRYPTED_AUTH_PATH, encodedKey: AUTH_STATE_KEY_B64, fallbackBase64: AUTH_STATE_B64 });
  stage = "browser";
  browser = await chromium.launch({ executablePath: CHROME_BIN, headless: true, args: ["--disable-dev-shm-usage", "--no-sandbox"] });
  let page;
  let context;
  let authenticated = false;

  try {
    context = await browser.newContext({ storageState, locale: "en-US" });
    page = await context.newPage();
    stage = "authentication";
    await page.goto(FIND_HUB_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    const signedOut = /accounts\.google\.com/.test(page.url()) || await page.getByText("Sign in", { exact: true }).first().isVisible().catch(() => false);
    if (signedOut) throw new CollectorError("auth_refresh_required");

    stage = "target";
    const card = page.locator('[role="button"]').filter({ hasText: TARGET_PERSON }).first();
    await card.waitFor({ state: "visible", timeout: 30000 });
    authenticated = true;
    if (/Location not available/i.test(await card.innerText())) {
      console.log(JSON.stringify({ ok: true, appended: 0, reason: "Location not available" }));
    } else {
      stage = "location";
      await card.click();
      const directions = page.locator('a[href*="maps/dir/"][href*="destination="]').first();
      await directions.waitFor({ state: "visible", timeout: 30000 });
      const coordinates = coordinatesFromHref(await directions.getAttribute("href"));
      if (!coordinates) throw new CollectorError("location_unavailable");
      const details = detailsFromLines((await page.locator("body").innerText()).split("\n"), TARGET_PERSON);
      const record = { captured_at: new Date().toISOString(), person: TARGET_PERSON, latitude: coordinates.latitude, longitude: coordinates.longitude, ...details };
      stage = "sheet";
      const response = await fetch(SHEET_ENDPOINT, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify({ secret: SHEET_SECRET, records: [record] }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new CollectorError("sheet_write_failed");
      const result = await response.json();
      if (!result.ok) throw new CollectorError("sheet_write_failed");
      console.log(JSON.stringify({ ok: true, appended: Number.isSafeInteger(result.appended) && result.appended >= 0 ? result.appended : 1, captured_at: record.captured_at }));
    }
    stage = "cache";
    await saveAuthState({ state: await context.storageState({ indexedDB: true }), encryptedPath: ENCRYPTED_AUTH_PATH, encodedKey: AUTH_STATE_KEY_B64 });
  } finally {
    if (!authenticated) console.error("AUTH_STATE_NOT_UPDATED");
    await browser.close().catch(() => undefined);
  }

}

try { await collect(); } catch (error) {
  await reportFailure(error, stage);
  process.exitCode = 1;
}
