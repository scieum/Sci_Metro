// Organism_Metro 지도 모듈: 실제 몸·기관 그림(장면) 위로 노선이 지나간다 (work/organism/S2/keyscreens.md).
// 좌표는 장면 이미지 픽셀. 노선이 지나는 부분만 잘라서 보여 준다.
import { organById, scenes, type Line, type StopId } from '../data';

export interface OrganMapOptions {
  ids: StopId[]; // 이번 판에 달리는 역 (틀린 역만 다시 달리면 일부)
  color: string;
  index?: number; // 이번 역 = ids[index] (순서대로 달릴 때)
  currentId?: StopId; // 이번 역 (순서가 섞인 모드)
  passed?: Set<StopId>;
  missed?: Set<StopId>;
  compact?: boolean; // 승차권 썸네일
  label?: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** 경로가 지나는 부분을 화면 비율(w:h)에 맞춰 자른 영역 */
export function cropOf(route: Array<[number, number, ...unknown[]]>, w: number, h: number, pad: number) {
  const xs = route.map((p) => p[0]), ys = route.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const rh = Math.max(y1 - y0 + 2 * pad, ((x1 - x0 + 2 * pad) * h) / w), rw = (rh * w) / h;
  return { x: (x0 + x1) / 2 - rw / 2, y: (y0 + y1) / 2 - rh / 2, w: rw, h: rh, sc: w / rw };
}

export function organMap(line: Line, o: OrganMapOptions): string {
  const scene = scenes[line.scene!], route = line.route!;
  const W = o.compact ? 320 : 480, H = o.compact ? 160 : 340;
  const c = cropOf(route, W, H, o.compact ? 50 : 70);
  const px = (v: number) => v / c.sc; // 화면 px → 이미지 px
  const run = new Set(o.ids);
  const seq = o.index !== undefined;
  const curId = seq ? o.ids[o.index!] : o.currentId;
  const passed = seq ? new Set(o.ids.slice(0, o.index)) : o.passed;
  const overview = curId === undefined && !passed;
  const pts = (to = route.length - 1) => route.slice(0, to + 1).map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const lw = px(o.compact ? 4 : 6);
  // 순서대로 달릴 때만 지나온 구간을 진하게
  const curPt = seq && curId !== undefined ? route.findIndex((p) => p[2] === curId) : -1;
  let body = `<image href="${scene.src}" x="0" y="0" width="${scene.w}" height="${scene.h}"/>`
    + `<path d="${pts()}" stroke="#fff" stroke-width="${lw + px(4)}" stroke-opacity=".9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${pts()}" style="stroke:${o.color}" stroke-width="${lw}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${overview ? 1 : 0.35}"/>`
    + (curPt > 0 ? `<path d="${pts(curPt)}" style="stroke:${o.color}" stroke-width="${lw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : '');
  const horiz = c.w > c.h * 1.2 && scene.w > scene.h; // 눈·귀·뉴런: 이름표를 위아래로 번갈아
  const midX = c.x + c.w / 2;
  const fs = px(13);
  let k = 0;
  for (const p of route) {
    const id = p[2];
    if (!id) continue;
    const order = ++k;
    const [x, y] = p;
    if (o.compact) { body += `<circle cx="${x}" cy="${y}" r="${px(4.5)}" fill="#fff" style="stroke:${o.color}" stroke-width="${px(2.5)}"/>`; continue; }
    if (!run.has(id)) { body += `<circle cx="${x}" cy="${y}" r="${px(5)}" fill="#fff" style="stroke:var(--text-disabled)" stroke-width="${px(2)}"/>`; continue; }
    const missed = o.missed?.has(id);
    const num = (fill: string) => `<text x="${x}" y="${y + px(4.5)}" class="node-t" font-size="${px(12)}" style="fill:${fill}">${order}</text>`;
    // 그림이 늘 흰 바탕이라 이름 글자는 다크 모드에서도 어두운 색 고정
    let name = '', nameFill = '#191c24';
    if (id === curId) {
      body += `<circle cx="${x}" cy="${y}" r="${px(20)}" style="fill:var(--primary)" fill-opacity=".22"/><circle cx="${x}" cy="${y}" r="${px(13)}" style="fill:var(--primary)" stroke="#fff" stroke-width="${px(2)}"/>${num('var(--on-primary)')}`;
      name = '?'; nameFill = 'var(--primary)';
    } else if (overview || passed?.has(id)) {
      body += missed
        ? `<circle cx="${x}" cy="${y}" r="${px(9)}" fill="#fff" style="stroke:var(--danger)" stroke-width="${px(2.5)}"/>`
        : `<circle cx="${x}" cy="${y}" r="${px(9)}" style="fill:${o.color}" stroke="#fff" stroke-width="${px(2.5)}"/>`;
      name = organById.get(id)?.name ?? id; nameFill = missed ? '#e03131' : '#191c24';
    } else {
      body += `<circle cx="${x}" cy="${y}" r="${px(11)}" fill="#fff" style="stroke:${o.color}" stroke-width="${px(2.5)}"/>${num('#6b7280')}`;
    }
    if (name) {
      const [tx, ty, anchor] = horiz ? [x, order % 2 ? y - px(18) : y + px(28), 'middle'] : x >= midX ? [x + px(16), y + px(4.5), 'start'] : [x - px(16), y + px(4.5), 'end'];
      body += `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="${fs}" stroke-width="${px(4)}" class="omap-t" style="fill:${nameFill}">${esc(name)}</text>`;
    }
  }
  return `<svg viewBox="${c.x} ${c.y} ${c.w} ${c.h}" role="img" aria-label="${esc(o.label ?? `${line.name} 지도`)}" class="omap${o.compact ? ' compact' : ''}">${body}</svg>`;
}
