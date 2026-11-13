// 결과 카드 1080×1920 PNG (PRD 6-5-6): 노선이 칠해진 미니 주기율표 + 기록 + 서비스 이름.
import { elements, type ElementData, type Line } from '../data';
import { route } from '../map/periodic';
import type { RunResult } from '../engine/types';
import { pct, recTime } from './util';


export async function drawCard(o: { line: Line; modeLabel: string; stops: ElementData[]; res: RunResult; missed: Set<number> }): Promise<Blob> {
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
  g.fillStyle = '#191c24'; g.font = font(700, 44); g.fillText('Element_Metro', 160, 166);

  g.font = font(700, 96); g.fillText(o.line.name, 80, 340);
  g.fillStyle = '#6b7280'; g.font = font(400, 40); g.fillText(`${o.line.subtitle} · ${o.res.total_stations}역 · ${o.modeLabel}`, 84, 410);

  // 미니 주기율표
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

  // 기록
  const by = 1140;
  g.fillStyle = '#6b7280'; g.font = font(400, 40);
  g.fillText('시간', 84, by); g.fillText('정확도', 664, by);
  g.fillStyle = '#191c24'; g.font = font(700, 128);
  g.fillText(recTime(o.res.duration_ms), 80, by + 140);
  g.fillText(pct(o.res.accuracy), 660, by + 140);
  g.fillStyle = '#6b7280'; g.font = font(400, 40);
  g.fillText(`한 번에 맞힌 역 ${o.res.first_try_correct} / ${o.res.total_stations}`, 84, by + 230);
  g.fillText(`분당 ${o.res.per_minute.toFixed(1)}역`, 664, by + 230);

  g.fillStyle = '#f5f6f8'; g.fillRect(0, H - 300, W, 300);
  g.fillStyle = '#191c24'; g.font = font(700, 44); g.fillText('너도 종착역까지 달려 볼래?', 84, H - 190);
  g.fillStyle = '#3b5bdb'; g.font = font(700, 36); g.fillText(`${location.host}/element/${o.line.id}`, 84, H - 130);
  g.fillStyle = '#6b7280'; g.font = font(400, 32); g.fillText('#사이음 #Element_Metro', 84, H - 76);
  return new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('toBlob 실패'))), 'image/png'));
}
