// Element_Metro 지도 모듈: 주기율표 = 노선도 (PRD 6-4, design.md 2-4).
import { elements, type ElementData } from '../data';

const C = 40, G = 4, FG = 12;
export const MAP_W = 18 * C + 17 * G;
export const MAP_H = 9 * C + 8 * G + FG;
const cx = (col: number) => (col - 1) * (C + G) + C / 2;
const cy = (row: number) => (row - 1) * (C + G) + (row >= 8 ? FG : 0) + C / 2;
const gapBelow = (row: number) => (cy(row) + C / 2 + cy(row + 1) - C / 2) / 2;

type P = [number, number];
const at = (e: ElementData): P => [cx(e.grid.col), cy(e.grid.row)];

/** 역 사이를 직각으로 잇는다. 줄이 바뀌면 출발 줄 아래(위) 틈을 따라 간다. */
export function route(stops: ElementData[]): P[] {
  const pts: P[] = [];
  stops.forEach((e, i) => {
    const b = at(e);
    if (i > 0) {
      const a = at(stops[i - 1]);
      if (a[0] !== b[0] && a[1] !== b[1]) {
        const row = stops[i - 1].grid.row;
        const gy = b[1] > a[1] ? gapBelow(row) : gapBelow(row - 1);
        pts.push([a[0], gy], [b[0], gy]);
      }
    }
    pts.push(b);
  });
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
}

/** 꺾이는 곳을 둥글게 */
export function roundedPath(pts: P[], r = 8): string {
  if (!pts.length) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y);
    if (!l1 || !l2 || (x - px) * (ny - y) - (y - py) * (nx - x) === 0) { d += ` L${x} ${y}`; continue; }
    const k = Math.min(r, l1 / 2, l2 / 2);
    d += ` L${x - ((x - px) / l1) * k} ${y - ((y - py) / l1) * k} Q${x} ${y} ${x + ((nx - x) / l2) * k} ${y + ((ny - y) / l2) * k}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface MapOptions {
  stops: ElementData[];
  color: string; // CSS 색 (예: var(--line-basic))
  index?: number; // 이번 역 (노선 순서대로 달릴 때)
  currentId?: number; // 이번 역 (순서가 섞인 모드: 번호 쓰기)
  passed?: Set<number>; // 지난 역 (순서가 섞인 모드)
  missed?: Set<number>;
  compact?: boolean; // 노선 승차권 썸네일
  label?: string;
}

export function mapSvg(o: MapOptions): string {
  const onLine = new Set(o.stops.map((s) => s.id));
  const seq = o.index !== undefined;
  const idx = o.index ?? -1;
  const curId = seq ? o.stops[idx]?.id : o.currentId;
  const passed = seq ? new Set(o.stops.slice(0, idx).map((s) => s.id)) : o.passed;
  const overview = curId === undefined && !passed; // 노선 전체를 보여 주기만
  const pts = route(o.stops);
  const cells = elements.map((e) => {
    const x = cx(e.grid.col) - C / 2, y = cy(e.grid.row) - C / 2;
    const fill = o.compact ? 'var(--border)' : `color-mix(in srgb, var(--cat-${e.category}) 28%, var(--bg))`;
    const dim = onLine.has(e.id) ? 1 : o.compact ? 0.7 : 0.45;
    const label = o.compact || onLine.has(e.id) ? '' : `<text x="${x + C / 2}" y="${y + C / 2 + 4}" class="cell-t">${e.symbol}</text>`;
    // fill-opacity: 칸마다 <g opacity>를 쓰면 합성 레이어가 1000개 넘게 생겨 화면이 멈춘다
    return `<rect x="${x}" y="${y}" width="${C}" height="${C}" style="fill:${fill}" fill-opacity="${dim}"/>${label}`;
  }).join('');
  const passedPts = seq && idx > 0 ? route(o.stops.slice(0, idx + 1)) : [];
  const sw = o.compact ? 6 : 5;
  const lines = `<path d="${roundedPath(pts)}" style="stroke:${o.color}" stroke-width="${sw}" fill="none" stroke-linecap="round" opacity="${overview ? 1 : 0.35}"/>`
    + (passedPts.length ? `<path d="${roundedPath(passedPts)}" style="stroke:${o.color}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>` : '');
  const nodes = o.stops.map((e) => {
    const [x, y] = at(e);
    if (o.compact) return `<circle cx="${x}" cy="${y}" r="9" style="fill:var(--bg);stroke:${o.color}" stroke-width="4"/>`;
    const missed = o.missed?.has(e.id);
    if (e.id === curId) {
      // 궤도는 멈춰 둔다: 큰 SVG 안에서 계속 돌리면 매 프레임 지도 전체를 다시 그려 화면이 멈춘다
      return `<g class="atom"><ellipse cx="${x}" cy="${y}" rx="19" ry="7" class="orbit" transform="rotate(30 ${x} ${y})"/><ellipse cx="${x}" cy="${y}" rx="19" ry="7" class="orbit" transform="rotate(-30 ${x} ${y})"/>`
        + `<circle cx="${x}" cy="${y}" r="13" style="fill:var(--primary)"/><text x="${x}" y="${y + 4}" class="node-t" style="fill:var(--on-primary)">${e.id}</text></g>`;
    }
    if (overview || passed?.has(e.id)) {
      if (missed) return `<circle cx="${x}" cy="${y}" r="13" style="fill:var(--bg);stroke:var(--danger)" stroke-width="2"/><text x="${x}" y="${y + 4}" class="node-t" style="fill:var(--danger)">${e.symbol}</text>`;
      return `<circle cx="${x}" cy="${y}" r="13" style="fill:${o.color}"/><text x="${x}" y="${y + 4}" class="node-t" style="fill:var(--bg)">${e.symbol}</text>`;
    }
    return `<circle cx="${x}" cy="${y}" r="13" style="fill:var(--bg);stroke:${o.color}" stroke-width="2"/><text x="${x}" y="${y + 4}" class="node-t num" style="fill:var(--text-sub)">${e.id}</text>`;
  }).join('');
  return `<svg viewBox="-4 -4 ${MAP_W + 8} ${MAP_H + 8}" role="img" aria-label="${esc(o.label ?? '주기율표 노선도')}" class="pmap${o.compact ? ' compact' : ''}">${cells}${lines}${nodes}</svg>`;
}
