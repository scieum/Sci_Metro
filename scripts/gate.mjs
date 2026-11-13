#!/usr/bin/env node
// 게이트 판정 (docs/gates.md). 수치·목록은 rules.json에서만 읽는다.
// 사용: node scripts/gate.mjs S4 [--service element]
// 출력: 조건별 통과/실패. 실패하면 work/<id>/<단계>/gate-fail.json, 결과는 work/<id>/state.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules.json'), 'utf8'));
const stage = process.argv[2];
const svcIdx = process.argv.indexOf('--service');
const service = svcIdx > 0 ? process.argv[svcIdx + 1] : 'element';
const APP = path.join(ROOT, 'app');

const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]) : [];
const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');
const run = (cmd) => {
  const r = spawnSync(cmd, { cwd: APP, shell: true, encoding: 'utf8' });
  return { ok: r.status === 0, tail: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-8).join('\n') };
};

async function g4() {
  const out = [];
  const add = (id, name, violations) => out.push({ id, name, pass: violations.length === 0, violations });

  const b = run('npm run build --silent');
  add('①', '빌드 exit 0', b.ok ? [] : [b.tail]);
  const t = run('npx vitest run');
  add('②', '판정 함수 단위 테스트 exit 0', t.ok ? [] : [t.tail]);

  const { checkData } = await import(pathToFileURL(path.join(APP, 'scripts', 'check-data.mjs')).href);
  add('③', '데이터 검사 0건', checkData(path.join(APP, 'data')));

  const engineDir = path.join(ROOT, rules.engine.dir);
  const words = [];
  for (const f of walk(engineDir)) {
    const text = fs.readFileSync(f, 'utf8').toLowerCase();
    for (const w of rules.engine.forbidden_words) if (text.includes(w.toLowerCase())) words.push(`${rel(f)}: '${w}'`);
  }
  if (!fs.existsSync(engineDir)) words.push(`${rules.engine.dir} 없음`);
  add('④', 'engine 금지어 0건', words);

  // ⑤ N2 표기
  const n2 = [];
  const stations = JSON.parse(fs.readFileSync(path.join(APP, 'data', 'stations.json'), 'utf8'));
  if (stations.length !== rules.naming.station_count) n2.push(`역 수 ${stations.length} ≠ ${rules.naming.station_count}`);
  for (const s of stations) if (!String(s.name_ko ?? '').trim()) n2.push(`${s.id}번 name_ko 비었음`);
  for (const [id, want] of Object.entries(rules.naming.names)) {
    const s = stations.find((x) => String(x.id) === id);
    if (!s) { n2.push(`${id}번 없음`); continue; }
    if (s.name_ko !== want.official) n2.push(`${id}번 name_ko '${s.name_ko}' ≠ '${want.official}'`);
    for (const a of want.aliases) if (!(s.aliases_ko ?? []).includes(a)) n2.push(`${id}번 별칭 '${a}' 없음`);
  }
  add('⑤', '★N2 표기', n2);

  // ⑥ N1 개인정보
  const n1 = [];
  const src = walk(path.join(APP, 'src'));
  for (const f of src) {
    const text = fs.readFileSync(f, 'utf8');
    for (const w of rules.privacy.forbidden_in_src) if (text.toLowerCase().includes(w.toLowerCase())) n1.push(`${rel(f)}: 금지 '${w}'`);
    const calls = [...text.matchAll(/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource)\b|https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]);
    for (const c of calls) if (!rules.privacy.network_allowed.some((a) => text.includes(a))) n1.push(`${rel(f)}: 허용 목록 밖 네트워크 '${c}'`);
  }
  const allowed = new Set(['id', ...rules.privacy.server_fields_allowed]);
  for (const f of [...walk(path.join(ROOT, 'supabase', 'migrations')), ...walk(path.join(APP, 'supabase', 'migrations'))].filter((f) => f.endsWith('.sql'))) {
    const sql = fs.readFileSync(f, 'utf8');
    for (const m of sql.matchAll(/create\s+table[^(]*\(([\s\S]*?)\);/gi)) {
      for (const line of m[1].split(',\n')) {
        const col = line.trim().split(/\s+/)[0]?.replace(/"/g, '');
        if (col && !/^(constraint|primary|unique|check|foreign)$/i.test(col) && !allowed.has(col)) n1.push(`${rel(f)}: 허용 밖 열 '${col}'`);
      }
    }
  }
  add('⑥', '★N1 개인정보', n1);
  return out;
}

const STAGES = { S4: g4 };
if (!STAGES[stage]) {
  console.error(`'${stage}' 게이트는 아직 없어요. 지금 되는 것: ${Object.keys(STAGES).join(', ')}`);
  process.exit(2);
}

const results = await STAGES[stage]();
const pass = results.every((r) => r.pass);
for (const r of results) {
  console.log(`${r.pass ? '통과' : '실패'} G${stage[1]}${r.id} ${r.name}`);
  for (const v of r.violations.slice(0, 20)) console.log(`   - ${v}`);
}

const work = path.join(ROOT, 'work', service);
fs.mkdirSync(path.join(work, stage), { recursive: true });
const statePath = path.join(work, 'state.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { stage, attempts: 0, passed: [] };
const failPath = path.join(work, stage, 'gate-fail.json');
if (pass) {
  state.passed = [...new Set([...(state.passed ?? []), stage])];
  state.attempts = 0;
  if (fs.existsSync(failPath)) fs.rmSync(failPath);
} else {
  state.stage = stage;
  state.attempts = (state.attempts ?? 0) + 1;
  fs.writeFileSync(failPath, JSON.stringify(results.filter((r) => !r.pass), null, 2) + '\n');
}
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
console.log(pass ? `\nG${stage[1]} 통과` : `\nG${stage[1]} 실패 (시도 ${state.attempts}/${rules.retry_limit}) → ${rel(failPath)}`);
process.exit(pass ? 0 : 1);
