import { lineById, services, visibleLines } from '../data';
import { lineMap } from '../map';
import { esc, icon, lineColor } from './util';

/** 01 Science_Metro 홈. 서비스 목록은 services.json에서 읽는다 (PRD 6-1-4). */
export function renderHome(main: HTMLElement) {
  const svc = services[0];
  const basic = lineById(svc.default_line)!;
  main.innerHTML = `
    <section class="hero">
      <div>
        <h1 class="display h1">과학 지식을 타이핑하며<br>종착역까지 달려요</h1>
        <p class="body sub">외우기 어려운 과학 지식, 이제 타이핑하며 배워 봐요.</p>
        <a class="btn primary" href="/${svc.id}/${basic.id}?mode=name" data-link>${esc(basic.name)}으로 바로 출발 ${icon.arrow}</a>
      </div>
      <div class="card" style="padding:16px">
        <div class="caption-strong" style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span class="dot" style="background:${lineColor(basic.color)}"></span>${esc(basic.name)} <span class="sub caption" style="margin-left:auto">${esc(basic.subtitle)} · ${basic.station_ids.length}역</span></div>
        ${lineMap(basic, { index: 2, missed: new Set(), label: `${basic.name} 노선도` })}
      </div>
    </section>
    <section class="svc-list" aria-label="서비스">
      ${services.map((s) => {
        const open = s.status === 'open';
        const l = open ? lineById(s.default_line) : undefined;
        const thumb = l ? lineMap(l, { compact: true }) : '';
        const inner = `<div class="thumb">${thumb}</div>
          <div class="grow"><div class="label">${esc(s.name)} <span class="badge${open ? ' live' : ''}">${open ? '운행 중' : '개통 예정'}</span></div>
          <div class="caption sub">${open ? `노선 ${visibleLines(s.id).length}개 · ${esc(s.blurb)}` : '곧 열려요'}</div></div>${open ? icon.chevron : ''}`;
        return open ? `<a class="svc-row" href="/${s.id}" data-link>${inner}</a>` : `<div class="svc-row" aria-disabled="true">${inner}</div>`;
      }).join('')}
    </section>`;
}
