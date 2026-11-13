import { elementById, lineById, modes, services, visibleLines, type Line } from '../data';
import { mapSvg } from '../map/periodic';
import { bestOf, bestOfLine } from '../store';
import { esc, icon, lineColor, navigate, recTime } from './util';

const LAST_MODE = 'sm.lastMode';
const lastMode = () => { try { return localStorage.getItem(LAST_MODE) ?? 'name'; } catch { return 'name'; } };

const levelDots = (n: number) => n < 1 ? '' : `<span class="level" aria-label="난도 ${n}">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

/**
 * 모드 카드 그림: 작은 원소 칸에서 어느 칸이 빈칸인지 (design.md 6-1-b).
 * '_X' = 빈칸, 그 안에 X가 채워지는 모습을 반복해서 보여 준다 (어떻게 푸는지).
 * d = 채워지는 순서 (혼합·완전 혼합은 칸이 차례로 채워진다)
 */
function modePic(id: string) {
  const slot = (v: string, d: number, cls: string, ghost = false) =>
    `<span class="blank ${cls}" style="--d:${d * 0.7}s">${ghost ? `<span class="ghostt">${v}</span>` : ''}<span class="fill">${v}</span></span>`;
  const mini = (n: string, s: string, k: string, d = 0, ghost = false) => `<span class="mini"><span class="caption sub">${n}</span>`
    + (s.startsWith('_') ? slot(s.slice(1), d, 'big') : `<b>${s}</b>`)
    + `<span class="caption">${k.startsWith('_') ? slot(k.slice(1), d, 'name', ghost) : k}</span></span>`;
  if (id === 'practice') return mini('9', 'F', '_플루오린', 0, true);
  if (id === 'name') return mini('9', 'F', '_플루오린');
  if (id === 'symbol') return mini('9', '_F', '플루오린');
  if (id === 'number') return mini('9', '_F', '?');
  if (id === 'mixed') return `<span class="minis">${mini('9', '_F', '플루오린', 0)}${mini('17', 'Cl', '_염소', 1)}</span>`;
  return `<span class="minis">${mini('9', '_F', '?', 0)}${mini('17', 'Cl', '_염소', 1)}${mini('35', '_Br', '브로민', 2)}</span>`;
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
        <div class="modes" role="group" aria-label="묻는 방식">${svc.modes.map((id, idx) => {
          const mm = modes.find((x) => x.id === id)!;
          const b = bestOf(l.id, id);
          return `<button class="mode" data-mode="${id}" aria-pressed="${id === mode}" style="--i:${idx}"><span class="pic">${modePic(id)}</span>
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
    // 처음 열 때만 카드가 차례로 나타난다 (모드를 바꿔 다시 그릴 때는 생략)
    sheet.classList.add('opening');
    window.setTimeout(() => sheet.classList.remove('opening'), 900);
  };
  tickets.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-line]');
    if (b) openSheet(lineById(b.dataset.line!)!);
  });
  const target = openLine ? all.find((l) => l.id === openLine) : undefined;
  if (target) openSheet(target);
  return () => { if (sheet.open) sheet.close(); };
}
