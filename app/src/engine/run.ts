import { exactCi, matchInstant, matchSubmit, normalize, startsHangul, startsLatin } from './matcher';
import type { FieldSpec, Judgement, ModeSpec, RunResult, Station } from './types';

/** 역마다 보여 줄 칸을 고른다. 같은 칸이 max_run 넘게 이어지지 않게, 덜 나온 칸을 먼저. */
export function planPrompts(count: number, mode: ModeSpec, rng: () => number = Math.random): string[] {
  const max = mode.max_run ?? Infinity;
  const used: Record<string, number> = Object.fromEntries(mode.prompts.map((p) => [p, 0]));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const last = out.slice(-max);
    let allowed = mode.prompts.filter((p) => !(last.length === max && last.every((x) => x === p)));
    if (!allowed.length) allowed = mode.prompts;
    const least = Math.min(...allowed.map((p) => used[p]));
    // 덜 나온 칸에 가중치 (골고루), 그래도 무작위
    const pool = allowed.flatMap((p) => (used[p] === least ? [p, p] : [p]));
    const pick = pool[Math.floor(rng() * pool.length)];
    used[pick]++;
    out.push(pick);
  }
  return out;
}

/** Fisher–Yates. 원본은 건드리지 않는다. */
export function shuffle<T>(list: T[], rng: () => number = Math.random): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Run {
  readonly prompts: string[];
  index = 0;
  startedAt: number | null = null;
  finishedAt: number | null = null;
  readonly wrongs: number[];
  readonly skipped: boolean[];
  /** 달리는 순서. mode.shuffle이면 섞인 순서 */
  readonly stations: Station[];

  constructor(
    stations: Station[],
    readonly mode: ModeSpec,
    readonly fields: Record<string, FieldSpec>,
    rng: () => number = Math.random,
    private now: () => number = () => Date.now(),
  ) {
    this.stations = mode.shuffle ? shuffle(stations, rng) : stations;
    this.prompts = planPrompts(stations.length, mode, rng);
    this.wrongs = stations.map(() => 0);
    this.skipped = stations.map(() => false);
  }

  get finished() { return this.index >= this.stations.length; }
  get station() { return this.stations[this.index]; }
  get prompt() { return this.prompts[this.index]; }
  get answerKeys(): string[] { return this.mode.answers[this.prompt] ?? []; }

  /** 이번 역의 입력 방식. 답이 둘 이상이면 'auto' (첫 글자로 판단). */
  get inputKind(): 'instant' | 'submit' | 'auto' {
    const keys = this.answerKeys;
    return keys.length > 1 ? 'auto' : (this.fields[keys[0]]?.input ?? 'submit');
  }

  /** 답이 여럿이면 첫 글자로 어느 칸인지 고른다. */
  private pickKey(text: string): string | null {
    const keys = this.answerKeys;
    if (keys.length === 1) return keys[0];
    const want = startsLatin(text) ? 'latin_ci' : startsHangul(text) ? 'ko_text' : null;
    return keys.find((k) => this.fields[k]?.matcher === want) ?? null;
  }

  /** 시계 시작. 플레이 화면이 카운트다운 "출발!" 때 부른다. 입력이 먼저 오면 그때 시작. */
  start() { if (this.startedAt === null) this.startedAt = this.now(); }

  /** 글자가 바뀔 때마다 (한글 조합 중에는 부르지 않는다). 즉시 이동 칸만 여기서 판정. */
  type(text: string): Judgement {
    if (this.finished || !normalize(text)) return { kind: 'wait' };
    this.start();
    const key = this.pickKey(text);
    if (!key || this.fields[key]?.input !== 'instant') return { kind: 'wait' };
    const r = matchInstant(text, this.station.fields[key]);
    if (r === 'correct') return this.correct(key, null);
    return r === 'wrong' ? this.wrong() : { kind: 'wait' };
  }

  /** Enter. 조합이 끝난 글자 전체를 받는다. */
  submit(text: string): Judgement {
    if (this.finished || !normalize(text)) return { kind: 'wait' };
    this.start();
    const key = this.pickKey(text) ?? this.answerKeys[0];
    const spec = this.fields[key];
    const shown = this.station.fields[key];
    if (spec?.matcher === 'latin_ci') return exactCi(text, shown) ? this.correct(key, null) : this.wrong();
    const r = matchSubmit(text, shown, this.station.aliases[key]);
    return r.ok ? this.correct(key, r.viaAlias) : this.wrong();
  }

  /** '모르겠어요' / Esc: 정답을 보여 주고 넘어간다. 틀린 역으로 기록. */
  skip(): { reveal: string[]; finished: boolean } {
    this.start();
    const reveal = this.answerKeys.map((k) => this.station.fields[k]);
    this.skipped[this.index] = true;
    this.advance();
    return { reveal, finished: this.finished };
  }

  hint(): string | null {
    if (this.finished || this.wrongs[this.index] < 2) return null;
    const ans = this.station.fields[this.answerKeys[0]] ?? '';
    return ans ? ans[0] + '○'.repeat(Math.max(1, ans.length - 1)) : null;
  }

  private correct(key: string, viaAlias: string | null): Judgement {
    const shown = this.station.fields[key];
    this.advance();
    return { kind: 'correct', key, shown, viaAlias, finished: this.finished };
  }

  private wrong(): Judgement {
    this.wrongs[this.index]++;
    return { kind: 'wrong', hint: this.hint() };
  }

  private advance() {
    this.index++;
    if (this.finished) this.finishedAt = this.now();
  }

  /** 이 역을 한 번에 맞혔는가 (지난 역만 의미 있음). */
  firstTry(i: number) { return this.wrongs[i] === 0 && !this.skipped[i]; }

  result(): RunResult {
    const total = this.stations.length;
    const first = this.stations.filter((_, i) => this.firstTry(i)).length;
    const duration = Math.max(1, (this.finishedAt ?? this.now()) - (this.startedAt ?? this.now()));
    return {
      duration_ms: duration,
      first_try_correct: first,
      total_stations: total,
      missed_station_ids: this.stations.filter((_, i) => !this.firstTry(i)).map((s) => s.id),
      accuracy: first / total,
      per_minute: total / (duration / 60000),
    };
  }
}

/** 기록 비교: 시간이 짧을수록, 같으면 정확도가 높을수록 좋다. */
export function isBetter(a: { duration_ms: number; accuracy: number }, b?: { duration_ms: number; accuracy: number } | null) {
  if (!b) return true;
  return a.duration_ms < b.duration_ms || (a.duration_ms === b.duration_ms && a.accuracy > b.accuracy);
}
