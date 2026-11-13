# 오케스트레이터 (R7)

오케스트레이터 = 메인 Claude Code 세션. 진행 규칙은 CLAUDE.md에 둔다.

## 하는 일 (이 4개만)
1. `work/<id>/state.json`을 읽고 현재 단계를 판단한다.
2. 그 단계 에이전트(docs/roles.md)를 부른다. 넘기는 것: 입력 파일 경로 + 있으면 gate-fail.json.
3. `node scripts/gate.mjs <단계>` 실행.
4. 통과 → 다음 단계 / 실패 → docs/pipeline.md 복귀 위치 / attempts = retry_limit → 멈춤.

## 하면 안 되는 것
- 에이전트 산출물 직접 수정
- 게이트 건너뛰기, 실패를 통과로 보고
- `rules.json`, `scripts/` 수정 (훅이 막음)
- 사람 대신 `승인` 쓰기 (훅이 막음)

## S2 멈춤
G2 ①② 통과 → Figma 링크와 프레임 3개를 보여 주고 턴 종료. 사용자가 "승인" 또는 "반려: 사유"라고 말하기 전에는 S3를 시작하지 않는다. 그 뒤 G2 ③ 검사.

## 문서 우선순위 (충돌 시)
story-service.md > rules.json > gates.md > pipeline.md > roles.md > prd.md
PRD 원문의 '크로뮨', '나이오비움' 표기는 쓰지 않는다.
