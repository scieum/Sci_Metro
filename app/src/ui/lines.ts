import { lineById, modes, visibleLines, type Line, type Service } from '../data';
import { lineMap } from '../map';
import { bestOf, bestOfLine } from '../store';
import { esc, icon, lineColor, navigate, recTime } from './util';

const LAST_MODE = 'sm.lastMode';
const lastMode = () => { try { return localStorage.getItem(LAST_MODE) ?? 'name'; } catch { return 'name'; } };

const levelDots = (n: number) => n < 1 ? '' : `<span class="level" aria-label="난도 ${n}">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

/**
 * 모드 카드 그림: 작은 원소 칸에서 어느 칸이 빈칸인지 (design.md 6-1-b).
 * '_X' = 빈칸. 창이 열려 있는 동안 X를 실제로 치는 것처럼 써 보인다 (startTyping).
 * d = 치는 순서 (혼합·완전 혼합은 칸을 차례로 친다)
 */
function modePic(id: string) {
  const slot = (v: string, d: number, cls: string, ghost = false) =>
    `<span class="blank ${cls}${ghost ? ' trace' : ''}" data-type="${v}" data-d="${d}">${ghost ? `<span class="ghostt">${v}</span>` : ''}<span class="fill"></span></span>`;
  const mini = (n: string, s: string, k: string, d = 0, ghost = false) => `<span class="mini"><span class="caption sub">${n}</span>`
    + (s.startsWith('_') ? slot(s.slice(1), d, 'big') : `<b>${s}</b>`)
    + `<span class="caption">${k.startsWith('_') ? slot(k.slice(1), d, 'name', ghost) : k}</span></span>`;
  // Organism_Metro: 위 = 순서, 가운데 = 하는 일(짧게), 아래 = 기관 이름
  if (id === 'trace') return mini('3', '펩신', '_위', 0, true);
  if (id === 'recall') return mini('3', '펩신', '_위');
  if (id === 'sequence') return mini('3', '?', '_위');
  if (id === 'scramble') return `<span class="minis">${mini('5', '물', '_대장', 0)}${mini('2', '연동', '_식도', 1)}</span>`;
  // IUPAC_Metro: 위 = 순서, 가운데 = 분자 모형, 아래 = 이름
  const mol = (m: string) => `<img src="/molecule/${m}.svg" alt="" style="height:28px;width:auto;max-width:100%">`;
  if (id === 'mol-trace') return mini('2', mol('ethanol'), '_에탄올', 0, true);
  if (id === 'mol-recall') return mini('2', mol('ethanol'), '_에탄올');
  if (id === 'mol-scramble') return `<span class="minis">${mini('5', mol('ethanoic-acid'), '_에탄산', 0)}${mini('1', mol('methanol'), '_메탄올', 1)}</span>`;
  if (id === 'practice') return mini('9', 'F', '_플루오린', 0, true);
  if (id === 'name') return mini('9', 'F', '_플루오린');
  if (id === 'symbol') return mini('9', '_F', '플루오린');
  if (id === 'number') return mini('9', '_F', '?');
  if (id === 'mixed') return `<span class="minis">${mini('9', '_F', '플루오린', 0)}${mini('17', 'Cl', '_염소', 1)}</span>`;
  return `<span class="minis">${mini('9', '_F', '?', 0)}${mini('17', 'Cl', '_염소', 1)}${mini('35', '_Br', '브로민', 2)}</span>`;
}

/** 두벌식으로 칠 때 화면에 보이는 순서: 플 → ㅍ, 프, 플 */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export function typingSteps(word: string): string[] {
  const out: string[] = [];
  let done = '';
  for (const ch of word) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c >= 0 && c <= 11171) {
      const cho = Math.floor(c / 588), jung = Math.floor((c % 588) / 28);
      out.push(done + CHO[cho], done + String.fromCharCode(0xac00 + cho * 588 + jung * 28));
      if (c % 28) out.push(done + ch);
    } else out.push(done + ch);
    done += ch;
  }
  return out;
}

/** 카드마다 빈칸을 한 글자씩 쳐 보이고, 잠깐 멈췄다가 지우고 다시. 멈추는 함수를 돌려준다. */
function startTyping(root: HTMLElement): () => void {
  const cards = [...root.querySelectorAll<HTMLElement>('.mode')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const plans = cards.map((card) => {
    const blanks = [...card.querySelectorAll<HTMLElement>('[data-type]')].sort((a, b) => Number(a.dataset.d) - Number(b.dataset.d));
    let t = 5; // 창이 뜨고 조금 뒤에 시작
    const items = blanks.map((el) => { const steps = typingSteps(el.dataset.type!); const it = { el, fill: el.querySelector<HTMLElement>('.fill')!, steps, start: t }; t += steps.length + 4; return it; });
    return { items, cycle: t + 14 }; // 다 치고 1.5초쯤 보여 준 뒤 지운다
  });
  if (reduce) { plans.forEach((p) => p.items.forEach((it) => { it.fill.textContent = it.el.dataset.type!; })); return () => {}; }
  let tick = 0;
  const id = window.setInterval(() => {
    tick++;
    for (const p of plans) {
      const t = tick % p.cycle;
      for (const it of p.items) {
        const k = t - it.start;
        const typing = k >= 0 && k < it.steps.length;
        it.fill.textContent = t >= p.cycle - 3 || k < 0 ? '' : typing ? it.steps[k] : it.el.dataset.type!;
        it.el.classList.toggle('typing', typing || (k >= -2 && k < 0));
      }
    }
  }, 110);
  return () => clearInterval(id);
}

function ticket(l: Line) {
  const best = bestOfLine(l.id);
  return `<button class="ticket" data-line="${l.id}" aria-label="${esc(l.name)} 고르기">
    <div class="map-wrap">${lineMap(l, { compact: true, label: `${l.name} 모양` })}</div>
    <div class="row"><span class="dot" style="background:${lineColor(l.color)}"></span><span class="label">${esc(l.name)}</span>${levelDots(l.level)}
      <span class="best">${best ? `<span class="done">완주</span> · <span class="num">${recTime(best.duration_ms)}</span>` : ''}</span></div>
    <div class="caption sub">${esc(l.subtitle)} · ${l.station_ids.length}역 · ${esc(l.description)}</div>
  </button>`;
}

/**
 * 서비스 둘러보기 탭: 노선 묶음(services.json groups) + 학습 페이지(study, 있을 때만).
 * 노선 묶음은 같은 화면에서 바뀌고, 학습 페이지는 /<서비스>/<study.path> 로 간다.
 */
export function serviceTabs(svc: Service, groups: Array<{ id: string; label: string }>, active: string) {
  return `<nav class="seg" aria-label="${esc(svc.name)} 둘러보기">${groups.map((g) => active === 'table'
    ? `<a href="/${svc.id}?tab=${g.id}" data-link>${esc(g.label)}</a>`
    : `<button data-tab="${g.id}" aria-pressed="${g.id === active}">${esc(g.label)}</button>`).join('')}`
    + (svc.study ? `<a href="/${svc.id}/${svc.study.path}" data-link ${active === 'table' ? 'aria-current="page"' : ''}>${icon.grid} ${esc(svc.study.label)}</a>` : '') + '</nav>';
}

export function renderLines(main: HTMLElement, svc: Service, openLine?: string, preview = false) {
  const all = visibleLines(svc.id, preview);
  const groups = svc.groups.map((g) => ({ ...g, lines: all.filter((l) => l.group === g.id) })).filter((g) => g.lines.length);
  const asked = new URL(location.href).searchParams.get('tab');
  let tab = groups.find((g) => g.lines.some((l) => l.id === openLine))?.id ?? groups.find((g) => g.id === asked)?.id ?? groups[0].id;

  main.innerHTML = `
    <div class="lines-head"><div><div class="caption-strong sub">${esc(svc.name)}</div><h1 class="title-l h1">어느 노선을 탈까요?</h1></div></div>
    ${serviceTabs(svc, groups.map((g) => ({ id: g.id, label: `${g.label} ${g.lines.length}` })), tab)}
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
  let stopTyping: () => void = () => {};
  const openSheet = (l: Line) => {
    let mode = svc.modes.includes(lastMode()) ? lastMode() : svc.modes[1] ?? svc.modes[0];
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
        <button class="btn primary start" data-start><span id="startLabel">${esc(l.name)} 출발 · ${esc(m.label)}</span> ${icon.arrow}</button>
      </div>`;
    };
    draw();
    stopTyping();
    stopTyping = startTyping(sheet);
    // 모드를 고르면 다시 그리지 않고 선택 표시와 출발 버튼만 바꾼다 (타이핑 애니메이션이 이어지게)
    const select = (id: string) => {
      mode = id;
      sheet.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === id)));
      sheet.querySelector('#startLabel')!.textContent = `${l.name} 출발 · ${modes.find((x) => x.id === id)!.label}`;
    };
    sheet.onclick = (e) => {
      const t = e.target as HTMLElement;
      if (t === sheet || t.closest('[data-close]')) { sheet.close(); return; }
      const mb = t.closest<HTMLButtonElement>('[data-mode]');
      if (mb) { select(mb.dataset.mode!); return; }
      if (t.closest('[data-start]')) {
        try { localStorage.setItem(LAST_MODE, mode); } catch { /* 저장 막힘 */ }
        sheet.close();
        navigate(`/${svc.id}/${l.id}?mode=${mode}${preview ? '&preview=1' : ''}`);
      }
    };
    sheet.onclose = () => { stopTyping(); if (location.pathname !== `/${svc.id}` && !location.search.includes('mode=')) history.replaceState(null, '', `/${svc.id}`); };
    if (location.pathname !== `/${svc.id}/${l.id}`) history.pushState(null, '', `/${svc.id}/${l.id}`);
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
  return () => { stopTyping(); if (sheet.open) sheet.close(); };
}
