import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { inspectConfiguration } from "./preflight.mjs";
import { encryptAuthState } from "./auth-state-store.mjs";
import { CollectorError, failureSummary } from "./diagnostics.mjs";

const marker = "PRIVATE_COOKIE_ADDRESS_TOKEN";
const state = { cookies: [{ name: "session", value: marker, expires: -1 }], origins: [] };
const environment = {
  AUTH_STATE_KEY_B64: Buffer.alloc(32, 7).toString("base64"),
  AUTH_STATE_B64: Buffer.from(JSON.stringify(state)).toString("base64"),
  SHEET_ENDPOINT: `https://example.test/receiver?token=${marker}`,
  SHEET_SECRET: marker
};

async function withDirectory(fn) {
  const directory = await mkdtemp(join(tmpdir(), "findhub-doctor-"));
  try { return await fn(join(directory, "auth.enc")); } finally { await rm(directory, { recursive: true, force: true }); }
}

test("doctor validates configuration offline without exposing any values", () => withDirectory(async encryptedPath => {
  const report = await inspectConfiguration(environment, { encryptedPath });
  assert.equal(report.ok, true);
  assert.equal(report.liveAuthentication, "not_verified");
  assert.equal(JSON.stringify(report).includes(marker), false);
  assert.equal(JSON.stringify(report).includes(environment.AUTH_STATE_KEY_B64), false);
  assert.equal(JSON.stringify(report).includes(environment.AUTH_STATE_B64), false);
}));

test("missing settings and malformed keys fail with named actions", () => withDirectory(async encryptedPath => {
  const report = await inspectConfiguration({}, { encryptedPath });
  assert.equal(report.ok, false);
  assert.deepEqual(report.checks.filter(check => check.status === "fail").map(check => check.name), ["AUTH_STATE_KEY_B64", "SHEET_ENDPOINT", "SHEET_SECRET"]);
  const malformed = await inspectConfiguration({ ...environment, AUTH_STATE_KEY_B64: environment.AUTH_STATE_KEY_B64 + "!" }, { encryptedPath });
  assert.equal(malformed.ok, false);
}));

test("non-HTTPS and embedded credential endpoints fail without echoing the URL", () => withDirectory(async encryptedPath => {
  for (const SHEET_ENDPOINT of [`http://example.test/${marker}`, `https://user:${marker}@example.test/`]) {
    const report = await inspectConfiguration({ ...environment, SHEET_ENDPOINT }, { encryptedPath });
    assert.equal(report.ok, false);
    assert.equal(JSON.stringify(report).includes(marker), false);
  }
}));

test("expired bootstrap cookies warn without claiming live authentication is known", () => withDirectory(async encryptedPath => {
  const expired = { cookies: [{ name: "session", value: marker, expires: 1 }], origins: [] };
  const report = await inspectConfiguration({ ...environment, AUTH_STATE_B64: Buffer.from(JSON.stringify(expired)).toString("base64") }, { encryptedPath, now: 5000 });
  assert.equal(report.ok, true);
  assert.equal(report.checks.find(check => check.name === "AUTH_EXPIRY").status, "warn");
  assert.equal(report.liveAuthentication, "not_verified");
}));

test("rolling encrypted state is authoritative and corruption fails closed", () => withDirectory(async encryptedPath => {
  await writeFile(encryptedPath, encryptAuthState(state, environment.AUTH_STATE_KEY_B64));
  const report = await inspectConfiguration({ ...environment, AUTH_STATE_B64: undefined }, { encryptedPath });
  assert.equal(report.ok, true);
  await writeFile(encryptedPath, "corrupted " + marker);
  const corrupt = await inspectConfiguration(environment, { encryptedPath });
  assert.equal(corrupt.ok, false);
  assert.equal(JSON.stringify(corrupt).includes(marker), false);
}));

test("failure reports use fixed codes and never echo remote or browser errors", () => {
  for (const stage of ["browser", "authentication", "target", "location", "sheet", "cache", "toString", marker]) {
    const report = failureSummary(new Error(marker), stage);
    assert.equal(report.ok, false);
    assert.equal(JSON.stringify(report).includes(marker), false);
  }
  assert.equal(failureSummary(new CollectorError("auth_refresh_required"), "authentication").code, "auth_refresh_required");
  assert.equal(failureSummary({ code: "auth_refresh_required", message: marker }, "sheet").code, "sheet_write_failed");
});

test("doctor CLI exits nonzero and emits valid JSON for missing configuration", () => {
  const env = { PATH: process.env.PATH };
  const child = spawnSync(process.execPath, [new URL("./doctor.mjs", import.meta.url).pathname, "--json"], { env, encoding: "utf8" });
  assert.equal(child.status, 1);
  assert.equal(JSON.parse(child.stdout).scope, "offline_configuration_only");
  assert.equal(child.stderr, "");
});

 test("collector stops before browser startup when configuration is missing", () => {
  const child = spawnSync(process.execPath, [new URL("./run-once.mjs", import.meta.url).pathname], { env: { PATH: process.env.PATH, CHROME_BIN: "/nonexistent-browser" }, encoding: "utf8" });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  const reports = child.stderr.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(reports[0].scope, "offline_configuration_only");
  assert.equal(reports[1].code, "configuration_invalid");
});
