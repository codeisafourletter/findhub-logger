# History application

Run `npm run history` from `cloud/`, then open http://127.0.0.1:4173. The server binds to the loopback interface and serves only `app/`; it does not serve collector state or call Google. Stop it with Ctrl+C.

## Complete a history review

1. Choose **Explore demo** for six synthetic observations across two labeled entities. One is stale and the other has a gap. Demo times are anchored to when you click the button. No live device was contacted.
2. For your data, export the private collection Sheet as CSV and choose **Import history**. JSON arrays and JSON objects containing `records` work too. Imports replace the current session after all rows validate. Files are read in your browser, not uploaded to the local server or another service.
3. Select an entity. The collector currently records `person`, so the app groups by that label. It does not discover devices or infer identities. A source label may describe a person or a device.
4. Review **Last collected** alongside **Source displayed age**. A recent collection can contain an old location. The collector does not expose a verified location-fix timestamp. The application does not claim a device is currently online.
5. Review the geographic plot and newest-first timeline. The plot uses latitude and longitude with independent axis scales, north up, and no map tiles or geocoding. Connecting lines are not verified travel routes; crossings of the date line can look misleading. For large imports the plot samples observations, while the latest 500 appear in the timeline and exports retain everything.
6. Filter stale entities or search a name/address. Change the stale threshold (default 60 minutes) and gap threshold (default 30 minutes). Gaps are elapsed intervals between consecutive imported observations, not evidence of offline devices. The latest 20 gaps are listed. Trailing missing time appears in the stale alert. Freshness recalculates once per minute while this tab is open.
7. Follow an in-app stale alert: import a fresh Sheet export first. If the Sheet is also stale, inspect the collector Actions run and refresh expired authentication or enable its disabled schedule as needed. This application cannot determine which cause applies. Alerts remain in this tab; no push, email or other external notification is sent.
8. Choose **Export all JSON** to preserve every imported record, including entities hidden by filters. Choose **Clear session** or reload to remove in-memory data. Previously downloaded files are not deleted.

## Import schema

Required fields match the collector: `captured_at`, `person`, `latitude`, `longitude`. Optional fields: `address`, `battery`, `displayed_age`. Timestamps must be ISO 8601 with a timezone, for example `2026-11-04T12:30:00Z`; coordinates must be valid decimal degrees. CSV accepts quoted commas/newlines and doubled quotes, including Google Sheets exports with these headers.

```json
[
  {
    "captured_at": "2026-11-04T12:30:00Z",
    "person": "Example phone",
    "latitude": 37.77,
    "longitude": -122.42,
    "address": "Synthetic example",
    "battery": "75%",
    "displayed_age": "2 minutes ago"
  }
]
```

Limits are 20 MB per file and 50,000 rows. Identical records are deduplicated, timestamps are normalized to UTC, and unknown fields are omitted. An invalid record rejects the entire import with a row number, keeping the current session intact. Export JSON has `format`, `version`, `demo`, and `records` fields. Exported demo provenance survives reimport. All time labels render in the browser's timezone; the exact latest UTC timestamp is also displayed.

## Privacy and limitations

No browser persistence, account, telemetry, remote fonts, map service, automatic Sheet connection or external requests. The app's content security policy disables network connections from scripts. Imports remain in tab memory until clearing/reloading. This is not a remote wipe or a guarantee against access by other software on your computer. Exports contain real coordinates and source addresses when you import private history.

Google authentication is still expired in the production collector and its schedule was disabled for inactivity at the last operational audit. Demo and offline/browser tests do not change that. Follow the README sign-in refresh instructions before trusting future collection.
