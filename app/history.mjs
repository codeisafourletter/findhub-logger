export const fields = ['captured_at', 'person', 'latitude', 'longitude', 'address', 'battery', 'displayed_age'];
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else if (quoted || !cell) quoted = !quoted; else throw new Error('Unexpected quote in CSV.'); }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map(v => v.trim().replace(/^\uFEFF/, '')) || [];
  if (!['captured_at', 'person', 'latitude', 'longitude'].every(key => headers.includes(key))) throw new Error('CSV needs captured_at, person, latitude and longitude headers.');
  return rows.map((values, index) => { if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`); return Object.fromEntries(headers.map((key, i) => [key, values[i]])); });
}
export function normalizeHistory(input) {
  const rows = Array.isArray(input) ? input : input?.records;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Import a nonempty array of records or an object with a records array.');
  if (rows.length > 50000) throw new Error('Import up to 50,000 records at a time.');
  const unique = new Map();
  rows.forEach((row, i) => {
    const timestamp = typeof row?.captured_at === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.captured_at) ? Date.parse(row.captured_at) : NaN;
    const latitude = !['number', 'string'].includes(typeof row?.latitude) || String(row.latitude).trim() === '' ? NaN : Number(row.latitude);
    const longitude = !['number', 'string'].includes(typeof row?.longitude) || String(row.longitude).trim() === '' ? NaN : Number(row.longitude);
    if (!Number.isFinite(timestamp) || typeof row?.person !== 'string' || !row.person.trim() || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error(`Record ${i + 1}: use an ISO timestamp with timezone, person, and valid latitude/longitude.`);
    const record = { captured_at: new Date(timestamp).toISOString(), person: row.person.trim(), latitude, longitude };
    for (const key of ['address', 'battery', 'displayed_age']) record[key] = row[key] == null ? '' : String(row[key]);
    unique.set(JSON.stringify(fields.map(key => record[key])), record);
  });
  return [...unique.values()].sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at));
}
export function readHistory(text, filename = '') { return normalizeHistory(filename.toLowerCase().endsWith('.csv') ? parseCSV(text) : JSON.parse(text)); }
export function groups(records, now = Date.now(), staleMinutes = 60, gapMinutes = 30) {
  const grouped = new Map();
  for (const row of records) { if (!grouped.has(row.person)) grouped.set(row.person, []); grouped.get(row.person).push(row); }
  return [...grouped].map(([person, points]) => {
    points.sort((a,b) => Date.parse(a.captured_at)-Date.parse(b.captured_at));
    const latest = points.at(-1); const ageMinutes = (now - Date.parse(latest.captured_at)) / 60000;
    const gaps = points.slice(1).flatMap((point,i) => { const minutes = (Date.parse(point.captured_at)-Date.parse(points[i].captured_at))/60000; return minutes > gapMinutes ? [{from: points[i].captured_at, to: point.captured_at, minutes}] : []; });
    return { person, points, latest, ageMinutes, status: ageMinutes < -5 ? 'future' : ageMinutes > staleMinutes ? 'stale' : 'recent', gaps };
  }).sort((a,b) => a.person.localeCompare(b.person));
}
export function exportHistory(records, demo = false) { return JSON.stringify({ demo, format: 'findhub-history', version: 1, records }, null, 2); }
export function demoHistory(now = Date.now()) {
  const make = (person, minutes, latitude, longitude, address, battery) => ({ person, captured_at: new Date(now-minutes*60000).toISOString(), latitude, longitude, address, battery, displayed_age: '2 minutes ago' });
  return normalizeHistory([
    make('Demo · River phone', 100, 37.7749, -122.4194, 'Synthetic stop A', '84%'),
    make('Demo · River phone', 95, 37.779, -122.414, 'Synthetic stop B', '83%'),
    make('Demo · River phone', 10, 37.785, -122.405, 'Synthetic stop C', '72%'),
    make('Demo · River phone', 5, 37.79, -122.40, 'Synthetic stop D', '71%'),
    make('Demo · Cedar tablet', 240, 37.760, -122.43, 'Synthetic home', '51%'),
    make('Demo · Cedar tablet', 235, 37.762, -122.425, 'Synthetic stop', '50%')
  ]);
}
