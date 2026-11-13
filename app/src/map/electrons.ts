// Element_Metro 지도 모듈: 전자 배치 (쌓음 원리 + 바닥상태 예외). 104번 이후는 예측값.

export interface Sub { n: number; l: 's' | 'p' | 'd' | 'f'; e: number }

const ORDER = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'];
const CAP = { s: 2, p: 6, d: 10, f: 14 } as const;
const L_ORDER = 'spdf';
const NOBLE: Array<[number, string]> = [[86, 'Rn'], [54, 'Xe'], [36, 'Kr'], [18, 'Ar'], [10, 'Ne'], [2, 'He']];

/** 바닥상태가 쌓음 원리와 다른 원소: 비활성 기체 뒤 부분 */
const EXCEPT: Record<number, string> = {
  24: '3d5 4s1', 29: '3d10 4s1', 41: '4d4 5s1', 42: '4d5 5s1', 44: '4d7 5s1', 45: '4d8 5s1', 46: '4d10', 47: '4d10 5s1',
  57: '5d1 6s2', 58: '4f1 5d1 6s2', 64: '4f7 5d1 6s2', 78: '4f14 5d9 6s1', 79: '4f14 5d10 6s1',
  89: '6d1 7s2', 90: '6d2 7s2', 91: '5f2 6d1 7s2', 92: '5f3 6d1 7s2', 93: '5f4 6d1 7s2', 96: '5f7 6d1 7s2', 103: '5f14 7s2 7p1',
};

const parse = (s: string): Sub[] => s.split(' ').map((t) => ({ n: Number(t[0]), l: t[1] as Sub['l'], e: Number(t.slice(2)) }));
const sortSubs = (a: Sub[]) => a.slice().sort((x, y) => x.n - y.n || L_ORDER.indexOf(x.l) - L_ORDER.indexOf(y.l));

function aufbau(z: number): Sub[] {
  const out: Sub[] = [];
  let left = z;
  for (const o of ORDER) {
    if (left <= 0) break;
    const l = o[1] as Sub['l'];
    const e = Math.min(CAP[l], left);
    out.push({ n: Number(o[0]), l, e });
    left -= e;
  }
  return out;
}

export function configuration(z: number): { full: Sub[]; core: string | null; valence: Sub[] } {
  const noble = NOBLE.find(([nz]) => nz < z) ?? null;
  const coreSubs = noble ? aufbau(noble[0]) : [];
  const valence = EXCEPT[z] ? parse(EXCEPT[z]) : aufbau(z).slice(coreSubs.length);
  return { full: sortSubs([...coreSubs, ...valence]), core: noble ? noble[1] : null, valence: sortSubs(valence) };
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = (n: number) => String(n).split('').map((d) => SUP[Number(d)]).join('');
export const subText = (subs: Sub[]) => subs.map((s) => `${s.n}${s.l}${sup(s.e)}`).join(' ');

/** 껍질(n)별 전자 수 — 보어 모형 */
export function shells(z: number): number[] {
  const out: number[] = [];
  for (const s of configuration(z).full) out[s.n - 1] = (out[s.n - 1] ?? 0) + s.e;
  return Array.from(out, (x) => x ?? 0);
}

/** 오비탈 상자: 훈트 규칙대로 ↑ 먼저 채우고 ↓ */
export function boxes(s: Sub): string[] {
  const k = CAP[s.l] / 2;
  return Array.from({ length: k }, (_, i) => (s.e > i ? '↑' : '') + (s.e > k + i ? '↓' : ''));
}
