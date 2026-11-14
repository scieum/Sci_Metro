import { describe, expect, it } from 'vitest';
import { matchInstant, matchSubmit, strokes } from '../src/engine/matcher';
import { Run, isBetter, planPrompts } from '../src/engine/run';
import { elementById, lineById, lineStations, modeById, services, toStation, visibleLines } from '../src/data';
import { typingSteps } from '../src/ui/lines';
import { boxes, configuration, shells, subText } from '../src/map/electrons';
import { checkData } from '../scripts/check-data.mjs';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const fields = services[0].fields;
// 엔진의 즉시 이동 기능 자체는 남아 있다 (지금 Element_Metro 데이터는 기호도 Enter 제출)
const instant = { ...fields, symbol: { ...fields.symbol, input: 'instant' as const } };
const one = (...ids: number[]) => ids.map((id) => toStation(elementById.get(id)!));
const fixed = (seq: number[]) => { let i = 0; return () => seq[i++ % seq.length]; };
let t = 0; const clock = () => (t += 1000);

describe('matcher', () => {
  it('latin_ci: 대소문자 무시, 앞부분이면 대기, 어긋나면 오답', () => {
    expect(matchInstant('fe', 'Fe')).toBe('correct');
    expect(matchInstant('FE', 'Fe')).toBe('correct');
    expect(matchInstant('F', 'Fe')).toBe('wait');
    expect(matchInstant('Fa', 'Fe')).toBe('wrong');
    expect(matchInstant(' f e ', 'Fe')).toBe('correct');
  });
  it('ko_text: 공백 무시 + 별칭', () => {
    expect(matchSubmit('플루 오린', '플루오린', ['불소'])).toEqual({ ok: true, viaAlias: null });
    expect(matchSubmit('불소', '플루오린', ['불소'])).toEqual({ ok: true, viaAlias: '불소' });
    expect(matchSubmit('플루오', '플루오린', ['불소']).ok).toBe(false);
  });
});

describe('운영자 결정: Enter 전에는 제출이 아니다', () => {
  it('기호도 치는 도중에는 판정하지 않고 Enter로 낸다', () => {
    const r = new Run(one(26, 27), modeById('symbol')!, fields);
    expect(r.inputKind).toBe('submit');
    expect(r.type('fe').kind).toBe('wait');
    expect(r.type('fa').kind).toBe('wait');
    expect(r.index).toBe(0);
    expect(r.submit('fa').kind).toBe('wrong');
    expect(r.submit('FE').kind).toBe('correct');
    expect(r.index).toBe(1);
  });
  it('완전 혼합 9: F + Enter, 플루오린 + Enter 모두 정답', () => {
    const onlyNumber = { ...modeById('master')!, prompts: ['number'] };
    expect(new Run(one(9), onlyNumber, fields).submit('f').kind).toBe('correct');
    expect(new Run(one(9), onlyNumber, fields).submit('플루오린').kind).toBe('correct');
  });
});

describe('엔진 즉시 이동 (instant 칸)', () => {
  it('기호 쓰기: fe → Enter 없이 다음 역', () => {
    const r = new Run(one(26, 27), modeById('symbol')!, instant);
    expect(r.type('f').kind).toBe('wait');
    expect(r.type('fe').kind).toBe('correct');
    expect(r.index).toBe(1);
  });
  it('Fe 역에서 F만 = 오답 아님, Fa = 오답', () => {
    const r = new Run(one(26), modeById('symbol')!, instant);
    expect(r.type('F').kind).toBe('wait');
    expect(r.type('Fa').kind).toBe('wrong');
  });
  it('이름 쓰기: 플루오린 + Enter 한 번', () => {
    const r = new Run(one(9), modeById('name')!, fields);
    expect(r.type('플루오린').kind).toBe('wait');
    const j = r.submit('플루오린');
    expect(j.kind).toBe('correct');
    expect(r.finished).toBe(true);
  });
  it("Na: '소듐'(대한화학회 표기)도 정답, 화면에는 '나트륨'", () => {
    const r = new Run(one(11), modeById('name')!, fields);
    const j = r.submit('소듐');
    expect(j).toMatchObject({ kind: 'correct', shown: '나트륨', viaAlias: '소듐' });
  });
  it("완전 혼합 '9' → F와 플루오린 모두 정답", () => {
    const master = modeById('master')!;
    const onlyNumber = { ...master, prompts: ['number'] };
    const a = new Run(one(9), onlyNumber, instant);
    expect(a.inputKind).toBe('auto');
    expect(a.type('F').kind).toBe('correct');
    const b = new Run(one(9), onlyNumber, fields);
    expect(b.type('플루오린').kind).toBe('wait');
    expect(b.submit('플루오린').kind).toBe('correct');
  });
  it('혼합: F를 보고 F → 오답', () => {
    const mixed = { ...modeById('mixed')!, prompts: ['symbol'] };
    const r = new Run(one(9), mixed, fields);
    expect(r.type('F').kind).toBe('wait');
    expect(r.submit('F').kind).toBe('wrong');
  });
  it('2번 틀리면 첫 글자 힌트', () => {
    const r = new Run(one(11), modeById('name')!, fields);
    expect(r.submit('리튬')).toMatchObject({ kind: 'wrong', hint: null });
    expect(r.submit('칼륨')).toMatchObject({ kind: 'wrong', hint: '나○○' });
  });
  it('모르겠어요 → 정답 공개, 틀린 역으로 기록', () => {
    const r = new Run(one(1, 2), modeById('symbol')!, instant, Math.random, clock);
    expect(r.skip()).toEqual({ reveal: ['H'], finished: false });
    r.type('he');
    const res = r.result();
    expect(res.first_try_correct).toBe(1);
    expect(res.missed_station_ids).toEqual([1]);
    expect(res.accuracy).toBe(0.5);
  });
});

describe('혼합 순서', () => {
  it('같은 종류가 3역 넘게 이어지지 않는다', () => {
    for (const mode of [modeById('mixed')!, modeById('master')!]) {
      for (let k = 0; k < 50; k++) {
        const p = planPrompts(32, mode);
        for (let i = 3; i < p.length; i++) expect(p.slice(i - 3, i + 1).every((x) => x === p[i])).toBe(false);
      }
    }
  });
  it('rng가 늘 같은 값을 줘도 규칙을 지킨다', () => {
    const p = planPrompts(20, modeById('mixed')!, fixed([0]));
    for (let i = 3; i < p.length; i++) expect(p.slice(i - 3, i + 1).every((x) => x === p[i])).toBe(false);
  });
});

describe('번호 쓰기: 역 순서를 섞는다', () => {
  it('같은 역들을 섞어서 내고 원본 노선은 그대로', () => {
    const src = lineStations(lineById('basic')!);
    const ids = src.map((s) => s.id);
    const r = new Run(src, modeById('number')!, fields, fixed([0.1, 0.9, 0.5, 0.3]));
    expect(r.stations.map((s) => s.id).sort((a, b) => Number(a) - Number(b))).toEqual(ids);
    expect(r.stations.map((s) => s.id)).not.toEqual(ids);
    expect(src.map((s) => s.id)).toEqual(ids);
  });
  it('섞지 않는 모드는 노선 순서 그대로', () => {
    const src = lineStations(lineById('basic')!);
    expect(new Run(src, modeById('name')!, fields).stations).toBe(src);
  });
});

describe('평균 타수', () => {
  it('두벌식 자모 단위로 센다', () => {
    expect(strokes('플루오린')).toBe(10); // ㅍㅡㄹ ㄹㅜ ㅇㅗ ㄹㅣㄴ
    expect(strokes('Fe')).toBe(2);
    expect(strokes('왜')).toBe(3); // ㅇ + ㅙ(ㅗㅐ)
    expect(strokes('닭')).toBe(4); // ㄷ ㅏ ㄺ(ㄹㄱ)
    expect(strokes('빵')).toBe(3); // ㅃ(Shift) ㅏ ㅇ
    expect(strokes(' a b ')).toBe(2);
  });
  it('맞힌 답의 타수 ÷ 걸린 분', () => {
    let t = 0;
    const r = new Run(one(9, 10), modeById('name')!, fields, Math.random, () => (t += 30000));
    r.start(); // t=30s
    r.submit('플루오린'); // 10타
    r.submit('넹'); // 오답은 세지 않음
    r.submit('네온'); // ㄴㅔ ㅇㅗㄴ = 5타, 종착 때 시계를 한 번 더 읽어 t=60s → 30초
    expect(r.result().cpm).toBe(30); // 15타 ÷ 0.5분
  });
});

describe('모드 카드 타이핑 애니메이션', () => {
  it('한글은 두벌식으로 칠 때처럼 자모가 조합되며 보인다', () => {
    expect(typingSteps('플루')).toEqual(['ㅍ', '프', '플', '플ㄹ', '플루']);
    expect(typingSteps('Br')).toEqual(['B', 'Br']);
    expect(typingSteps('염소').at(-1)).toBe('염소');
  });
});

describe('전자 배치 (지도 모듈)', () => {
  it('쌓음 원리와 예외', () => {
    const c = (z: number) => { const r = configuration(z); return `${r.core ? `[${r.core}] ` : ''}${subText(r.valence)}`; };
    expect(c(1)).toBe('1s¹');
    expect(c(11)).toBe('[Ne] 3s¹');
    expect(c(26)).toBe('[Ar] 3d⁶ 4s²');
    expect(c(24)).toBe('[Ar] 3d⁵ 4s¹');
    expect(c(29)).toBe('[Ar] 3d¹⁰ 4s¹');
    expect(c(79)).toBe('[Xe] 4f¹⁴ 5d¹⁰ 6s¹');
    expect(subText(configuration(11).full)).toBe('1s² 2s² 2p⁶ 3s¹');
  });
  it('껍질별 전자 수와 오비탈 상자', () => {
    expect(shells(11)).toEqual([2, 8, 1]);
    expect(shells(26)).toEqual([2, 8, 14, 2]);
    expect(shells(118).reduce((a, b) => a + b)).toBe(118);
    expect(boxes({ n: 2, l: 'p', e: 4 })).toEqual(['↑↓', '↑', '↑']);
  });
});

describe('기록', () => {
  it('더 빠르면 신기록, 같으면 정확도', () => {
    expect(isBetter({ duration_ms: 5, accuracy: 1 }, { duration_ms: 6, accuracy: 1 })).toBe(true);
    expect(isBetter({ duration_ms: 6, accuracy: 1 }, { duration_ms: 6, accuracy: 0.9 })).toBe(true);
    expect(isBetter({ duration_ms: 7, accuracy: 1 }, { duration_ms: 6, accuracy: 0.5 })).toBe(false);
  });
  it('기본선은 20역', () => expect(lineStations(lineById('basic')!).length).toBe(20));
});

describe('데이터 검사', () => {
  it('현재 데이터는 통과', () => expect(checkData(path.resolve(__dirname, '../data'))).toEqual([]));
  it('없는 역 참조·중복 역·별칭 충돌을 잡는다', () => {
    const src = path.resolve(__dirname, '../data');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-data-'));
    // shortcut: cpSync crashes the vitest worker on this OneDrive path, so copy file by file
    fs.mkdirSync(path.join(dir, 'lines'));
    for (const f of ['stations.json', 'organs.json', 'scenes.json', 'services.json', 'modes.json', 'lines/basic.json', 'lines/digestive.json']) fs.writeFileSync(path.join(dir, f), fs.readFileSync(path.join(src, f)));
    fs.writeFileSync(path.join(dir, 'lines', 'bad.json'), JSON.stringify({ id: 'bad', service_id: 'element', name: 'x', color: 'x', status: 'open', station_ids: [1, 1, 999] }));
    const st = JSON.parse(fs.readFileSync(path.join(dir, 'stations.json'), 'utf8'));
    st[0].aliases_ko = ['헬륨'];
    fs.writeFileSync(path.join(dir, 'stations.json'), JSON.stringify(st));
    const errs = checkData(dir).join('\n');
    expect(errs).toContain('없는 역 999');
    expect(errs).toContain('중복 역 1');
    expect(errs).toContain('별칭 충돌');
  });
  it('Organism: 다른 서비스 역 참조·경로 순서 어긋남을 잡는다', () => {
    const src = path.resolve(__dirname, '../data');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-data-'));
    fs.mkdirSync(path.join(dir, 'lines'));
    for (const f of ['stations.json', 'organs.json', 'scenes.json', 'services.json', 'modes.json', 'lines/basic.json']) fs.writeFileSync(path.join(dir, f), fs.readFileSync(path.join(src, f)));
    const dig = JSON.parse(fs.readFileSync(path.join(src, 'lines/digestive.json'), 'utf8'));
    dig.station_ids = ['mouth', 'stomach', 'esophagus', 'small-intestine', 'large-intestine', 'anus'];
    fs.writeFileSync(path.join(dir, 'lines', 'digestive.json'), JSON.stringify(dig));
    fs.writeFileSync(path.join(dir, 'lines', 'mix.json'), JSON.stringify({ id: 'mix', service_id: 'organism', name: 'x', color: 'x', status: 'open', group: 'basic', station_ids: ['mouth', 11] }));
    const errs = checkData(dir).join('\n');
    expect(errs).toContain('경로의 역 순서');
    expect(errs).toContain('없는 역 11');
  });
});

describe('Organism_Metro', () => {
  const svc = services.find((s) => s.id === 'organism')!;
  const dig = lineById('digestive')!;
  it('이름 쓰기: 하는 일을 보여 주고 이름을 Enter로 낸다', () => {
    const r = new Run(lineStations(dig), modeById('recall')!, svc.fields);
    expect(r.prompt).toBe('desc');
    expect(r.station.fields.desc).toContain('아밀레이스');
    expect(r.submit('입').kind).toBe('correct');
    expect(r.submit('위').kind).toBe('wrong'); // 2번째 역은 식도
  });
  it('별칭으로 맞히면 공식 이름을 알려 준다 (작은창자 → 소장)', () => {
    const r = new Run(lineStations(dig, ['small-intestine']), modeById('recall')!, svc.fields);
    const j = r.submit('작은 창자');
    expect(j).toMatchObject({ kind: 'correct', viaAlias: '작은창자', shown: '소장' });
  });
  it('순서 쓰기: 몇 번째 역인지만 보여 준다', () => {
    const r = new Run(lineStations(dig), modeById('sequence')!, svc.fields);
    expect(r.prompt).toBe('order');
    expect(r.station.fields.order).toBe('1');
    r.submit('입');
    expect(r.station.fields.order).toBe('2');
  });
  it('모든 노선의 역이 기관 데이터에 있고 장면 위 경로를 가진다', () => {
    for (const l of visibleLines('organism')) {
      expect(l.route?.filter((p) => p[2]).map((p) => p[2])).toEqual(l.station_ids);
      expect(lineStations(l).every((s) => s.fields.name && s.fields.desc)).toBe(true);
    }
  });
});
