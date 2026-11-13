import { elementById, lineById, modes, services, visibleLines, type Line } from '../data';
import { mapSvg } from '../map/periodic';
import { bestOf, bestOfLine } from '../store';
import { esc, icon, lineColor, navigate, recTime } from './util';

const LAST_MODE = 'sm.lastMode';
const lastMode = () => { try { return localStorage.getItem(LAST_MODE) ?? 'name'; } catch { return 'name'; } };

const levelDots = (n: number) => n < 1 ? '' : `<span class="level" aria-label="난도 ${n}">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

/** 모드 카드 그림: 작은 원소 칸에서 어느 칸이 빈칸인지 (design.md 6-1-b) */
function modePic(id: string) {
  const mini = (n: string, s: string, k: string) => `<span class="mini"><span class="caption sub">${n}</span>${s === '_' ? '<span class="blank"></span>' : `<b>${s}</b>`}<span class="caption">${k === '_' ? '<span class="blank" style="display:inline-block;width:40px;height:14px"></span>' : k}</span></span>`;
  if (id === 'practice') return `<span class="mini"><span class="caption sub">9</span><b>F</b><span class="caption" style="border-bottom:2px solid var(--primary)"><span class="ghostt">플루오린</span></span></span>`;
  if (id === 'symbol') return mini('9', '_', '플루오린');
  if (id === 'name') return mini('9', 'F', '_');
  if (id === 'number') return mini('9', '_', '?');
  if (id === 'mixed') return `<span style="display:flex;gap:6px">${mini('9', '_', '플루오린')}${mini('17', 'Cl', '_')}</span>`;
  return `<span style="display:flex;gap:4px">${mini('9', '_', '?')}${mini('17', 'Cl', '_')}${mini('35', '_', '브로민')}</span>`;
}

function ticket(l: Line) {
  const stops = l.station_ids.map((id) => elementById.get(id)!);
  const best = bestOfLine(l.id);
  return `<button class="ticket" data-line="${l.id}" aria-label="${esc(l.name)} 고르기">
    <div class="map-wrap">${mapSvg({ stops, color: lineColor(l.color), compact: true, label: `${l.name} 모양` })}</div>
    <div class="row"><span class="dot" style="background:${lineColor(l.color)}"></span><span class="label">${esc(l.name)}</span>${levelDots(l.level)}
      <span class="best">${best ? `<span class="done">완주</span> · <span class="num">${recTime(best.duration_ms)}</span>` : ''}</span></div>
    <div class="caption sub">${esc(l.subtitle)} · ${l.station_ids.length}역 · ${esc(l.description)}</div>
  </button>`;
}

export function renderLines(main: HTMLElement, openLine?: string, preview = false) {
  const svc = services[0];
  const all = visibleLines(svc.id, preview);
  const groups = [
    { id: 'zone', label: '족·구간 노선' },
    { id: 'period', label: '주기선' },
  ].map((g) => ({ ...g, lines: all.filter((l) => l.group === g.id) })).filter((g) => g.lines.length);
  let tab = groups.find((g) => g.lines.some((l) => l.id === openLine))?.id ?? groups[0].id;

  main.innerHTML = `
    <div class="lines-head"><div><div class="caption-strong sub">${esc(svc.name)}</div><h1 class="title-l h1">어느 노선을 탈까요?</h1></div></div>
    <div class="seg" role="group" aria-label="노선 묶음">${groups.map((g) => `<button data-tab="${g.id}">${g.label} ${g.lines.length}</button>`).join('')}</div>
    <div class="tickets" id="tickets"></div>
    <dialog class="sheet" id="modeSheet" aria-labelledby="sheetTitle"></dialog>`;

  const tickets = main.querySelector<HTMLElement>('#tickets')!;
  const drawTab = () => {
    main.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    tickets.innerHTML = groups.find((g) => g.id === tab)!.lines.map(ticket).join('');
  };
  drawTab();
  main.querySelector('.seg')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]');
    if (b) { tab = b.dataset.tab!; drawTab(); }
  });

  const sheet = main.querySelector<HTMLDialogElement>('#modeSheet')!;
  const openSheet = (l: Line) => {
    let mode = svc.modes.includes(lastMode()) ? lastMode() : svc.modes[0];
    const draw = () => {
      const m = modes.find((x) => x.id === mode)!;
      sheet.innerHTML = `<div class="sheet-in">
        <div class="grabber"></div>
        <div class="sheet-head"><div><h2 class="title-m h1" id="sheetTitle">${esc(l.name)} 타기</h2><div class="caption sub">${esc(l.subtitle)} · ${l.station_ids.length}역 · 혼합 모드 기록은 따로 저장돼요</div></div>
          <button class="icon-btn" data-close aria-label="닫기">${icon.close}</button></div>
        <div class="modes" role="group" aria-label="묻는 방식">${svc.modes.map((id) => {
          const mm = modes.find((x) => x.id === id)!;
          const b = bestOf(l.id, id);
          return `<button class="mode" data-mode="${id}" aria-pressed="${id === mode}"><span class="pic">${modePic(id)}</span>
            <span class="label">${esc(mm.label)} ${levelDots(mm.level)}</span><span class="caption sub">${esc(mm.desc ?? '')}</span>
            <span class="caption-strong ${b ? '' : 'sub'} num">${b ? recTime(b.duration_ms) : '첫 도전'}</span></button>`;
        }).join('')}</div>
        <button class="btn primary start" data-start>${esc(l.name)} 출발 · ${esc(m.label)} ${icon.arrow}</button>
      </div>`;
    };
    draw();
    sheet.onclick = (e) => {
      const t = e.target as HTMLElement;
      if (t === sheet || t.closest('[data-close]')) { sheet.close(); return; }
      const mb = t.closest<HTMLButtonElement>('[data-mode]');
      if (mb) { mode = mb.dataset.mode!; draw(); sheet.querySelector<HTMLElement>(`[data-mode="${mode}"]`)?.focus(); return; }
      if (t.closest('[data-start]')) {
        try { localStorage.setItem(LAST_MODE, mode); } catch { /* 저장 막힘 */ }
        sheet.close();
        navigate(`/element/${l.id}?mode=${mode}${preview ? '&preview=1' : ''}`);
      }
    };
    sheet.onclose = () => { if (location.pathname !== '/element' && !location.search.includes('mode=')) history.replaceState(null, '', '/element'); };
    if (location.pathname !== `/element/${l.id}`) history.pushState(null, '', `/element/${l.id}`);
    sheet.showModal();
  };
  tickets.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-line]');
    if (b) openSheet(lineById(b.dataset.line!)!);
  });
  const target = openLine ? all.find((l) => l.id === openLine) : undefined;
  if (target) openSheet(target);
  return () => { if (sheet.open) sheet.close(); };
}
