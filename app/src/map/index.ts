// 노선 지도: 노선에 장면(scene)이 있으면 몸 지도, 없으면 주기율표 지도.
import { elementById, type Line, type StopId } from '../data';
import { organMap } from './organ';
import { mapSvg } from './periodic';

export interface LineMapOptions {
  ids?: StopId[]; // 기본 = 노선 전체
  index?: number;
  currentId?: StopId;
  passed?: Set<StopId>;
  missed?: Set<StopId>;
  compact?: boolean;
  label?: string;
}

export function lineMap(line: Line, o: LineMapOptions = {}): string {
  const ids = o.ids ?? line.station_ids;
  const color = `var(--${line.color})`;
  if (line.scene && line.route) return organMap(line, { ...o, ids, color });
  return mapSvg({
    stops: ids.map((id) => elementById.get(Number(id))!), color, index: o.index, compact: o.compact, label: o.label,
    currentId: o.currentId as number | undefined, passed: o.passed as Set<number> | undefined, missed: o.missed as Set<number> | undefined,
  });
}
