// 결과 카드 1080×1920 PNG (PRD 6-5-6): 노선 지도(미니 주기율표 또는 몸 그림) + 기록 + 서비스 이름.
import { elementById, elements, scenes, type ElementData, type Line, type Service, type StopId, type StopView } from '../data';
import { cropOf } from '../map/organ';
import { route } from '../map/periodic';
import type { RunResult } from '../engine/types';
import { pct, recTime } from './util';


export async function drawCard(o: { svc: Service; line: Line; modeLabel: string; stops: StopView[]; res: RunResult; missed: Set<StopId> }): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1080, H = 1920;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  // 카드는 다크 모드여도 흰 바탕 (스토리에 올렸을 때 일정하게)
  const lineCol = getComputedStyle(document.documentElement).getPropertyValue(`--${o.line.color}`).trim() || '#2b2f3a';
  const font = (w: number, s: number) => `${w} ${s}px 'Pretendard Variable', Pretendard, sans-serif`;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.fillStyle = lineCol; g.fillRect(0, 0, W, 24);

  g.fillStyle = '#3b5bdb'; g.beginPath(); g.arc(110, 150, 26, 0, Math.PI * 2); g.lineWidth = 9; g.strokeStyle = '#3b5bdb'; g.stroke();
  g.beginPath(); g.arc(110, 150, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#191c24'; g.font = font(700, 44); g.fillText(o.svc.name, 160, 166);

  g.font = font(700, 96); g.fillText(o.line.name, 80, 340);
  g.fillStyle = '#6b7280'; g.font = font(400, 40); g.fillText(`${o.line.subtitle} · ${o.res.total_stations}역 · ${o.modeLabel}`, 84, 410);

  if (o.line.scene && o.line.route) await drawScene(g, o.line, lineCol, o.missed, W);
  else if (o.line.service_id === 'iupac') await drawMolecules(g, o.stops, lineCol, o.missed, W);
  else drawTable(g, o.stops.map((s) => elementById.get(Number(s.id))!), lineCol, o.missed, W);
  drawRecord(g, o, W, H, font);
  return new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('toBlob 실패'))), 'image/png'));
}

/** 몸 지도: 장면 그림을 노선 부분만 잘라 넣고 그 위에 노선을 그린다 */
async function drawScene(g: CanvasRenderingContext2D, line: Line, lineCol: string, missed: Set<StopId>, W: number) {
  const sc = scenes[line.scene!], box = { x: 80, y: 480, w: W - 160, h: 600 };
  const c = cropOf(line.route!, box.w, box.h, 70);
  const img = new Image(); img.src = sc.src;
  try { await img.decode(); } catch { /* 그림을 못 불러와도 노선은 그린다 */ }
  g.save(); g.beginPath(); g.roundRect(box.x, box.y, box.w, box.h, 24); g.clip();
  g.fillStyle = '#ffffff'; g.fillRect(box.x, box.y, box.w, box.h);
  if (img.complete && img.naturalWidth) g.drawImage(img, box.x - c.x * c.sc, box.y - c.y * c.sc, sc.w * c.sc, sc.h * c.sc);
  const P = (p: [number, number, ...unknown[]]) => [box.x + (p[0] - c.x) * c.sc, box.y + (p[1] - c.y) * c.sc] as const;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [col, w] of [['#ffffff', 16], [lineCol, 10]] as const) {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath();
    line.route!.forEach((p, i) => { const [x, y] = P(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
  for (const p of line.route!) {
    if (!p[2]) continue;
    const [x, y] = P(p), miss = missed.has(p[2]);
    g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2);
    g.fillStyle = miss ? '#ffffff' : lineCol; g.fill();
    g.lineWidth = 5; g.strokeStyle = miss ? '#e03131' : '#ffffff'; g.stroke();
  }
  g.restore();
}

/** 분자 모형을 역 순서대로 칸에 (틀린 역은 빨간 테두리) */
async function drawMolecules(g: CanvasRenderingContext2D, stops: StopView[], lineCol: string, missed: Set<StopId>, W: number) {
  const box = { x: 80, y: 480, w: W - 160, h: 600 }, n = stops.length;
  const cols = Math.ceil(Math.sqrt((n * box.w) / box.h)), rows = Math.ceil(n / cols);
  const cw = box.w / cols, ch = box.h / rows, G = 10;
  const imgs = await Promise.all(stops.map(async (s) => {
    const img = new Image(); img.src = s.img!;
    try { await img.decode(); return img; } catch { return null; } // 그림을 못 불러오면 칸만
  }));
  stops.forEach((s, i) => {
    const x = box.x + (i % cols) * cw + G / 2, y = box.y + Math.floor(i / cols) * ch + G / 2, w = cw - G, h = ch - G;
    const miss = missed.has(s.id);
    g.fillStyle = '#ffffff'; g.lineWidth = miss ? 6 : 3; g.strokeStyle = miss ? '#e03131' : lineCol;
    g.beginPath(); g.roundRect(x, y, w, h, 16); g.fill(); g.stroke();
    const img = imgs[i];
    if (img?.naturalWidth) {
      const k = Math.min((w - 24) / img.naturalWidth, (h - 24) / img.naturalHeight);
      g.drawImage(img, x + (w - img.naturalWidth * k) / 2, y + (h - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
    }
  });
}

/** 미니 주기율표 */
function drawTable(g: CanvasRenderingContext2D, stops: ElementData[], lineCol: string, missed: Set<StopId>, W: number) {
  const o = { stops, missed };
  const C = 50, G = 4, FG = 14, x0 = (W - (18 * C + 17 * G)) / 2, y0 = 500;
  const pos = (e: ElementData) => [x0 + (e.grid.col - 1) * (C + G), y0 + (e.grid.row - 1) * (C + G) + (e.grid.row >= 8 ? FG : 0)];
  const onLine = new Set(o.stops.map((s) => s.id));
  for (const e of elements) {
    const [x, y] = pos(e);
    g.fillStyle = onLine.has(e.id) ? (o.missed.has(e.id) ? '#fbe3e3' : '#eef2ff') : '#f0f1f4';
    g.fillRect(x, y, C, C);
  }
  // 노선 선 (지도 모듈 좌표 40/4/12 → 카드 좌표로 비율 변환)
  const sx = (C + G) / 44, pts = route(o.stops);
  g.strokeStyle = lineCol; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([px, py], i) => {
    const X = x0 + (px - 20) * sx + C / 2;
    const rowShift = py > 7 * 44 ? FG - 12 * sx : 0;
    const Y = y0 + (py - 20) * sx + C / 2 + rowShift;
    if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
  });
  g.stroke();
  for (const e of o.stops) {
    const [x, y] = pos(e);
    g.beginPath(); g.arc(x + C / 2, y + C / 2, 15, 0, Math.PI * 2);
    g.fillStyle = o.missed.has(e.id) ? '#ffffff' : lineCol; g.fill();
    if (o.missed.has(e.id)) { g.lineWidth = 4; g.strokeStyle = '#e03131'; g.stroke(); }
  }

}

function drawRecord(g: CanvasRenderingContext2D, o: { svc: Service; line: Line; res: RunResult }, W: number, H: number, font: (w: number, s: number) => string) {
  const by = 1140;
  g.fillStyle = '#6b7280'; g.font = font(400, 40);
  g.fillText('시간', 84, by); g.fillText('정확도', 664, by);
  g.fillStyle = '#191c24'; g.font = font(700, 128);
  g.fillText(recTime(o.res.duration_ms), 80, by + 140);
  g.fillText(pct(o.res.accuracy), 660, by + 140);
  g.fillStyle = '#6b7280'; g.font = font(400, 40);
  g.fillText(`한 번에 맞힌 역 ${o.res.first_try_correct} / ${o.res.total_stations}`, 84, by + 230);
  g.fillText(`평균 ${o.res.cpm}타/분`, 664, by + 230);

  g.fillStyle = '#f5f6f8'; g.fillRect(0, H - 300, W, 300);
  g.fillStyle = '#191c24'; g.font = font(700, 44); g.fillText('너도 종착역까지 달려 볼래?', 84, H - 190);
  g.fillStyle = '#3b5bdb'; g.font = font(700, 36); g.fillText(`${location.host}/${o.svc.id}/${o.line.id}`, 84, H - 130);
  g.fillStyle = '#6b7280'; g.font = font(400, 32); g.fillText(`#사이음 #${o.svc.name}`, 84, H - 76);
}
