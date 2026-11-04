# Find Hub history & collector

A private, local browser application for understanding collected location history,
with an optional GitHub Actions collector that appends Google Find Hub observations
to your private Google Sheet.

## Explore history in two minutes

Use Node.js 22 and npm 10:

```sh
cd cloud
npm ci
npm run history
```

Open **http://127.0.0.1:4173** and choose **Explore demo**, or import your own Sheet
CSV / collector JSON. Select an entity to inspect its geographic path, last
collection, source displayed age, timeline and collection gaps. Search by name
or address, filter stale entities, and adjust freshness/gap thresholds.
**Export all JSON** saves the full session; **Clear session** removes it from the tab.

The app makes no external requests and does not save history in browser storage.
Reloading clears the session. Imports replace existing data only after validation;
exports contain private locations and should stay private. Demo records are explicitly
synthetic, including exported demo JSON. No Google authentication is required to explore.
See [history guide and data format](docs/history.md).

## Status

**2.0.0-rc.2 candidate:** adds the usable local history application, retaining
offline setup diagnosis and private-data-safe collector failures. See
[release notes and migration](docs/releases/2.0.0-rc.2.md). This candidate has
not been accepted for live collection.

Implemented; live collection currently needs a renewed Google sign-in. The
2026-10-30 workflow failed because the Google session expired. Refresh it using
the setup helper below. The scheduled workflow is also disabled for inactivity;
re-enable it after refreshing authentication and verify a successful collector run. GitHub schedules
can be delayed or skipped; the five-minute interval is not a delivery guarantee.

## Local checks

Use Node.js 22 and npm 10. From `cloud/`, run `npm ci` then `npm run check`.
PR checks run offline without Google credentials. Production collection is a
separate scheduled workflow.

## Diagnose setup without collecting locations

From `cloud/`, run `npm run doctor` with the configured values supplied through
your normal secure environment. Use `npm run doctor -- --json` for automation.
Missing or malformed configuration produces exit code 1 and names the checks
to fix; no secret values are printed. The doctor reads local rolling state when
present and otherwise inspects `AUTH_STATE_B64`. It does not contact Google or
the Sheet receiver, and a passing result does not prove live authentication.

Collector failures also publish fixed JSON codes and an actionable GitHub job
summary. For example, `auth_refresh_required` means to refresh Google sign-in;
`sheet_write_failed` means to check receiver setup before retrying. Private page
text, coordinates, URLs, and raw remote errors are excluded from failure reports.

## Cloud runtime

The only recurring collector is
`.github/workflows/findhub-every-5-minutes.yml`. The repository is public, so
standard GitHub-hosted runner usage is free. Sensitive values are stored as
GitHub Actions secrets and are never committed.

Required repository secrets:

- `AUTH_STATE_B64`: the initial Google browser session, encoded as base64
- `AUTH_STATE_KEY_B64`: a 32-byte encryption key encoded as base64
- `SHEET_ENDPOINT`: the private Apps Script web-app URL
- `SHEET_SECRET`: the shared secret accepted by the Apps Script receiver

The workflow encrypts and caches refreshed browser state after authenticated
runs. If Google fully expires the account session, a person must sign in again;
Google does not provide a supported Find Hub People API.

## One-time sign-in or session refresh

Local Chrome is used only to authorize the cloud collector. It is not a local
collector and does not need to stay running.

From PowerShell in this repository, run:

```powershell
.\finish-github-setup.ps1
```

Complete Google sign-in in the Chrome window, wait until Find Hub's **People**
page is visible, and then press Enter in PowerShell. The helper uploads the new
session directly to the `AUTH_STATE_B64` GitHub secret. The generated
`cloud/auth-state.json` and Chrome profile are ignored by Git.

After refreshing the session, open **Actions → Find Hub collector** and choose
**Enable workflow** if GitHub shows it as disabled. Then manually run it once
and require a successful result before relying on its schedule. Offline CI does
not refresh the Google session or re-enable collection.

## Verification

Run the offline syntax checks and encrypted-auth tests with:

```powershell
Set-Location .\cloud
npm run check
```

A complete operational verification requires a successful GitHub Actions run
whose collection step reports JSON with `"ok":true`. Offline checks alone do not
prove that the Google session or Sheet endpoint is currently working.

## Reuse

No open-source license has been granted for original repository code. Contact the owner before redistribution; third-party components retain their own licenses.
