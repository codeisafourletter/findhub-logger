import test from 'node:test';
import assert from 'node:assert/strict';
import { readHistory, normalizeHistory, groups, exportHistory, demoHistory } from '../app/history.mjs';
import { historyServer } from './serve-history.mjs';
const point = { captured_at:'2026-11-04T12:00:00Z', person:'Example phone', latitude:37, longitude:-122, address:'Example, "Home"', battery:'80%', displayed_age:'2 minutes ago' };
test('Sheet CSV handles commas, quotes, CRLF, numeric coordinates and multiline cells', () => {
  const rows=readHistory('captured_at,person,latitude,longitude,address\r\n2026-11-04T12:00:00Z,Phone,37,-122,"Example, ""Home""\nSecond line"\r\n','history.csv');
  assert.equal(rows[0].address,'Example, "Home"\nSecond line'); assert.equal(rows[0].latitude,37);
});
test('JSON roundtrip retains collector fields, deduplicates and sorts', () => {
  const records=normalizeHistory([point,{...point,captured_at:'2026-11-04T11:00:00Z'},point]);
  assert.equal(records.length,2); assert.match(records[0].captured_at,/11:00/);
  assert.deepEqual(readHistory(exportHistory(records)),records);
  assert.equal(JSON.parse(exportHistory(records,true)).demo,true);
});
test('bad imports reject atomically with row numbers and without private field values', () => {
  for(const bad of [{...point,latitude:91},{...point,longitude:''},{...point,latitude:true},{...point,longitude:'   '},{...point,captured_at:'2026-11-04 12:00'}, {...point,person:''},null]) assert.throws(()=>normalizeHistory([point,bad]),/Record 2:/);
  assert.throws(()=>readHistory('person,latitude\nX,1','x.csv'),/headers/);
  assert.throws(()=>readHistory('captured_at,person,latitude,longitude\na,b,1,2,3','x.csv'),/row 2/);
});
test('freshness is based on captured time, future times are flagged and gaps keep exact boundaries', () => {
  const now=Date.parse('2026-11-04T14:00:00Z');
  const history=normalizeHistory([point,{...point,captured_at:'2026-11-04T12:45:00Z'}, {...point,person:'Future',captured_at:'2026-11-04T15:00:00Z'}]);
  const result=groups(history,now,60,30);
  assert.equal(result[0].status,'stale'); assert.equal(result[0].gaps.length,1); assert.equal(result[0].gaps[0].minutes,45); assert.equal(result[1].status,'future');
  assert.equal(groups(history,now,120,60)[0].status,'recent'); assert.equal(groups(history,now,120,60)[0].gaps.length,0);
});
test('demo is synthetic and illustrates recent, stale and a gap', () => {
  const now=Date.now(); const history=demoHistory(now); const result=groups(history,now);
  assert.equal(history.length,6); assert.ok(history.every(p=>p.person.startsWith('Demo ·')));
  assert.equal(result.filter(e=>e.status==='stale').length,1); assert.equal(result.reduce((n,e)=>n+e.gaps.length,0),1);
});
test('local server serves app only and prevents access to cloud secrets paths', async () => {
  const server=historyServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/cloud/auth-state.json')).status,404);
    assert.equal((await fetch(base+'/%2e%2e%2fcloud/package.json')).status,404);
    assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
