// 기록은 이 브라우저에만 (PRD 6-6). 저장이 막혀도(시크릿 창) 게임은 계속된다 → 메모리로 대신한다.
import { isBetter } from './engine/run';

export interface Best { duration_ms: number; accuracy: number; first_try_correct: number; total_stations: number; played_at: string }

const mem = new Map<string, string>();
function get(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return mem.get(key) ?? null; }
}
function set(key: string, value: string) {
  mem.set(key, value);
  try { localStorage.setItem(key, value); } catch { /* 저장 막힘: 메모리만 */ }
}
function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(get(key) ?? '') as T; } catch { return fallback; }
}

const BEST = 'sm.best.v1';
const MISSES = 'sm.misses.v1';

export const allBest = () => readJson<Record<string, Best>>(BEST, {});
export const bestOf = (lineId: string, modeId: string): Best | null => allBest()[`${lineId}:${modeId}`] ?? null;
export function bestOfLine(lineId: string): Best | null {
  return Object.entries(allBest()).filter(([k]) => k.startsWith(lineId + ':')).map(([, v]) => v)
    .reduce<Best | null>((a, b) => (isBetter(b, a) ? b : a), null);
}

/** 기록 저장. 신기록이면 이전 기록을 돌려준다(없으면 null). 신기록이 아니면 undefined. */
export function saveRun(lineId: string, modeId: string, r: Omit<Best, 'played_at'>): { isBest: boolean; prev: Best | null } {
  const all = allBest();
  const key = `${lineId}:${modeId}`;
  const prev = all[key] ?? null;
  const isBest = isBetter(r, prev);
  if (isBest) { all[key] = { ...r, played_at: new Date().toISOString() }; set(BEST, JSON.stringify(all)); }
  return { isBest, prev };
}

export const missCounts = () => readJson<Record<string, number>>(MISSES, {});
export function addMisses(ids: Array<number | string>) {
  if (!ids.length) return;
  const m = missCounts();
  for (const id of ids) m[id] = (m[id] ?? 0) + 1;
  set(MISSES, JSON.stringify(m));
}
