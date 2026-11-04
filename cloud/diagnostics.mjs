import { appendFile } from "node:fs/promises";

const messages = {
  configuration_invalid: "Run npm run doctor and correct the named configuration checks.",
  auth_refresh_required: "Run finish-github-setup.ps1, complete Google sign-in, then verify one manual collector run.",
  target_unavailable: "Check that location sharing is still enabled and TARGET_PERSON matches the visible Find Hub card.",
  location_unavailable: "The selected card did not expose coordinates. Check Find Hub manually before retrying.",
  sheet_write_failed: "Check the Sheet receiver deployment and its shared secret. A retry may duplicate a write whose response was lost.",
  auth_cache_failed: "The collection completed but rolling authentication could not be saved. Inspect cache access before the next run.",
  browser_failed: "Check CHROME_BIN and the installed browser, then retry the collector.",
  collector_failed: "Check Google availability and the collector setup. No private page content is included in this diagnostic."
};

export class CollectorError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function failureSummary(error, stage) {
  const stages = { browser: "browser_failed", target: "target_unavailable", location: "location_unavailable", sheet: "sheet_write_failed", cache: "auth_cache_failed" };
  const code = error instanceof CollectorError && Object.hasOwn(messages, error.code)
    ? error.code : (Object.hasOwn(stages, stage) ? stages[stage] : "collector_failed");
  return { ok: false, code, action: messages[code] };
}

export async function reportFailure(error, stage, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  const report = failureSummary(error, stage);
  console.error(JSON.stringify(report));
  if (summaryPath) {
    await appendFile(summaryPath, `## Find Hub collector failed\n\n**${report.code}**\n\n${report.action}\n`).catch(() => undefined);
  }
  return report;
}
