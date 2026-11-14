// 빌드 때 데이터 검사 (PRD 6-7-3): 없는 역 참조, 중복 역, 빈 정답, 별칭 충돌.
// 서비스마다 역 파일이 따로 있고, 노선은 자기 서비스의 역만 참조한다.
// gate.mjs(G4 ③)도 이 함수를 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const norm = (s) => String(s ?? '').replace(/\s+/g, '');

/** 서비스 → 역 파일과 역 하나를 (id, 이름, 별칭, 꼭 있어야 할 칸)으로 읽는 법 */
const STATIONS = {
  element: { file: 'stations.json', name: (s) => s.name_ko, aliases: (s) => s.aliases_ko, required: { symbol: '기호', name_ko: '이름' } },
  organism: { file: 'organs.json', name: (s) => s.name, aliases: (s) => s.aliases, required: { name: '이름', desc: '하는 일' } },
};

function checkStations(file, list, spec, errors) {
  const ids = new Set();
  const nameOwner = new Map(); // 정규화한 이름·별칭 → 역 id
  for (const s of list) {
    if (ids.has(s.id)) errors.push(`${file}: 중복 역 id ${s.id}`);
    ids.add(s.id);
    for (const [k, label] of Object.entries(spec.required)) if (!norm(s[k])) errors.push(`${file}: ${s.id}번 ${label}이 비었음`);
    const official = spec.name(s);
    for (const n of [official, ...(spec.aliases(s) ?? [])]) {
      const k = norm(n);
      if (!k) { errors.push(`${file}: ${s.id}번 빈 별칭`); continue; }
      const owner = nameOwner.get(k);
      if (owner !== undefined && owner !== s.id) errors.push(`별칭 충돌: '${n}'가 ${owner}번과 ${s.id}번에 모두 있음`);
      else if (owner === s.id && n !== official) errors.push(`${file}: ${s.id}번 별칭 '${n}'이 중복`);
      nameOwner.set(k, s.id);
    }
  }
  return ids;
}

export function checkData(dir) {
  const errors = [];
  const services = read(path.join(dir, 'services.json'));
  const modes = read(path.join(dir, 'modes.json'));
  const scenesPath = path.join(dir, 'scenes.json');
  const scenes = fs.existsSync(scenesPath) ? read(scenesPath) : {};
  const lineDir = path.join(dir, 'lines');
  const lines = fs.readdirSync(lineDir).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, ...read(path.join(lineDir, f)) }));

  const idsBySvc = new Map();
  for (const svc of services) {
    const spec = STATIONS[svc.id];
    if (!spec) { errors.push(`services.json: ${svc.id}의 역 파일을 check-data.mjs STATIONS에 등록하지 않음`); continue; }
    const p = path.join(dir, spec.file);
    if (!fs.existsSync(p)) { if (svc.status === 'open') errors.push(`${spec.file} 없음 (${svc.id})`); continue; }
    idsBySvc.set(svc.id, checkStations(spec.file, read(p), spec, errors));
  }

  const lineIds = new Set();
  for (const l of lines) {
    if (`${l.id}.json` !== l.file) errors.push(`lines/${l.file}: 파일 이름과 id(${l.id})가 다름`);
    if (lineIds.has(l.id)) errors.push(`lines/${l.file}: 중복 노선 id ${l.id}`);
    lineIds.add(l.id);
    for (const k of ['id', 'service_id', 'name', 'color', 'station_ids', 'status']) if (l[k] === undefined) errors.push(`lines/${l.file}: '${k}' 없음`);
    const ids = idsBySvc.get(l.service_id);
    if (!services.some((s) => s.id === l.service_id)) errors.push(`lines/${l.file}: 없는 서비스 ${l.service_id}`);
    const svc = services.find((s) => s.id === l.service_id);
    if (svc?.groups && !svc.groups.some((g) => g.id === l.group)) errors.push(`lines/${l.file}: 서비스에 없는 묶음 '${l.group}'`);
    const seen = new Set();
    for (const id of l.station_ids ?? []) {
      if (ids && !ids.has(id)) errors.push(`lines/${l.file}: 없는 역 ${id} 참조`);
      if (seen.has(id)) errors.push(`lines/${l.file}: 중복 역 ${id}`);
      seen.add(id);
    }
    if (!(l.station_ids ?? []).length) errors.push(`lines/${l.file}: 역이 없음`);
    // 몸 지도: 장면이 있어야 하고, 경로 위 역 순서 = station_ids
    if (l.scene !== undefined || l.route !== undefined) {
      const sc = scenes[l.scene];
      if (!sc) errors.push(`lines/${l.file}: 없는 장면 '${l.scene}'`);
      const onRoute = (l.route ?? []).filter((p) => p[2]).map((p) => p[2]);
      if (JSON.stringify(onRoute) !== JSON.stringify(l.station_ids)) errors.push(`lines/${l.file}: 경로의 역 순서가 station_ids와 다름`);
      for (const p of l.route ?? []) if (sc && (p[0] < 0 || p[1] < 0 || p[0] > sc.w || p[1] > sc.h)) errors.push(`lines/${l.file}: 경로 점 (${p[0]}, ${p[1]})이 장면 밖`);
    }
  }

  for (const svc of services) {
    if (svc.status === 'open' && !lineIds.has(svc.default_line)) errors.push(`services.json: ${svc.id}의 default_line '${svc.default_line}' 없음`);
    for (const m of svc.modes ?? []) {
      const mode = modes.find((x) => x.id === m);
      if (!mode) { errors.push(`services.json: 없는 모드 ${m}`); continue; }
      for (const f of [...mode.prompts, ...Object.values(mode.answers).flat()]) if (!svc.fields[f]) errors.push(`services.json: ${svc.id}의 모드 ${m}가 없는 칸 '${f}'을 씀`);
    }
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
