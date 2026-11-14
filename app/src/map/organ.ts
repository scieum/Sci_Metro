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
  /** 이번 역으로 확대 (메트로 타이핑처럼). 꺼져 있으면 노선 전체 */
  zoom?: boolean;
}

type Pt = [number, number, ...unknown[]];

/**
 * 이번 역 확대 영역 (메트로 타이핑처럼 카메라가 역을 따라간다, 운영자 요청 2026-11-15).
 * 이번 역이 늘 정중앙. 다음 역(가는 방향)이 화면 안에 들어올 만큼만 넓힌다 — 멀면 덜 확대한다.
 * 지난 역은 화면 밖으로 나가도 된다. 노선 전체 영역(full)의 minShare보다 작게는 확대하지 않는다.
 */
export function zoomOf(route: Pt[], curId: unknown, full: ReturnType<typeof cropOf>, w: number, h: number, pad = 60, minShare = 0.28) {
  const stops = route.filter((p) => p[2]);
  const k = stops.findIndex((p) => p[2] === curId);
  if (k < 0) return full;
  const [cx, cy] = stops[k], next = stops[k + 1];
  const dx = next ? Math.abs(next[0] - cx) : 0, dy = next ? Math.abs(next[1] - cy) : 0;
  const zw = Math.max(full.w * minShare, 2 * (dx + pad), (2 * (dy + pad) * w) / h), zh = (zw * h) / w;
  return { x: cx - zw / 2, y: cy - zh / 2, w: zw, h: zh, sc: w / zw };
}

/** 지도 svg의 viewBox를 from에서 지금 값으로 부드럽게 옮긴다 (카메라 이동). 움직임 줄이기 설정이면 바로. */
export function tweenViewBox(svg: SVGSVGElement, from: string, ms = 480) {
  const to = svg.getAttribute('viewBox');
  if (!to || to === from || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = from.split(' ').map(Number), b = to.split(' ').map(Number);
  if (a.length !== 4 || a.some(Number.isNaN)) return;
  const t0 = performance.now();
  svg.setAttribute('viewBox', from);
  const step = (t: number) => {
    if (!svg.isConnected) return; // 다음 역을 그리면서 svg가 바뀌었다
    const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3;
    svg.setAttribute('viewBox', a.map((v, i) => v + (b[i] - v) * e).join(' '));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** 경로가 지나는 부분을 화면 비율(w:h)에 맞춰 자른 영역 */
export function cropOf(route: Pt[], w: number, h: number, pad: number) {
  const xs = route.map((p) => p[0]), ys = route.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const rh = Math.max(y1 - y0 + 2 * pad, ((x1 - x0 + 2 * pad) * h) / w), rw = (rh * w) / h;
  return { x: (x0 + x1) / 2 - rw / 2, y: (y0 + y1) / 2 - rh / 2, w: rw, h: rh, sc: w / rw };
}

export function organMap(line: Line, o: OrganMapOptions): string {
  const scene = scenes[line.scene!], route = line.route!;
  const W = o.compact ? 320 : 480, H = o.compact ? 160 : 340;
  const seq = o.index !== undefined;
  const curId = seq ? o.ids[o.index!] : o.currentId;
  const full = cropOf(route, W, H, o.compact ? 50 : 70);
  const c = o.zoom && curId !== undefined ? zoomOf(route, curId, full, W, H) : full;
  const px = (v: number) => v / c.sc; // 화면 px → 이미지 px
  const run = new Set(o.ids);
  const passed = seq ? new Set(o.ids.slice(0, o.index)) : o.passed;
  const overview = curId === undefined && !passed;
  const pts = (to = route.length - 1, from = 0) => route.slice(from, to + 1).map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const lw = px(o.compact ? 4 : 6);
  // 순서대로 달릴 때만 지나온 구간을 진하게
  const curPt = seq && curId !== undefined ? route.findIndex((p) => p[2] === curId) : -1;
  // 확대 중에는 앞길을 다음 역까지만 (그 너머 길·역은 감춘다 — 겹친 선이 어지럽지 않게)
  const ahead = o.zoom && curPt >= 0;
  const nextPt = ahead ? route.findIndex((p, i) => i > curPt && p[2]) : -1;
  const end = ahead ? (nextPt < 0 ? curPt : nextPt) : route.length - 1;
  const stroke = (d: string, extra = '') => `<path d="${d}" style="stroke:${o.color}" stroke-width="${lw}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  let body = `<image href="${scene.src}" x="0" y="0" width="${scene.w}" height="${scene.h}"/>`
    + `<path d="${pts(end)}" stroke="#fff" stroke-width="${lw + px(4)}" stroke-opacity=".9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + (ahead
      ? (end > curPt ? stroke(pts(end, curPt), 'opacity=".45" stroke-dasharray="' + px(10) + ' ' + px(8) + '"') : '')
      : stroke(pts(), `opacity="${overview ? 1 : 0.35}"`))
    + (curPt > 0 ? stroke(pts(curPt)) : '');
  const nextId = nextPt >= 0 ? route[nextPt][2] : undefined;
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
      if (ahead && id !== nextId) continue; // 다음 역 너머는 아직 안 보여 준다
      body += `<circle cx="${x}" cy="${y}" r="${px(11)}" fill="#fff" style="stroke:${o.color}" stroke-width="${px(2.5)}"/>${num('#6b7280')}`;
    }
    if (name) {
      const [tx, ty, anchor] = horiz ? [x, order % 2 ? y - px(18) : y + px(28), 'middle'] : x >= midX ? [x + px(16), y + px(4.5), 'start'] : [x - px(16), y + px(4.5), 'end'];
      body += `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="${fs}" stroke-width="${px(4)}" class="omap-t" style="fill:${nameFill}">${esc(name)}</text>`;
    }
  }
  return `<svg viewBox="${c.x} ${c.y} ${c.w} ${c.h}" role="img" aria-label="${esc(o.label ?? `${line.name} 지도`)}" class="omap${o.compact ? ' compact' : ''}">${body}</svg>`;
}
