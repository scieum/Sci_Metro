# 역할 (R6)

## 에이전트 (1개당 편집 폴더 1개, 나머지는 읽기만)
| 에이전트 | 단계 | 편집 가능 폴더 | 도구 |
|---|---|---|---|
| researcher | S1 | `work/<id>/S1/` | uibowl MCP |
| keyscreen-designer | S2 | `work/<id>/S2/` (approval.md 제외) | Figma MCP |
| system-designer | S3 | `work/<id>/S3/` | Figma MCP |
| developer | S4 | `app/` (`app/src`, `app/data`, `app/tests`) | Bash, 편집 |
| verifier | S5 | `work/<id>/S5/` | Playwright, Vercel |

S2와 S3를 나눈 이유: 사이에 사람 승인이 있다. 승인 전에 토큰 작업이 시작되지 않게 한다.

## 판정자 (읽기전용)
- 판정은 `scripts/gate.mjs <단계>`만 한다. 에이전트는 판정하지 않는다.
- 스크립트가 쓰는 파일: `state.json`, `gate-fail.json` 2개뿐.
- `scripts/`, `rules.json`은 하네스 실행 중 어떤 에이전트도 편집할 수 없다. 규칙 변경은 사람만.
- `approval.md`는 사람(운영자)만 쓴다.
- 강제: PreToolUse 훅이 에이전트별 편집 폴더 밖, `scripts/`, `rules.json`, `approval.md` 편집을 차단한다.

## 자연어 트리거
| 말 | 동작 |
|---|---|
| "<서비스>_Metro 하네스 시작" | state.json 생성 → S1 |
| "이어서 해" | state.json 읽고 다음 단계부터 |
| "S3부터 다시" | 해당 단계 attempts 초기화 후 재실행 |
| "승인" / "반려: 사유" | approval.md 기록 → G2 실행 |
| "상태 보여줘" | state.json + 마지막 gate-fail.json 요약 |
