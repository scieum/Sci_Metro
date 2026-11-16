// 데이터 읽기. 노선 파일은 data/lines/*.json을 자동으로 모은다 (파일 추가 = 노선 추가).
import stationsJson from '../data/stations.json';
import organsJson from '../data/organs.json';
import moleculesJson from '../data/molecules.json';
import scenesJson from '../data/scenes.json';
import servicesJson from '../data/services.json';
import modesJson from '../data/modes.json';
import type { FieldSpec, ModeSpec, Station } from './engine/types';

export type StopId = number | string;
export interface ElementData {
  id: number; symbol: string; name_ko: string; aliases_ko: string[]; name_en: string;
  period: number; group: number | null; block: string; category: string; grid: { row: number; col: number };
}
export interface OrganData { id: string; name: string; aliases: string[]; desc: string }
export interface MoleculeData { id: string; name: string; aliases: string[]; smiles: string }
export interface Scene { src: string; w: number; h: number }
/** 지도 경로: [x, y] = 꺾이는 점, [x, y, 역 id] = 역 (장면 이미지 픽셀 좌표) */
export type RoutePoint = [number, number] | [number, number, string];
export interface Line {
  id: string; service_id: string; name: string; subtitle: string; color: string; description: string;
  station_ids: StopId[]; group: string; curriculum: string[]; level: number; status: 'open' | 'draft'; order: number;
  scene?: string; route?: RoutePoint[];
  /** 승차권 썸네일에 보여 줄 대표 역 (IUPAC_Metro 분자 3개) */
  featured?: StopId[];
}
export interface Service {
  id: string; name: string; subject: string; status: 'open' | 'coming_soon'; map_module: string;
  default_line: string; order: number; blurb: string; groups: Array<{ id: string; label: string }>;
  study?: { path: string; label: string }; fields: Record<string, FieldSpec>; modes: string[];
}
/** 화면이 그리는 역 한 칸: n = 위 작은 숫자, s = 큰 글자(없으면 빈칸), k = 이름, img = 분자 모형 그림 */
export interface StopView { id: StopId; n: string; s: string; k: string; tint: string; desc?: string; img?: string }

export const elements = stationsJson as ElementData[];
export const organs = organsJson as OrganData[];
export const molecules = moleculesJson as MoleculeData[];
export const scenes = scenesJson as Record<string, Scene>;
export const services = (servicesJson as unknown as Service[]) // 모양 검사는 scripts/check-data.mjs
  .slice().sort((a, b) => a.order - b.order);
export const modes = modesJson as unknown as ModeSpec[];

const lineFiles = import.meta.glob('../data/lines/*.json', { eager: true, import: 'default' }) as Record<string, Line>;
export const allLines = Object.values(lineFiles).sort((a, b) => a.order - b.order);

export const elementById = new Map(elements.map((e) => [e.id, e]));
export const organById = new Map(organs.map((o) => [o.id, o]));
export const moleculeById = new Map(molecules.map((m) => [m.id, m]));
export const moleculeImg = (id: StopId) => `/molecule/${id}.svg`;
export const serviceById = (id: string) => services.find((s) => s.id === id);

/** draft 노선은 ?preview=1 일 때만 (운영자 미리보기, PRD 6-7-4) */
export function visibleLines(serviceId: string, preview = false) {
  return allLines.filter((l) => l.service_id === serviceId && (l.status === 'open' || preview));
}
export const lineById = (id: string) => allLines.find((l) => l.id === id);
export const modeById = (id: string) => modes.find((m) => m.id === id);

/** Element_Metro 역 → 엔진이 아는 일반 역 */
export function toStation(e: ElementData): Station {
  return {
    id: e.id,
    fields: { number: String(e.id), symbol: e.symbol, name: e.name_ko },
    aliases: { name: e.aliases_ko },
  };
}
/** Organism_Metro 역 → 일반 역. 순서는 노선 안 위치라서 노선이 필요하다 */
function organStation(o: OrganData, order: number): Station {
  return { id: o.id, fields: { order: String(order), desc: o.desc, name: o.name }, aliases: { name: o.aliases } };
}

/** IUPAC_Metro 역 → 일반 역. 모형 칸은 그림이라 값은 분자 id (입력하지 않는 칸) */
function moleculeStation(m: MoleculeData, order: number): Station {
  return { id: m.id, fields: { order: String(order), model: m.id, name: m.name }, aliases: { name: m.aliases } };
}

export function stationOf(l: Line, id: StopId): Station {
  if (l.service_id === 'element') return toStation(elementById.get(Number(id))!);
  if (l.service_id === 'iupac') return moleculeStation(moleculeById.get(String(id))!, l.station_ids.indexOf(id) + 1);
  return organStation(organById.get(String(id))!, l.station_ids.indexOf(id) + 1);
}
export const lineStations = (l: Line, ids: StopId[] = l.station_ids) => ids.map((id) => stationOf(l, id));

export function stopView(l: Line, id: StopId): StopView {
  if (l.service_id === 'element') {
    const e = elementById.get(Number(id))!;
    return { id: e.id, n: String(e.id), s: e.symbol, k: e.name_ko, tint: `var(--cat-${e.category})` };
  }
  const n = String(l.station_ids.indexOf(id) + 1);
  if (l.service_id === 'iupac') {
    const m = moleculeById.get(String(id))!;
    return { id: m.id, n, s: '', k: m.name, tint: `var(--${l.color})`, img: moleculeImg(m.id) };
  }
  const o = organById.get(String(id))!;
  return { id: o.id, n, s: '', k: o.name, tint: `var(--${l.color})`, desc: o.desc };
}

/** 노선 없이 역만 알 때 (내 기록의 자주 틀린 역). 원소 id는 숫자, 기관·분자 id는 영문 (서로 겹치지 않게 check-data가 검사) */
export function findStop(id: StopId): StopView | undefined {
  const e = /^\d+$/.test(String(id)) ? elementById.get(Number(id)) : undefined;
  if (e) return { id: e.id, n: String(e.id), s: e.symbol, k: e.name_ko, tint: `var(--cat-${e.category})` };
  const o = organById.get(String(id));
  if (o) return { id: o.id, n: '', s: '', k: o.name, tint: 'var(--text-sub)', desc: o.desc };
  const m = moleculeById.get(String(id));
  return m && { id: m.id, n: '', s: '', k: m.name, tint: 'var(--text-sub)', img: moleculeImg(m.id) };
}
