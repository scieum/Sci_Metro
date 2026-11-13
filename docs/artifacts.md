# 산출물 (R4)

## 단계별 파일
서비스마다 `work/<서비스id>/` 하나. 앱 코드는 루트(PRD 13장 기술).

```
work/element/
  S1/references.md      레퍼런스 (uibowl 링크 + 가져올 점)
  S1/analysis.md        반영 목록
  S1/screen-spec.md     화면 설계서 (화면마다 ## 제목 1개)
  S2/keyscreens.md      Figma 파일 URL + 프레임 3개 node-id
  S2/approval.md        사람 승인 기록 (승인/반려, 사유, 날짜)
  S3/tokens.json        Figma Variables에서 내보낸 토큰
  S3/screens.md         전체 화면 프레임 node-id 목록
  S3/guide-report.json  가이드 위반 검사 결과
  S5/checklist.md       PRD 14장 15항목 체크 (자동/사람 표시)
  S5/deploy.md          배포 URL
  state.json            진행 상태
app/src  app/data  app/tests   S4 앱 코드
scripts/gate.mjs        판정 스크립트
rules.json              규칙 SSOT
```
S4는 별도 리포트 없이 빌드·테스트 exit code를 쓴다.

## 규칙 SSOT
- `rules.json` 1개. 게이트 스크립트는 규칙을 이 파일에서만 읽는다.
- 원소 이름 자체는 `app/data/stations.json`(데이터). rules.json은 "어떤 이름이어야 하는가"만 가진다. 어긋나면 게이트가 잡는다.

## 재개
- `work/<서비스id>/state.json`: `{ "stage": "S3", "attempts": 1, "passed": ["S1","S2"] }`
- 재시작 시 마지막으로 통과한 단계의 다음 단계부터.
- `passed`는 게이트 스크립트만 쓴다.

## 다음 서비스
- `work/bio/`를 새로 만들고 `work/element/`는 보존.
- S3 토큰·컴포넌트는 Science_Metro 공통. Bio는 재사용하고 노선 색만 추가.
