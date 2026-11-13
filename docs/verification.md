# 검증과 리뷰 (R8)

하네스로 서비스를 돌리기 전에 하네스 자체를 검증한다.

## 1. 게이트 스크립트 검증
- `scripts/fixtures/G1~G4/`에 게이트마다 통과 예시 1개 + 조건마다 실패 예시 1개.
- ★N1·N2 실패 예시는 필수: Na name_ko = "소듐"인 stations.json, `type="email"`이 들어간 src 등.
- `node scripts/gate.test.mjs` → 모든 예시가 예상대로 통과/실패해야 한다.

## 2. Figma MCP 사전 확인
- 빈 Figma 파일 1개에 390×844 프레임 1개, Variables 모드 2개, Pretendard 텍스트 1개 생성 → json 내보내기 시험.
- 실패하면 G3 ②③(글꼴·모드)을 사람 확인으로 내린다.
- 사용자 Figma 계정에 파일을 만드므로 실행 직전 한 번 더 확인받는다.

## 3. 폴더 밖 변경 검사 (모든 게이트 공통 조건 ⓪)
- 프로젝트를 git 저장소로 만들고 단계 시작 시 커밋한다.
- 게이트에서 `git diff --name-only` (단계 시작 커밋 대비, untracked 포함) → 바뀐 파일이 전부 그 에이전트 편집 폴더 안이어야 통과. 예외: 스크립트가 쓰는 state.json, gate-fail.json.

## 4. 코드 리뷰 (참고용, 게이트 아님)
- G4 통과 후 읽기전용 리뷰 에이전트가 `app/` 검토 → `work/<id>/S4/review.md`.
- S5 사람 확인 때 함께 보여 준다.
