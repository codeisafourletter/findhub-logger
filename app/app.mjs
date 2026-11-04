import { readHistory, groups, demoHistory, exportHistory } from './history.mjs';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const duration = minutes => minutes < 60 ? `${Math.round(minutes)} min` : minutes < 1440 ? `${(minutes / 60).toFixed(1)} hours` : `${(minutes / 1440).toFixed(1)} days`;
let records = [], selected = '', demo = false;
function notify(message) { $('notice').textContent = message; }
function load(next, isDemo, source) {
  records = next; selected = ''; demo = isDemo;
  notify(`${isDemo ? 'DEMO · Synthetic data, not your devices. ' : 'PRIVATE IMPORT · '}${source} ${records.length} unique records loaded. Only this tab holds them; reload or Clear session removes them.`);
  render();
}
$('demo').onclick = () => load(demoHistory(), true, 'Six illustrative observations with recent, stale and gap examples.');
$('import').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 20 * 1024 * 1024) throw new Error('Choose a file smaller than 20 MB.'); const text = await file.text(); const isDemo = !file.name.toLowerCase().endsWith('.csv') && JSON.parse(text)?.demo === true; load(readHistory(text, file.name), isDemo, 'Import complete.'); }
  catch(error) { notify(`Import not applied. ${error instanceof SyntaxError ? 'Invalid JSON. Choose a JSON array or CSV file.' : error.message} Your previous session is unchanged.`); }
  finally { event.target.value = ''; }
};
$('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([exportHistory(records, demo)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = demo ? 'findhub-demo-history.json' : 'findhub-private-history.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify(`Exported ${records.length} records as ${demo ? 'synthetic demo' : 'private history'} JSON. The download contains locations; keep it private. Your tab session is still available.`);
};
$('clear').onclick = () => { records = []; selected = ''; demo = false; $('search').value = ''; $('filter').value = 'all'; notify('Session cleared. Previously downloaded files remain on your device.'); render(); };
for (const id of ['search', 'filter', 'stale', 'gap']) $(id).addEventListener('input', render);
function threshold(id, fallback) { const value = Number($(id).value); return Number.isFinite(value) && value >= 1 && value <= 10080 ? value : fallback; }
function route(points) {
  // Local coordinate plot: no remote map tiles, geocoding, or location requests.
  const sample = points.filter((_, i) => i % Math.max(1, Math.ceil(points.length / 1000)) === 0);
  if (sample.at(-1) !== points.at(-1)) sample.push(points.at(-1));
  const lats = sample.map(p => p.latitude), lons = sample.map(p => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const x = p => 70 + (p.longitude-minLon)/(maxLon-minLon || 1)*580;
  const y = p => 230 - (p.latitude-minLat)/(maxLat-minLat || 1)*180;
  return `<svg class="route" viewBox="0 0 720 290" role="img" aria-label="Geographic history plot, longitude east across and latitude north up"><path d="M70 35V245H670" fill="none" stroke="#afc5b3"/><path d="M70 100H670M70 170H670M260 35V245M455 35V245M650 35V245" fill="none" stroke="#d5dfd1" stroke-dasharray="4 5"/><text x="15" y="30">N / latitude</text><text x="70" y="265">${minLon.toFixed(4)}°</text><text x="590" y="265">${maxLon.toFixed(4)}° E</text><text x="5" y="55">${maxLat.toFixed(3)}°</text><text x="5" y="230">${minLat.toFixed(3)}°</text><polyline points="${sample.map(p => `${x(p)},${y(p)}`).join(' ')}" fill="none" stroke="#2d6a4a" stroke-width="3"/>${sample.map((p, i) => `<circle cx="${x(p)}" cy="${y(p)}" r="${i===sample.length-1 ? 7 : 3}" fill="${i===sample.length-1 ? '#c58624' : '#2d6a4a'}"><title>${escape(date(p.captured_at))}</title></circle>`).join('')}</svg>`;
}
function render() {
  const hasData = records.length > 0;
  $('workspace').hidden = !hasData; $('empty').hidden = hasData; $('clear').disabled = !hasData; $('export').disabled = !hasData;
  if (!hasData) { $('entities').replaceChildren(); $('detail').replaceChildren(); $('metrics').replaceChildren(); return; }
  const staleMinutes = threshold('stale', 60), gapMinutes = threshold('gap', 30);
  const entities = groups(records, Date.now(), staleMinutes, gapMinutes);
  const metrics = [[entities.length, 'Tracked entities'],[records.length, 'Observations'],[entities.filter(e => e.status==='stale').length, `Stale · over ${staleMinutes} min`],[entities.reduce((n,e)=>n+e.gaps.length,0), `Gaps · over ${gapMinutes} min`]];
  $('metrics').innerHTML = metrics.map(([value,label])=>`<div class="metric"><b>${value}</b><span>${escape(label)}</span></div>`).join('');
  const query = $('search').value.trim().toLowerCase();
  const visible = entities.filter(entity => ($('filter').value==='all' || entity.status===$('filter').value) && (entity.person.toLowerCase().includes(query) || entity.points.some(p=>p.address.toLowerCase().includes(query))));
  if (!visible.some(entity=>entity.person===selected)) selected = visible[0]?.person || '';
  $('entities').innerHTML = visible.length ? visible.map((entity,index)=>`<button class="entity ${selected===entity.person?'selected':''}" data-index="${index}" aria-pressed="${selected===entity.person}"><strong>${escape(entity.person)}</strong><small>${entity.points.length} observations · ${entity.gaps.length} gaps</small><span class="badge ${entity.status}">${entity.status==='future'?'Check clock':entity.status==='stale'?'Stale':'Recent collection'}</span></button>`).join('') : '<p>No entities match. Clear search or change the freshness filter.</p>';
  for (const button of $('entities').querySelectorAll('button')) button.onclick = () => { selected = visible[Number(button.dataset.index)].person; render(); };
  const entity = visible.find(e=>e.person===selected);
  if (!entity) { $('detail').innerHTML = '<section class="panel"><h2>No matching history</h2><p>All imported records are still available in Export all JSON.</p></section>'; return; }
  const alert = entity.status === 'stale' ? `<strong>No collection in ${duration(entity.ageMinutes)}.</strong> This import may be old. First export fresh Sheet data and import it here. If the Sheet is also stale, check the collector’s Actions run, refresh expired Google sign-in, and re-enable its schedule if needed. This app cannot determine the cause.` : entity.status === 'future' ? '<strong>The newest timestamp is in the future.</strong> Check the source clock and timezone before relying on freshness.' : 'The most recent imported collection is within your threshold. This is an offline view; it does not verify Google sign-in, the current device position or the collector schedule.';
  const timeline = [...entity.points].reverse().slice(0,500);
  $('detail').innerHTML = `<section class="panel"><div class="heading"><div><p class="eyebrow">${demo?'SYNTHETIC DEMO':'IMPORTED HISTORY'}</p><h2>${escape(entity.person)}</h2></div><span class="badge ${entity.status}">${entity.status==='future'?'Future timestamp':entity.status}</span></div><div class="alert">${alert}</div><div class="fact"><strong>Last collected:</strong> ${escape(date(entity.latest.captured_at))}<br><strong>Source displayed age:</strong> ${escape(entity.latest.displayed_age || 'Not recorded')} · <strong>Battery:</strong> ${escape(entity.latest.battery || 'Not recorded')}<br><strong>Source address:</strong> ${escape(entity.latest.address || 'Not recorded')}<br><span class="muted">Exact collection timestamp: ${escape(entity.latest.captured_at)}. Source location-fix time is unavailable.</span></div><h3>Geographic path</h3>${route(entity.points)}<p class="hint">Local latitude/longitude plot · gold is latest collection · north up. Lines connect observations, not a verified route. Axes scale independently; this is not a navigation map. ${entity.points.length>1000?'Plot is sampled; export retains all records.':''}</p></section><section class="panel"><h2>Collection gaps</h2>${entity.gaps.length ? `<p class="hint">${entity.gaps.length} intervals exceed ${gapMinutes} minutes. These indicate missing observations, not proof that a device stopped moving or went offline.</p><ul class="gap-list">${entity.gaps.slice(-20).reverse().map(gap=>`<li><strong>${duration(gap.minutes)}</strong> · ${escape(date(gap.from))} → ${escape(date(gap.to))}</li>`).join('')}</ul>${entity.gaps.length>20?'<p class="hint">Showing the newest 20 gaps.</p>':''}` : '<p>No intervals exceed the selected threshold. This does not prove continuous collection.</p>'}</section><section class="panel"><h2>Observation timeline</h2><p class="hint">Newest first · ${timeline.length} of ${entity.points.length} observations. Times shown in your browser timezone. Export includes every entity and observation.</p><div class="table-wrap"><table><thead><tr><th>Collected</th><th>Location / coordinates</th><th>Source age</th><th>Battery</th></tr></thead><tbody>${timeline.map(point=>`<tr><td>${escape(date(point.captured_at))}</td><td>${escape(point.address || 'No address')}<br><span class="muted">${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}</span></td><td>${escape(point.displayed_age || '—')}</td><td>${escape(point.battery || '—')}</td></tr>`).join('')}</tbody></table></div></section>`;
}
setInterval(() => { if (records.length) render(); }, 60000);
