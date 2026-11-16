import { lineById, lineStations, modeById, stopView, visibleLines, type Line, type Service, type StopId, type StopView } from '../data';
import { Run } from '../engine/run';
import type { Judgement } from '../engine/types';
import { lineMap } from '../map';
import { tweenViewBox } from '../map/organ';
import { addMisses, bestOf, saveRun } from '../store';
import { drawCard } from './card';
import { esc, icon, lineColor, navigate, pct, recTime } from './util';

export function renderPlay(app: HTMLElement, svc: Service, lineId: string, modeId: string, params: URLSearchParams): () => void {
  const line = lineById(lineId);
  const mode = modeById(modeId);
  if (!line || line.service_id !== svc.id || !mode || !svc.modes.includes(modeId) || (line.status !== 'open' && params.get('preview') !== '1')) {
    navigate('/' + svc.id, true);
    return () => {};
  }
  // 틀린 역만 다시 달리기: ?only=11,12 (기록은 최고 기록에 넣지 않는다)
  const asked = (params.get('only') ?? '').split(',');
  const only = line.station_ids.filter((id) => asked.includes(String(id)));
  const retry = only.length > 0;
  // routeStops = 노선 순서 (지도·결과 카드), stops = 실제로 달리는 순서 (번호 쓰기는 섞임)
  const routeIds = retry ? only : line.station_ids;
  const routeStops = routeIds.map((id) => stopView(line, id));
  const run = new Run(lineStations(line, routeIds), mode, svc.fields);
  const stops = run.stations.map((s) => stopView(line, s.id));
  const organ = !svc.fields.symbol; // 기호가 없는 서비스: 설명 문장을 보고 이름을 쓴다
  const best = retry ? null : bestOf(line.id, mode.id);
  const color = lineColor(line.color);
  const title = retry ? `${line.name} · 틀린 역` : line.name;
  const first = routeStops[0], last = routeStops[routeStops.length - 1];

  app.innerHTML = `<div class="play" style="--line:${color}">
    <header class="topbar">
      <a class="icon-btn" href="/${svc.id}" data-link aria-label="나가기">${icon.close}</a>
      <div class="grow"><span class="dot" style="background:${color}"></span><span class="label">${esc(title)}</span><span class="caption sub">· ${esc(mode.label)}</span></div>
      <span class="caption-strong sub num" id="count"></span>
    </header>
    <div class="progress" id="progress" aria-hidden="true"></div>
    <section class="stage" aria-label="노선도">
      <div class="sign"><span class="dot"></span><span class="label">${esc(line.name)}</span><i></i>
        <span style="display:flex;flex-direction:column;line-height:1.3"><span class="caption" style="opacity:.7">${esc(first.s || first.k)} → ${esc(last.s || last.k)} 방면</span><span class="title-s" id="remain"></span></span></div>
      <div id="map" style="width:100%"></div>
    </section>
    <section class="platform" id="platform">
      <div class="clock">${icon.timer}<b class="num" id="clock">00:00.00</b><i></i><span class="caption sub num">${best ? `최고 ${recTime(best.duration_ms)}` : '첫 도전'}</span></div>
      <div class="dock" id="dock">
        <div id="prev" class="side prev"></div>
        <div class="cur" id="cur">
          <span class="n num" style="order:0"></span><span class="s" style="order:1"></span><span class="d" style="order:1" hidden></span>
          <span class="slot" id="slot"><span class="ghost" id="ghost" aria-hidden="true"></span><input id="answer" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="정답 입력" /></span>
          <span class="k" style="order:3"></span>
        </div>
        <div id="next" class="side next"></div>
      </div>
      <div class="echo" id="echo" aria-live="polite"></div>
      <div class="helper"><span class="caption sub" id="what"></span><span class="hint" id="hint" hidden></span>
        <button class="btn md" id="skip" style="background:var(--bg)">모르겠어요 · Esc</button></div>
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
      <div class="countdown" id="countdown" aria-live="assertive"><b id="cd"></b></div>
    </section>
  </div>`;

  const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>('#' + id)!;
  const input = $<HTMLInputElement>('answer');
  const cur = $('cur');
  const toast = $('toast');
  let composing = false;
  let pendingSubmit = false;
  let finished = false;

  // 연습 모드: 정답을 가운데에 연하게 깔고, 친 글자는 그 앞부분에 진하게 겹쳐 그린다.
  // (입력창 글자는 투명. 가운데 정렬이어도 친 글자와 연한 글씨가 어긋나지 않게)
  let traceAnswer = '';
  function drawTrace() {
    const g = $('ghost');
    if (!traceAnswer) { g.innerHTML = ''; return; }
    const typed = [...input.value];
    const want = [...traceAnswer];
    const rest = want.slice(typed.length).join('');
    // 정답과 다른 글자는 빨갛게. 조합 중인 마지막 글자는 아직 판단하지 않는다
    const chars = typed.map((ch, i) => {
      const bad = ch !== want[i] && !(composing && i === typed.length - 1);
      return bad ? `<span class="bad">${esc(ch)}</span>` : esc(ch);
    }).join('');
    g.innerHTML = `<span class="typed">${chars}</span><i class="caret"></i><span class="rest">${esc(rest)}</span>`;
  }

  const missedSoFar = () => new Set(stops.filter((_, i) => i < run.index && !run.firstTry(i)).map((s) => s.id));

  const tile = (e: StopView, cls: string, showAll: boolean) => tileHtml(e, cls, showAll);

  function drawStation() {
    const i = run.index;
    const n = stops.length;
    $('count').textContent = `${Math.min(i + 1, n)} / ${n}`;
    $('remain').textContent = i >= n - 1 ? '이번 역이 종착역' : `종착역까지 ${n - 1 - i}역`;
    $('progress').innerHTML = stops.map((_, k) => `<i class="${k < i ? (run.firstTry(k) ? 'pass' : 'miss') : k === i ? 'now' : ''}"></i>`).join('');
    const label = `${line!.name} 노선도, ${i + 1}번째 역`;
    drawMap(i, label);
    const dist = (d: number) => `d${d}${d === 2 ? ' far' : d === 3 ? ' farther' : ''}`;
    $('prev').innerHTML = [1, 2, 3].filter((d) => i - d >= 0).map((d) => tile(stops[i - d], `${dist(d)}${run.firstTry(i - d) ? '' : ' missed'}`, true)).join('');
    $('next').innerHTML = [1, 2, 3].filter((d) => i + d < n).map((d) => tile(stops[i + d], `next ${dist(d)}`, false)).join('');

    const e = stops[i];
    const prompt = run.prompt;
    const keys = run.answerKeys;
    cur.style.setProperty('--cat', e.tint);
    const nEl = cur.querySelector<HTMLElement>('.n')!, sEl = cur.querySelector<HTMLElement>('.s')!, kEl = cur.querySelector<HTMLElement>('.k')!, dEl = cur.querySelector<HTMLElement>('.d')!;
    const slot = keys[0];
    const slotEl = $('slot');
    if (organ) {
      // Organism: 순서 + 하는 일(순서 쓰기 모드에서는 숨김) + 이름 입력칸
      cur.classList.add('organ');
      nEl.textContent = `${e.n}번째 역`;
      sEl.hidden = true; kEl.hidden = true; dEl.hidden = false;
      // 분자는 모형 그림이 지도 자리에 크게 나온다 (map/molecule.ts)
      dEl.textContent = prompt === 'desc' ? e.desc ?? '' : prompt === 'model' ? '이 분자의 이름은?' : '다음 역은?';
      dEl.classList.toggle('q', prompt !== 'desc');
      slotEl.style.order = '3';
      input.className = 'mid';
      slotEl.className = `slot mid${mode!.ghost ? ' trace' : ''}`;
      traceAnswer = mode!.ghost ? e.k : '';
      drawTrace();
      input.placeholder = '이름으로';
      $('what').textContent = prompt === 'desc' ? '이름 · Enter로 제출' : prompt === 'model' ? '모형을 보고 분자 이름 · Enter로 제출' : '노선도에서 다음 역 이름 · Enter';
      $('hint').hidden = true;
      cur.classList.remove('ok');
      return;
    }
    nEl.textContent = e.n;
    // 묻는 칸 = 입력창, 보여 주는 칸 = 글자, 나머지 = '?'
    const show = (key: 'symbol' | 'name', el: HTMLElement, text: string) => {
      el.hidden = key === slot;
      const hidden = key !== prompt && (keys.includes(key) || prompt === 'number');
      el.classList.toggle('q', hidden);
      el.textContent = hidden ? '?' : text;
    };
    show('symbol', sEl, e.s);
    show('name', kEl, e.k);
    slotEl.style.order = slot === 'symbol' ? '1' : '3';
    input.className = slot === 'symbol' && keys.length === 1 ? 'big' : 'mid';
    // 연습 모드: 정답을 연한 글씨로 깔아 두고 따라 쓴다
    slotEl.className = `slot ${input.className}${mode!.ghost ? ' trace' : ''}`;
    traceAnswer = mode!.ghost ? (slot === 'symbol' ? e.s : e.k) : '';
    drawTrace();
    const kind = run.inputKind;
    const what = kind === 'auto' ? '기호 또는 이름' : slot === 'symbol' ? '기호' : '이름';
    input.placeholder = kind === 'auto' ? what : slot === 'symbol' ? '기호로' : '이름으로';
    $('what').textContent = kind === 'instant' ? '기호 · 완성되면 바로 다음 역' : `${what} · Enter로 제출`;
    $('hint').hidden = true;
    cur.classList.remove('ok');
  }

  function showToast(text: string, tone: 'good' | 'bad' | '' = '') {
    toast.textContent = text;
    toast.className = `toast ${tone}`;
    toast.hidden = !text;
  }

  // 한 글자 기호처럼 바로 넘어가도 방금 친 글자가 보이게 (운영자 요청)
  let echoTimer = 0;
  function echo(typed: string, ok: boolean) {
    const el = $('echo');
    el.innerHTML = `<span class="${ok ? 'good' : 'bad'}">${ok ? '✓' : '✕'} <b>${esc(typed.trim())}</b></span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(echoTimer);
    echoTimer = window.setTimeout(() => el.classList.remove('show'), 1600);
  }

  function after(j: Judgement) {
    if (j.kind === 'wait') return;
    echo(input.value, j.kind === 'correct');
    if (j.kind === 'wrong') {
      input.value = ''; drawTrace();
      cur.classList.remove('shake'); void cur.offsetWidth; cur.classList.add('shake');
      if (j.hint) { const h = $('hint'); h.textContent = `힌트: ${j.hint}`; h.hidden = false; }
      return;
    }
    input.value = '';
    if (j.viaAlias) showToast(`✓ '${j.viaAlias}'도 정답! 화면에는 '${j.shown}'(으)로 보여 줘요.`, 'good');
    else showToast('');
    if (j.finished) finish(); else { drawStation(); $('prev').firstElementChild?.classList.add('just'); }
  }

  // 3 · 2 · 1 · 출발! 전에는 입력을 받지 않는다 (운영자 요청: 시계는 '출발!'부터)
  let ready = false;

  // 몸 지도: 카운트다운 동안은 노선 전체, '출발!'부터 이번 역으로 확대하고 역이 바뀌면 카메라가 따라간다
  let prevView: string | null = null;
  function drawMap(i: number, label: string) {
    const zoom = ready;
    $('map').innerHTML = mode!.shuffle
      ? lineMap(line!, { ids: routeIds, currentId: stops[i].id, passed: new Set(stops.slice(0, i).map((s) => s.id)), missed: missedSoFar(), label, zoom })
      : lineMap(line!, { ids: routeIds, index: i, missed: missedSoFar(), label, zoom });
    const svg = $('map').querySelector<SVGSVGElement>('svg.omap');
    if (!svg) return;
    const view = svg.getAttribute('viewBox');
    if (prevView) tweenViewBox(svg, prevView, zoom && i === 0 ? 900 : 480);
    prevView = view;
  }
  const onInput = () => {
    if (!ready) { if (!composing) input.value = ''; return; }
    if (!composing && !finished) after(run.type(input.value));
  };
  const submit = () => { if (ready && !finished) after(run.submit(input.value)); };
  const skip = () => {
    if (!ready || finished) return;
    const e = stops[run.index];
    const r = run.skip();
    input.value = ''; drawTrace();
    showToast(organ ? `정답은 ${e.k}` : `정답은 ${e.s} · ${e.k} (${r.reveal.join(' / ')})`, 'bad');
    if (r.finished) finish(); else drawStation();
  };

  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => {
    composing = false;
    drawTrace();
    // 조합 중 Enter를 눌렀으면 조합이 끝난 뒤 마지막 글자까지 제출 (PRD 6-3 입력 4)
    if (pendingSubmit) { pendingSubmit = false; setTimeout(submit, 0); } else onInput();
  });
  input.addEventListener('input', onInput);
  input.addEventListener('input', drawTrace); // 한글 조합 중에도 따라 쓰기 글씨를 갱신
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); skip(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.isComposing || e.keyCode === 229) pendingSubmit = true; else submit();
  });
  $('skip').addEventListener('click', () => { skip(); input.focus(); });
  $('platform').addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) input.focus(); });

  // 1/100초까지 보이게 30ms마다 그린다 (rAF는 브라우저가 묶어 둘 때가 있어 타이머로)
  const timer = window.setInterval(() => {
    if (run.startedAt !== null && !finished) $('clock').textContent = recTime(Date.now() - run.startedAt);
  }, 30);

  function finish() {
    finished = true;
    clearInterval(timer);
    const res = run.result();
    addMisses(res.missed_station_ids);
    const saved = retry ? null : saveRun(line!.id, mode!.id, res);
    renderResult(app, { svc, line: line!, modeLabel: mode!.label, modeId: mode!.id, stops: routeStops, res, saved, retry });
  }

  drawStation();
  input.focus(); // 키보드는 카운트다운 동안 미리 올라와 있게
  const cdTimers: number[] = [];
  const cdBox = $('countdown'), cd = $('cd');
  ['3', '2', '1', '출발!'].forEach((t, i) => cdTimers.push(window.setTimeout(() => {
    cd.textContent = t;
    cd.classList.toggle('go', i === 3);
    cd.classList.remove('tick'); void cd.offsetWidth; cd.classList.add('tick');
    if (i === 3) {
      ready = true;
      input.value = ''; drawTrace();
      drawMap(run.index, `${line!.name} 노선도, ${run.index + 1}번째 역`);
      run.start();
      input.focus();
      cdTimers.push(window.setTimeout(() => cdBox.classList.add('done'), 600));
    }
  }, i * 800)));
  return () => { clearInterval(timer); cdTimers.forEach(clearTimeout); };
}

interface ResultCtx {
  svc: Service; line: Line; modeLabel: string; modeId: string; stops: StopView[]; retry: boolean;
  res: ReturnType<Run['result']>; saved: ReturnType<typeof saveRun> | null;
}

function renderResult(app: HTMLElement, c: ResultCtx) {
  const { line, res } = c;
  const color = lineColor(line.color);
  const last = c.stops[c.stops.length - 1];
  const missed = res.missed_station_ids.map((id) => stopView(line, id as StopId));
  const perfect = !missed.length;
  const stamps = [
    { got: true, label: '완주', ic: icon.flag },
    { got: res.accuracy >= 0.9, label: '정확도 90%', ic: icon.target },
    { got: perfect, label: '무오답', ic: icon.shield },
  ];
  const lines = visibleLines(line.service_id);
  const next = lines[(lines.findIndex((l) => l.id === line.id) + 1) % lines.length];
  const url = `${location.origin}/${c.svc.id}/${line.id}?mode=${c.modeId}`;
  let recNote = '';
  if (c.saved?.isBest) recNote = c.saved.prev ? `<span class="newrec">신기록 −${recTime(c.saved.prev.duration_ms - res.duration_ms)}</span>` : '<span class="newrec">첫 기록</span>';
  else if (c.saved?.prev) recNote = `<span class="caption sub num">최고 ${recTime(c.saved.prev.duration_ms)}</span>`;
  else if (c.retry) recNote = '<span class="caption sub">복습 판 · 최고 기록에 넣지 않아요</span>';

  app.innerHTML = `<div class="result" style="--line:${color}">
    <div class="arrive" role="status">종착역 도착 · ${esc(line.name)}${c.retry ? ' (틀린 역)' : ''} · ${esc(c.modeLabel)}</div>
    <div class="cur${last.s ? '' : ' organ'}" style="--cat:${last.tint};border-color:var(--line);box-shadow:none"><span class="n num">${last.n}</span>${last.s ? `<span class="s">${esc(last.s)}</span>` : ''}<span class="k">${esc(last.k)}</span>${last.desc ? `<span class="d">${esc(last.desc)}</span>` : ''}${last.img ? `<img class="mol" src="${last.img}" alt=""/>` : ''}</div>
    <div class="stats">
      <div><span class="caption sub">시간</span><span class="title-m num">${recTime(res.duration_ms)}</span>${recNote}</div>
      <div><span class="caption sub">정확도</span><span class="title-m num">${pct(res.accuracy)}</span><span class="caption sub num">${res.first_try_correct} / ${res.total_stations}역 한 번에</span></div>
      <div><span class="caption sub">평균 타수</span><span class="title-m num">${res.cpm}<span class="caption sub"> 타/분</span></span></div>
    </div>
    <div class="stamps" aria-label="도장">${stamps.map((s, i) => `${i ? `<span class="bar ${s.got ? 'got' : ''}"></span>` : ''}<span class="st ${s.got ? 'got' : ''}"><span class="ring">${s.ic}</span>${s.label}</span>`).join('')}</div>
    <section class="review">
      ${perfect ? '<p class="label" style="text-align:center;margin:0">한 번도 틀리지 않고 종착역까지 왔어요.</p>'
        : `<div class="label">다시 볼 역 ${missed.length}</div><div class="tiles">${missed.map((e) => tileHtml(e, 'missed', true, true)).join('')}</div>`}
    </section>
    <div class="actions">
      <button class="btn primary wide" data-act="again">다시 달리기</button>
      ${perfect ? '' : `<button class="btn wide" data-act="retry">틀린 역만 다시 달리기 (${missed.length})</button>`}
      <button class="btn" data-act="copy">기록 복사</button>
      <button class="btn" data-act="card">카드 저장</button>
      <a class="btn" href="/${c.svc.id}/${next.id}" data-link>다음 노선 · ${esc(next.name)}</a>
      <a class="btn" href="/${c.svc.id}" data-link>노선 고르기</a>
    </div>
    <div class="toast" id="rtoast" role="status" aria-live="polite" hidden></div>
  </div>`;

  const say = (t: string) => { const el = app.querySelector<HTMLElement>('#rtoast')!; el.textContent = t; el.hidden = false; };
  app.querySelector('.actions')!.addEventListener('click', async (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'again') navigate(`/${c.svc.id}/${line.id}?mode=${c.modeId}`, true);
    if (act === 'retry') navigate(`/${c.svc.id}/${line.id}?mode=${c.modeId}&only=${missed.map((m) => m.id).join(',')}`);
    if (act === 'copy') {
      const text = `${c.svc.name} ${line.name} · ${c.modeLabel}\n${res.total_stations}역 ${recTime(res.duration_ms)} · 정확도 ${pct(res.accuracy)}\n${url}\n#사이음 #${c.svc.name}`;
      try { await navigator.clipboard.writeText(text); say('기록을 복사했어요.'); }
      catch { say('복사가 막혀 있어요. 길게 눌러 직접 복사해 주세요: ' + text); }
    }
    if (act === 'card') {
      const blob = await drawCard({ svc: c.svc, line, modeLabel: c.modeLabel, stops: c.stops, res, missed: new Set(missed.map((m) => m.id)) });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${c.svc.id}-metro-${line.id}-${c.modeId}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      say('결과 카드(1080×1920)를 저장했어요.');
    }
  });
}

/** 역 칸. 기호가 없는 역(기관·분자)은 이름을 크게, 다시 볼 역에서는 하는 일·모형 그림도 */
export function tileHtml(e: StopView, cls: string, showAll: boolean, withDesc = false) {
  if (!e.s) return `<div class="tile organ ${cls}" style="--cat:${e.tint}">${e.n ? `<span class="n num">${e.n}</span>` : ''}<span class="k">${showAll ? esc(e.k) : '?'}</span>${withDesc && e.desc ? `<span class="dd">${esc(e.desc)}</span>` : ''}${withDesc && e.img ? `<img class="mol" src="${e.img}" alt=""/>` : ''}</div>`;
  return `<div class="tile ${cls}" style="--cat:${e.tint}"><span class="n num">${e.n}</span><span class="s">${showAll ? esc(e.s) : '?'}</span><span class="k">${showAll ? esc(e.k) : '?'}</span></div>`;
}
