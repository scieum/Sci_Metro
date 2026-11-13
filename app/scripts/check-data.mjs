// 빌드 때 데이터 검사 (PRD 6-7-3): 없는 역 참조, 중복 역, 빈 정답, 별칭 충돌.
// gate.mjs(G4 ③)도 이 함수를 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

export function checkData(dir) {
  const errors = [];
  const stations = read(path.join(dir, 'stations.json'));
  const services = read(path.join(dir, 'services.json'));
  const modes = read(path.join(dir, 'modes.json'));
  const lineDir = path.join(dir, 'lines');
  const lines = fs.readdirSync(lineDir).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, ...read(path.join(lineDir, f)) }));

  const ids = new Set();
  const nameOwner = new Map(); // 정규화한 이름·별칭 → 역 id
  const norm = (s) => String(s ?? '').replace(/\s+/g, '');
  for (const s of stations) {
    if (ids.has(s.id)) errors.push(`stations.json: 중복 역 id ${s.id}`);
    ids.add(s.id);
    if (!norm(s.symbol)) errors.push(`stations.json: ${s.id}번 기호가 비었음`);
    if (!norm(s.name_ko)) errors.push(`stations.json: ${s.id}번 이름이 비었음`);
    for (const n of [s.name_ko, ...(s.aliases_ko ?? [])]) {
      const k = norm(n);
      if (!k) { errors.push(`stations.json: ${s.id}번 빈 별칭`); continue; }
      const owner = nameOwner.get(k);
      if (owner !== undefined && owner !== s.id) errors.push(`별칭 충돌: '${n}'가 ${owner}번과 ${s.id}번에 모두 있음`);
      else if (owner === s.id && n !== s.name_ko) errors.push(`stations.json: ${s.id}번 별칭 '${n}'이 중복`);
      nameOwner.set(k, s.id);
    }
  }

  const lineIds = new Set();
  for (const l of lines) {
    if (`${l.id}.json` !== l.file) errors.push(`lines/${l.file}: 파일 이름과 id(${l.id})가 다름`);
    if (lineIds.has(l.id)) errors.push(`lines/${l.file}: 중복 노선 id ${l.id}`);
    lineIds.add(l.id);
    for (const k of ['id', 'service_id', 'name', 'color', 'station_ids', 'status']) if (l[k] === undefined) errors.push(`lines/${l.file}: '${k}' 없음`);
    if (!services.some((s) => s.id === l.service_id)) errors.push(`lines/${l.file}: 없는 서비스 ${l.service_id}`);
    const seen = new Set();
    for (const id of l.station_ids ?? []) {
      if (!ids.has(id)) errors.push(`lines/${l.file}: 없는 역 ${id} 참조`);
      if (seen.has(id)) errors.push(`lines/${l.file}: 중복 역 ${id}`);
      seen.add(id);
    }
    if (!(l.station_ids ?? []).length) errors.push(`lines/${l.file}: 역이 없음`);
  }

  for (const svc of services) {
    if (svc.status === 'open' && !lineIds.has(svc.default_line)) errors.push(`services.json: ${svc.id}의 default_line '${svc.default_line}' 없음`);
    for (const m of svc.modes ?? []) if (!modes.some((x) => x.id === m)) errors.push(`services.json: 없는 모드 ${m}`);
  }
  for (const m of modes) {
    for (const p of m.prompts) {
      const ans = m.answers?.[p];
      if (!ans?.length) errors.push(`modes.json: ${m.id}의 '${p}' 문제에 정답 종류가 없음`);
      if (ans?.includes(p)) errors.push(`modes.json: ${m.id}에서 '${p}'를 보고 '${p}'를 답하게 됨`);
    }
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
  const errors = checkData(dir);
  if (errors.length) {
    console.error(`데이터 검사 실패 ${errors.length}건\n- ` + errors.join('\n- '));
    process.exit(1);
  }
  console.log('데이터 검사 통과');
}
