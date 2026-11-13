import { elementById, lineById, modeById } from '../data';
import { allBest, missCounts } from '../store';
import { esc, lineColor, pct, recTime } from './util';

/** 04 내 기록 (이 기기). 랭킹(Supabase)은 다음 차례. */
export function renderRecords(main: HTMLElement) {
  const rows = Object.entries(allBest())
    .map(([k, v]) => { const [lineId, modeId] = k.split(':'); return { line: lineById(lineId), mode: modeById(modeId), v }; })
    .filter((r) => r.line && r.mode)
    .sort((a, b) => a.line!.order - b.line!.order || a.mode!.level - b.mode!.level);
  const misses = Object.entries(missCounts()).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([id, n]) => ({ e: elementById.get(Number(id)), n })).filter((m) => m.e);

  main.innerHTML = `
    <h1 class="title-l h1">내 기록</h1>
    <p class="caption sub" style="margin:4px 0 20px">이 기기에만 저장돼요. 노선·모드마다 가장 빠른 기록이에요.</p>
    ${rows.length ? `<div class="rec-list">${rows.map(({ line, mode, v }) => `
      <a class="rec-row" href="/element/${line!.id}?mode=${mode!.id}" data-link>
        <span class="dot" style="background:${lineColor(line!.color)}"></span>
        <span class="grow"><span class="label">${esc(line!.name)}</span> <span class="caption sub">· ${esc(mode!.label)}</span>
          <span class="caption sub" style="display:block">${new Date(v.played_at).toLocaleDateString('ko-KR')}</span></span>
        <span style="text-align:right"><span class="label num">${recTime(v.duration_ms)}</span><span class="caption sub num" style="display:block">정확도 ${pct(v.accuracy)}</span></span>
      </a>`).join('')}</div>`
      : `<div class="empty"><p>아직 달린 노선이 없어요.</p><a class="btn primary" href="/element/basic?mode=name" data-link>기본선으로 첫 기록 만들기</a></div>`}
    ${misses.length ? `<h2 class="title-s" style="margin:32px 0 4px">자주 틀린 원소</h2>
      <div class="review"><div class="tiles">${misses.map(({ e, n }) => `<div class="tile missed" style="--cat:var(--cat-${e!.category})"><span class="n num">${e!.id}</span><span class="s">${esc(e!.symbol)}</span><span class="k">${esc(e!.name_ko)}</span><span class="caption" style="color:var(--danger)">${n}번</span></div>`).join('')}</div></div>` : ''}`;
}
