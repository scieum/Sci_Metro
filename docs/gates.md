# 게이트 (R5)

수치·목록은 모두 `rules.json`에서 읽는다. 이 문서는 조건의 의미만 적는다.
Figma 산출물은 에이전트가 Figma MCP로 json을 내보내고, 스크립트는 그 json을 검사한다.

## 공통 조건 ⓪ (모든 게이트)
단계 시작 커밋 대비 바뀐 파일이 전부 그 에이전트 편집 폴더 안 (docs/roles.md). 예외: state.json, gate-fail.json.

## 기계 조건 (전부 만족해야 통과)
| 게이트 | 조건 | rules.json |
|---|---|---|
| G1 (S1) | ① references.md의 uibowl URL 수 ≥ 5 ② screen-spec.md에 필수 화면 `## 제목` 5개 모두 있음 | research.* |
| G2 (S2) | ① keyscreens.json에 keyscreens × frames(모바일·태블릿·PC) = 9프레임 ② 각 프레임 크기 = frames 값 ③ approval.md 마지막 줄 = `승인` | design.keyscreens, design.frames |
| G3 (S3) | ① tokens.json에 bg·accent 값이 정확히 있음, forbidden_colors 0개 ② 글꼴 ⊆ fonts_allowed ③ 모드 수 ≥ 2 ④ 노선 색 8개, 서로 다름 ⑤ 글자 크기 ⊆ font_sizes, 모서리 ⊆ radii | design.* |
| G4 (S4) | ① 빌드 exit 0 ② 판정 함수 단위 테스트 exit 0 ③ 데이터 검사 0건 (없는 역 참조·중복 역·빈 정답·별칭 충돌) ④ engine 디렉터리에서 금지어 0건 ⑤ ★N2 ⑥ ★N1 | engine.*, naming.*, privacy.* |
| G5 (S5) | ① 자동 체크 12개 Playwright 전부 통과 ② 배포 URL HTTP 200 | — |

## ★ 어기면 안 되는 것 (story-service.md)
- **G4⑤ N2 표기**: `app/data/stations.json` 원소 수 = 118, name_ko 빈 값 0개. naming.names 13개 원소마다 `name_ko == official`, aliases ⊇ 규칙 aliases. 불일치 0건.
- **G4⑥ N1 개인정보**: `app/src/`에서 privacy.forbidden_in_src 검색 0건 (NEIS 주소·키·Supabase service_role이 클라이언트에 없음). 외부 네트워크 호출은 network_allowed만. Supabase 테이블 열 ⊆ privacy.server_fields_allowed (마이그레이션 SQL 검사). 랭킹 등록 호출은 결과 화면의 '랭킹에 올리기' 처리 함수 안에서만.

## G5 체크 항목 분류 (PRD 14장 15개)
| 구분 | 항목 | 판정 |
|---|---|---|
| 입력 | fe + Enter → 다음 역, Enter 전에는 판정 안 함 (운영자 결정 2026-11-13, PRD 즉시 이동 대체) | 자동 |
| 입력 | Fe 역에서 fa를 쳐도 Enter 전에는 오답 아님, fa + Enter = 오답 | 자동 |
| 입력 | '플루오린' + Enter 1회 → 마지막 글자까지 제출 (Win·mac·iOS·Android) | **사람** |
| 입력 | '소듐' 입력 → 정답 + '나트륨' 안내 (Na 예외 반영) | 자동 |
| 입력 | 완전 혼합 '9' → F·플루오린 모두 정답 | 자동 |
| 입력 | 혼합 F를 보고 F → 오답 | 자동 |
| 화면 | /element/lanthanide?mode=master 바로 준비 | 자동 |
| 화면 | 키보드 올라와도 안내판·입력창 보임 | **사람** |
| 화면 | 미니 주기율표 이번 역·통과·틀린 역 구분 | **사람** |
| 화면 | 결과 카드 1080×1920 PNG | 자동 |
| 화면 | 저장 막힌 환경(시크릿)에서 끝까지 동작 | 자동 (localStorage 예외 주입) |
| 확장 | 새 노선 JSON 1개 추가 → 노선 선택에 나타남 | 자동 |
| 확장 | 없는 역 참조 노선 → 빌드 실패 | 자동 |
| 확장 | Bio_Metro coming_soon → 홈 '개통 예정' | 자동 |
| 확장 | 엔진에 원소 전용 로직 없음 | 자동 (= G4④) |

자동 12 / 사람 3. 사람 3개는 **승인이 아니라 확인 기록**이다 (S5/checklist.md에 체크).

## 사람 승인
- **S2 시안 확정 1곳뿐.** 운영자 1명이 approval.md에 `승인` 또는 `반려: 사유`를 쓴다.

## 실패 시
- 게이트 스크립트는 실패한 조건 번호와 위반 위치만 `work/<서비스id>/<단계>/gate-fail.json`에 쓴다.
- 복귀한 에이전트는 gate-fail.json만 읽고 고친다. 복귀 위치는 docs/pipeline.md.
- 실패마다 state.json attempts +1. retry_limit(3)에 닿으면 멈추고 사람에게 넘긴다.
