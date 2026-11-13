// 판정 함수. 화면과 분리해 단위 테스트한다 (PRD 13장 기술).

export const normalize = (s: string) => s.replace(/\s+/g, '');

export const startsLatin = (s: string) => /^[A-Za-z]/.test(normalize(s));
export const startsHangul = (s: string) => /^[ᄀ-ᇿㄱ-ㆎ가-힣]/.test(normalize(s));

/** latin_ci: 대소문자 무시. 정답 앞부분과 같으면 기다리고, 어긋나는 순간 오답. */
export function matchInstant(input: string, answer: string): 'wait' | 'correct' | 'wrong' {
  const a = normalize(input).toLowerCase();
  const b = normalize(answer).toLowerCase();
  if (!a) return 'wait';
  if (a === b) return 'correct';
  return b.startsWith(a) ? 'wait' : 'wrong';
}

/** ko_text: 공백 무시, 별칭 허용. 맞으면 별칭으로 맞혔는지도 돌려준다. */
export function matchSubmit(input: string, shown: string, aliases: string[] = []): { ok: boolean; viaAlias: string | null } {
  const a = normalize(input);
  if (!a) return { ok: false, viaAlias: null };
  if (a === normalize(shown)) return { ok: true, viaAlias: null };
  const hit = aliases.find((x) => normalize(x) === a);
  return hit ? { ok: true, viaAlias: hit } : { ok: false, viaAlias: null };
}

/** latin_ci 칸을 Enter로 낸 경우: 완전히 같아야 정답. */
export const exactCi = (input: string, answer: string) => normalize(input).toLowerCase() === normalize(answer).toLowerCase();
