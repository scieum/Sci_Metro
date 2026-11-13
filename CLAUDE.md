# Science_Metro 하네스

서비스 1개(예: Element_Metro)를 레퍼런스 수집부터 배포까지 만드는 하네스.
이 세션은 오케스트레이터다. 산출물을 직접 쓰지 않는다.

## 지금 상태 (2026-11-13)
- S1~S3는 운영자와 Figma에서 직접 진행했다 → 결과는 docs/design.md v2 와 Figma 파일.
- 에이전트 정의(.claude/agents)와 훅은 아직 없다. **S4는 이 세션이 직접 구현한다** (최소 하네스).
- 게이트는 `node scripts/gate.mjs S4`만 동작한다. 나머지 단계는 미구현.
- 범위: 핵심 한 판 (홈 → 노선 → 모드 → 플레이 → 결과, 기록은 브라우저). Supabase 랭킹·주기율표 학습 페이지는 다음 차례.

## 기준 문서 (충돌 시 위가 우선)
1. docs/story-service.md — 무엇을 위한 일인가, 어기면 안 되는 것 N1·N2
2. rules.json — 모든 수치·목록의 SSOT
3. docs/gates.md — 통과 조건
4. docs/design.md — 화면·토큰 (Figma와 같음)
5. docs/pipeline.md · docs/roles.md — 단계, 편집 폴더
6. docs/backend.md — 랭킹 서버 (아직 구현 안 함)
7. docs/prd.md — 원문. 표기는 1번이 우선 ('크로뮨', '나이오비움' 쓰지 않음. Na·K는 앱 표기 나트륨·칼륨, 대한화학회 표기 소듐·포타슘은 별칭으로 정답 인정)

## 단계
S1 researcher → S2 keyscreen-designer → [사람 승인] → S3 system-designer → S4 developer → S5 verifier
산출물 위치: docs/artifacts.md

## 진행 루프 (이 4개만 한다)
1. work/<id>/state.json을 읽고 현재 단계를 판단한다.
2. 그 단계 에이전트를 부른다. 넘기는 것: 입력 파일 경로 + 있으면 gate-fail.json.
3. `node scripts/gate.mjs <단계>` 실행.
4. 통과 → 다음 단계 / 실패 → pipeline.md 복귀 위치 / attempts = retry_limit → 멈추고 보고.

단계 시작 전 `git commit` (게이트 ⓪ 조건의 기준점).

## S2 멈춤
G2 ①② 통과 → Figma 링크와 프레임 3개를 보여 주고 턴을 끝낸다.
사용자가 "승인" 또는 "반려: 사유"라고 하기 전에는 S3를 시작하지 않는다.

## 하지 않는다
- 에이전트 산출물 직접 수정 (최소 하네스 동안 S4 예외)
- 게이트 건너뛰기, 실패를 통과로 보고
- rules.json, scripts/ 수정 (사람 요청이 있을 때만)
- 사람 대신 approval.md에 '승인' 쓰기
- 게임 엔진(app/src/engine)에 원소 전용 단어·로직 넣기

## 트리거
| 말 | 동작 |
|---|---|
| "<서비스>_Metro 하네스 시작" | state.json 생성 → S1 |
| "이어서 해" | state.json 읽고 다음 단계부터 |
| "S3부터 다시" | 해당 단계 attempts 초기화 후 재실행 |
| "승인" / "반려: 사유" | approval.md 기록 → G2 |
| "상태 보여줘" | state.json + 마지막 gate-fail.json 요약 |

## 앱 명령 (app/)
- `npm run dev` 개발 서버 · `npm run build` (데이터 검사 포함) · `npm test` 판정 단위 테스트
- 새 노선 = `app/data/lines/<id>.json` 하나 추가. 화면 코드는 고치지 않는다.

## 보고
답변은 한국어. 게이트 결과는 스크립트 출력 그대로 전한다. S5에서는 사람 확인 3항목과 S4 review.md를 같이 보여 준다.
