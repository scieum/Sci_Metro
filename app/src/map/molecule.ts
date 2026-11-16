// IUPAC_Metro 지도 모듈. 배경 그림이 없는 노선이라
// - 달리는 중(이번 역이 있음): 이번 역 분자 모형을 크게 (이 그림이 곧 문제)
// - 승차권·서비스 썸네일: 노선의 대표 분자 3개
// - 그 밖의 둘러보기: 역을 지그재그로 이은 노선도
import { moleculeById, moleculeImg, type Line, type StopId } from '../data';

export interface MoleculeMapOptions {
  ids: StopId[];
  color: string;
  index?: number;
  currentId?: StopId;
  compact?: boolean;
  label?: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function moleculeMap(line: Line, o: MoleculeMapOptions): string {
  const curId = o.index !== undefined ? o.ids[o.index] : o.currentId;
  // alt에 이름을 쓰면 화면 읽기 사용자에게 답이 들린다
  if (curId !== undefined && !o.compact) return `<div class="mmap"><img src="${moleculeImg(curId)}" alt="이번 역 분자 모형"/></div>`;
  // 승차권·서비스 썸네일: 노선의 대표 분자 (없으면 처음·가운데·끝)
  if (o.compact) {
    const pick = line.featured ?? [...new Set([o.ids[0], o.ids[Math.floor(o.ids.length / 2)], o.ids[o.ids.length - 1]])];
    const names = pick.map((id) => moleculeById.get(String(id))?.name ?? '').join(', ');
    return `<div class="mthumb" role="img" aria-label="${esc(o.label ?? line.name)}: ${esc(names)}">${pick.map((id) => `<img src="${moleculeImg(id)}" alt=""/>`).join('')}</div>`;
  }

  // 둘러보기(이번 역 없음): 5역씩 줄을 바꿔 뱀처럼 잇는다
  const n = o.ids.length, cols = Math.min(n, 5), rows = Math.ceil(n / cols);
  const W = 480, gap = W / cols, rowH = 64, H = rows * rowH;
  const pt = (i: number) => {
    const r = Math.floor(i / cols), c = r % 2 ? cols - 1 - (i % cols) : i % cols;
    return [gap * (c + 0.5), rowH * (r + 0.5)];
  };
  const pts = o.ids.map((_, i) => pt(i));
  let body = `<path d="${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')}" style="stroke:${o.color}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  pts.forEach(([x, y], i) => {
    body += `<circle cx="${x}" cy="${y}" r="9" fill="#fff" style="stroke:${o.color}" stroke-width="3"/>`;
    body += `<text x="${x}" y="${y + 24}" class="omap-t" text-anchor="middle" font-size="12" stroke-width="4" style="fill:#191c24">${esc(moleculeById.get(String(o.ids[i]))?.name ?? '')}</text>`;
  });
  return `<svg viewBox="0 -12 ${W} ${H + 24}" role="img" aria-label="${esc(o.label ?? `${line.name} 지도`)}" class="omap">${body}</svg>`;
}
