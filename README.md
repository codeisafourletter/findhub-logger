# Find Hub cloud location logger

This project runs only in GitHub Actions. On an intended five-minute schedule, a GitHub-hosted
Chrome session reads the location explicitly shared by `Meme` in Google Find
Hub and appends a timestamped record to the configured private Google Sheet.
The computer does not need to remain on.

## Status

Implemented; live collection currently needs a renewed Google sign-in. The
2026-10-30 workflow failed because the Google session expired. Refresh it using
the setup helper below. The scheduled workflow is also disabled for inactivity;
re-enable it after refreshing authentication and verify a successful collector run. GitHub schedules
can be delayed or skipped; the five-minute interval is not a delivery guarantee.

## Local checks

Use Node.js 22 and npm 10. From `cloud/`, run `npm ci` then `npm run check`.
PR checks run offline without Google credentials. Production collection is a
separate scheduled workflow.

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
