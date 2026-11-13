// 데이터 읽기. 노선 파일은 data/lines/*.json을 자동으로 모은다 (파일 추가 = 노선 추가).
import stationsJson from '../data/stations.json';
import servicesJson from '../data/services.json';
import modesJson from '../data/modes.json';
import type { FieldSpec, ModeSpec, Station } from './engine/types';

export interface ElementData {
  id: number; symbol: string; name_ko: string; aliases_ko: string[]; name_en: string;
  period: number; group: number | null; block: string; category: string; grid: { row: number; col: number };
}
export interface Line {
  id: string; service_id: string; name: string; subtitle: string; color: string; description: string;
  station_ids: number[]; group: 'zone' | 'period'; curriculum: string[]; level: number; status: 'open' | 'draft'; order: number;
}
export interface Service {
  id: string; name: string; subject: string; status: 'open' | 'coming_soon'; map_module: string;
  default_line: string; order: number; fields: Record<string, FieldSpec>; modes: string[];
}

export const elements = stationsJson as ElementData[];
export const services = (servicesJson as Service[]).slice().sort((a, b) => a.order - b.order);
export const modes = modesJson as ModeSpec[];

const lineFiles = import.meta.glob('../data/lines/*.json', { eager: true, import: 'default' }) as Record<string, Line>;
export const allLines = Object.values(lineFiles).sort((a, b) => a.order - b.order);

export const elementById = new Map(elements.map((e) => [e.id, e]));

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
export const lineStations = (l: Line) => l.station_ids.map((id) => toStation(elementById.get(id)!));
