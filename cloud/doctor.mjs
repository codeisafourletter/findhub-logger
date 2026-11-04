import { inspectConfiguration } from "./preflight.mjs";

const report = await inspectConfiguration();
if (process.argv.includes("--json")) console.log(JSON.stringify(report));
else {
  console.log("Find Hub doctor: offline configuration only; Google authentication is not verified.");
  for (const check of report.checks) console.log(`${check.status.toUpperCase()} ${check.name}: ${check.action}`);
}
process.exitCode = report.ok ? 0 : 1;
