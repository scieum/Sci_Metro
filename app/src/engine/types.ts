// 게임 엔진은 문제 내용을 모른다. 아는 것: 역마다 보여 줄 칸, 인정할 정답, 입력 방식, 판정 방식.

export type Matcher = 'latin_ci' | 'ko_text';
export type InputKind = 'instant' | 'submit';

export interface FieldSpec {
  label: string;
  matcher?: Matcher;
  input?: InputKind;
}

export interface Station {
  id: number | string;
  /** 칸 이름 → 표시 값 (예: { number: '9', code: 'F', name: '...' }) */
  fields: Record<string, string>;
  /** 칸 이름 → 정답으로 인정하는 다른 표기 */
  aliases: Record<string, string[]>;
}

export interface ModeSpec {
  id: string;
  label: string;
  level: number;
  desc?: string;
  prompts: string[];
  answers: Record<string, string[]>;
  max_run?: number;
  /** 연습: 정답을 연하게 깔아 두고 따라 쓰게 한다 */
  ghost?: boolean;
  /** 역 순서를 섞어서 낸다 */
  shuffle?: boolean;
}

export type Judgement =
  | { kind: 'wait' }
  | { kind: 'wrong'; hint: string | null }
  | { kind: 'correct'; key: string; shown: string; viaAlias: string | null; finished: boolean };

export interface RunResult {
  duration_ms: number;
  first_try_correct: number;
  total_stations: number;
  missed_station_ids: Array<number | string>;
  accuracy: number;
  per_minute: number;
}
