// 06 주기율표 학습 + 06-b 원소 상세 팝업 (design.md 6-4). Element_Metro 안의 페이지.
import detailJson from '../../data/elements-detail.json';
import { allLines, elements, elementById, serviceById, visibleLines, type ElementData } from '../data';
import { serviceTabs } from './lines';
import { boxes, configuration, shells, subText } from '../map/electrons';
import { esc, icon, lineColor } from './util';

interface Detail {
  mass: number; mass_estimated: boolean; density: number | null; density_unit: string;
  melting_c: number | null; boiling_c: number | null; electronegativity: number | null; state: string | null;
  discovered: { year: number | null; ancient: boolean; by: string };
  zh: string | null; hanja: string | null; symbol_origin: string | null; society_name: string | null;
}
const detail = (detailJson as { reviewed: boolean; elements: Record<string, Detail> });

export const CATEGORIES: Array<[string, string]> = [
  ['alkali_metal', '알칼리 금속'], ['alkaline_earth_metal', '알칼리 토금속'], ['transition_metal', '전이 금속'],
  ['post_transition_metal', '전이후 금속'], ['metalloid', '준금속'], ['nonmetal', '비금속'], ['halogen', '할로젠'],
  ['noble_gas', '비활성 기체'], ['lanthanide', '란타넘족'], ['actinide', '악티늄족'], ['unknown', '성질 미확인'],
];
const catLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;
const gridRow = (e: ElementData) => (e.grid.row >= 8 ? e.grid.row + 1 : e.grid.row); // 8줄째는 f구역과의 틈

function bohrSvg(e: ElementData, size = 200) {
  const sh = shells(e.id);
  const c = size / 2, r0 = size * 0.11, rMax = size * 0.47;
  const step = (rMax - size * 0.2) / Math.max(1, sh.length - 1);
  const rings = sh.map((_, i) => size * 0.2 + i * step);
  const dot = size >= 180 ? 3.6 : 3;
  const ringSvg = rings.map((r) => `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--text)" stroke-opacity=".22" stroke-width="1.2"/>`).join('');
  const dots = sh.map((n, i) => Array.from({ length: n }, (_, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / n;
    const outer = i === sh.length - 1;
    return `<circle cx="${(c + rings[i] * Math.cos(a)).toFixed(1)}" cy="${(c + rings[i] * Math.sin(a)).toFixed(1)}" r="${dot}" style="fill:var(${outer ? '--primary' : '--text'})"/>`;
  }).join('')).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="보어 모형: 껍질별 전자 ${sh.join(', ')}">${ringSvg}${dots}`
    + `<circle cx="${c}" cy="${c}" r="${r0}" style="fill:var(--cat-${e.category})"/><text x="${c}" y="${c + 4}" text-anchor="middle" class="nuc">${e.id}+</text></svg>`;
}

const num = (v: number | null, unit = '') => (v === null ? '<span class="sub">—</span>' : `${v}${unit ? `<span class="caption sub"> ${unit}</span>` : ''}`);

function detailHtml(e: ElementData) {
  const d = detail.elements[e.id];
  const conf = configuration(e.id);
  const sh = shells(e.id);
  const place = e.group ? `${e.period}주기 ${e.group}족` : `${e.period}주기`;
  const others = e.aliases_ko.filter((a) => a !== d.society_name);
  const nameRows: Array<[string, string, string]> = d.society_name
    ? [['대한화학회', d.society_name, '입력해도 정답이에요'], ['이 앱 표기', e.name_ko, '교과서·수업에서 익숙한 이름']]
    : [['공식 이름', e.name_ko, '대한화학회']];
  for (const a of others) nameRows.push(['예전 이름', a, '입력해도 정답이에요']);
  nameRows.push(['영어', e.name_en, '']);
  if (d.hanja) nameRows.push(['한자', d.hanja, '']);
  if (d.zh) nameRows.push(['중국어', d.zh, '']);
  if (d.symbol_origin) nameRows.push(['기호 유래', d.symbol_origin, `→ ${e.symbol}`]);
  const mass = d.mass_estimated ? `[${d.mass}]` : String(d.mass);
  const props: Array<[string, string]> = [
    ['원자량', mass + (d.mass_estimated ? '<span class="caption sub"> 가장 안정한 동위원소</span>' : '')],
    ['밀도', num(d.density, d.density_unit)],
    ['상온 상태', d.state ?? '<span class="sub">알려지지 않음</span>'],
    ['녹는점', num(d.melting_c, '°C')],
    ['끓는점', num(d.boiling_c, '°C')],
    ['전기 음성도', num(d.electronegativity)],
  ];
  const lines = allLines.filter((l) => l.status === 'open' && l.station_ids.includes(e.id));
  const disc = d.discovered.ancient ? '고대부터 알려짐' : `${d.discovered.year}년 · ${esc(d.discovered.by)}`;
  return `<div class="ed">
    <section class="ed-left" style="--cat:var(--cat-${e.category})">
      <div class="ed-top"><span class="title-m sub num">${e.id}</span><span class="cat-chip"><span class="dot" style="background:var(--cat-${e.category})"></span>${catLabel(e.category)} · ${place}</span></div>
      <div class="ed-sym">${esc(e.symbol)}</div>
      <div class="title-m">${esc(e.name_ko)}</div>
      <div class="body-s sub">${esc(e.name_en)} · 원자량 ${mass}</div>
      <div class="ed-bohr">${bohrSvg(e)}<div class="caption sub">껍질별 전자 ${sh.join(' · ')} (바깥 전자 ${sh[sh.length - 1]}개)</div></div>
    </section>
    <section class="ed-right">
      <div class="ed-head"><div><h2 class="title-l h1" id="edTitle">${esc(e.name_ko)}</h2><span class="body-s sub">${esc(e.symbol)} · ${e.id}번 원소</span></div>
        <button class="icon-btn" data-close aria-label="닫기">${icon.close}</button></div>
      <div class="ed-sec"><h3 class="caption-strong sub">이름</h3><dl class="ed-names">${nameRows.map(([k, v, n]) => `<div><dt>${k}</dt><dd><b>${esc(v)}</b>${n ? `<span class="caption sub"> ${esc(n)}</span>` : ''}</dd></div>`).join('')}</dl></div>
      <div class="ed-sec"><h3 class="caption-strong sub">전자 배치</h3>
        <p class="ed-conf"><span class="title-s">${subText(conf.full)}</span>${conf.core ? `<span class="body-s sub">줄여 쓰면 [${conf.core}] ${subText(conf.valence)}</span>` : ''}</p>
        <div class="ed-boxes">${(e.id <= 20 ? conf.full : conf.valence).map((s) => `<div class="ob"><div class="obx">${boxes(s).map((b) => `<span>${b}</span>`).join('')}</div><span class="caption sub">${s.n}${s.l}</span></div>`).join('')}</div>
        ${e.id >= 104 ? '<p class="caption sub">104번부터는 예측한 배치예요.</p>' : ''}</div>
      <div class="ed-sec"><h3 class="caption-strong sub">성질</h3><div class="ed-props">${props.map(([k, v]) => `<div><span class="caption sub">${k}</span><span class="title-s num">${v}</span></div>`).join('')}</div></div>
      <div class="ed-sec"><h3 class="caption-strong sub">발견</h3><p class="label">${disc}</p></div>
      ${detail.reviewed ? '' : '<p class="caption sub">이름 밖의 값은 선생님 검수 전이에요. 녹는점·끓는점은 1기압 기준이에요.</p>'}
    </section>
    <footer class="ed-foot">
      <div class="ed-lines"><span class="caption-strong sub">이 역을 지나는 노선</span>${lines.map((l) => `<a class="chip" href="/element/${l.id}" data-link><span class="dot" style="background:${lineColor(l.color)}"></span>${esc(l.name)}</a>`).join('')}</div>
      ${lines[0] ? `<a class="btn primary" href="/element/${lines[0].id}" data-link>${esc(lines[0].name)}으로 출발 ${icon.arrow}</a>` : ''}
    </footer>
  </div>`;
}

export function renderTable(main: HTMLElement, openZ?: number) {
  let cat = 'all';
  main.innerHTML = `
    <div class="lines-head"><div>
      <div class="caption-strong sub">Element_Metro</div>
      <h1 class="title-l h1">주기율표 학습</h1></div></div>
    ${serviceTabs(serviceById('element')!, [{ id: 'zone', label: '족·구간 노선' }, { id: 'period', label: '주기선' }].map((g) => ({ id: g.id, label: `${g.label} ${visibleLines('element').filter((l) => l.group === g.id).length}` })), 'table')}
    <div class="table-tools">
      <p class="body-s sub">원소를 누르면 이름, 전자 배치, 발견 이야기까지 볼 수 있어요.</p>
      <label class="search">${icon.search}<input id="q" type="search" placeholder="이름이나 기호로 찾기 (예: 나트륨, Na)" autocomplete="off" aria-label="원소 찾기"></label>
    </div>
    <div class="cats" role="group" aria-label="분류">
      <button class="chip" data-cat="all" aria-pressed="true">전체</button>
      ${CATEGORIES.map(([k, v]) => `<button class="chip" data-cat="${k}" aria-pressed="false"><span class="dot" style="background:color-mix(in srgb, var(--cat-${k}) 28%, var(--bg));box-shadow:inset 0 0 0 1.5px var(--cat-${k})"></span>${v}</button>`).join('')}
    </div>
    <div class="ptable-wrap"><div class="ptable" id="ptable">${elements.map((e) => `<button class="el" data-z="${e.id}" data-cat="${e.category}" style="grid-row:${gridRow(e)};grid-column:${e.grid.col};--cat:var(--cat-${e.category})" aria-label="${e.id}번 ${esc(e.name_ko)} ${esc(e.symbol)}">
      <span class="n num">${e.id}</span><span class="s">${esc(e.symbol)}</span><span class="k">${esc(e.name_ko)}</span></button>`).join('')}</div></div>
    <p class="caption sub hint-scroll">옆으로 밀어서 전체 보기 →</p>
    <dialog class="sheet edetail" id="edetail" aria-labelledby="edTitle"></dialog>`;

  const table = main.querySelector<HTMLElement>('#ptable')!;
  const q = main.querySelector<HTMLInputElement>('#q')!;
  const dlg = main.querySelector<HTMLDialogElement>('#edetail')!;
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

  const apply = () => {
    const term = norm(q.value);
    table.querySelectorAll<HTMLElement>('.el').forEach((el) => {
      const e = elementById.get(Number(el.dataset.z))!;
      const hit = !term || [e.name_ko, e.symbol, e.name_en, String(e.id), ...e.aliases_ko].some((x) => norm(x) === term || (term.length > 1 && norm(x).startsWith(term)));
      el.classList.toggle('dim', (cat !== 'all' && el.dataset.cat !== cat) || !hit);
      el.classList.toggle('hit', !!term && hit);
    });
  };
  main.querySelector('.cats')!.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-cat]');
    if (!b) return;
    cat = b.dataset.cat!;
    main.querySelectorAll('.cats [data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    apply();
  });
  q.addEventListener('input', apply);
  q.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const first = table.querySelector<HTMLElement>('.el.hit');
    if (first) open(Number(first.dataset.z));
  });

  const open = (z: number, push = true) => {
    const e = elementById.get(z);
    if (!e) return;
    dlg.innerHTML = detailHtml(e);
    if (push && new URL(location.href).searchParams.get('z') !== String(z)) history.pushState(null, '', `/element/table?z=${z}`);
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  };
  table.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('.el');
    if (b) open(Number(b.dataset.z));
  });
  dlg.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t === dlg || t.closest('[data-close]')) dlg.close();
    if (t.closest('a[data-link]')) dlg.close();
  });
  dlg.addEventListener('close', () => { if (location.search.includes('z=')) history.replaceState(null, '', '/element/table'); });
  if (openZ) open(openZ, false);
  return () => { if (dlg.open) dlg.close(); };
}

