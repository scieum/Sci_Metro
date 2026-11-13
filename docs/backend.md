# 랭킹 백엔드 (Supabase + NEIS)

근거: docs/story-service.md N1(개정), 운영자 결정 2026-11-13. 저장해도 되는 열은 rules.json `privacy.server_fields_allowed`가 SSOT다.

## 원칙
- 기본 기록은 브라우저(localStorage)에만. 서버에는 결과 화면에서 **'랭킹에 올리기'를 누른 판만** 간다.
- 받는 것: 학교(NEIS 학교코드·학교명), 닉네임, 그 판의 기록. 실명·학년·반·연락처·기기 식별자·IP 저장 없음.
- NEIS API 키와 Supabase `service_role` 키는 클라이언트에 두지 않는다 (G4⑥가 검사).

## 테이블 `ranking_entries`
| 열 | 형식 | 설명 |
|---|---|---|
| id | uuid, 기본 gen_random_uuid() | |
| line_id | text, not null | 노선 id (data/lines의 id와 일치해야 함) |
| mode_id | text, not null | symbol / name / number / mixed / master |
| duration_ms | int, not null, > 0 | |
| first_try_correct | int, not null | 한 번에 맞힌 역 수 |
| total_stations | int, not null | |
| school_code | text, not null | NEIS SD_SCHUL_CODE |
| school_name | text, not null | NEIS SCHUL_NM |
| nickname | text, not null, 2~10자, `^[가-힣A-Za-z0-9]+$` | 금칙어는 Edge Function에서 거른다 |
| week | text, not null | ISO 주 (예: 2026-W46), 서버에서 KST 월요일 0시 기준으로 채움 |
| created_at | timestamptz, 기본 now() | |

- 인덱스: (line_id, mode_id, week, duration_ms), (line_id, mode_id, week, school_code, duration_ms)
- 정렬: duration_ms 오름차순, 같으면 정확도(first_try_correct / total_stations) 내림차순, 그다음 created_at.

## RLS
- `select`: 누구나 (공개 랭킹). 단, 반환 열은 뷰 `ranking_public`으로 제한 (id, nickname, school_name, duration_ms, first_try_correct, total_stations, week).
- `insert`: 직접 insert 금지. Edge Function `submit-record`만 service role로 넣는다 (닉네임 검사·주 계산·비정상 기록 검사).
- `update` / `delete`: 금지. 운영자는 대시보드에서만.

## Edge Functions
| 이름 | 입력 | 하는 일 |
|---|---|---|
| `school-search` | `q` (2자 이상) | NEIS 학교기본정보 API를 서버에서 호출해 `{code, name, region}` 최대 10개 반환. 키는 함수 환경 변수 `NEIS_API_KEY`. 결과 캐시 1일 |
| `submit-record` | line_id, mode_id, duration_ms, first_try_correct, total_stations, school_code, nickname | 닉네임 규칙·금칙어 검사, school_code를 NEIS로 다시 확인해 school_name 채움, 노선 역 수와 total_stations 일치 검사, 너무 빠른 기록(역당 0.2초 미만) 거절, week 채워서 insert |

## 화면 (Figma)
- `04 기록`: 주간 랭킹(노선·모드 선택, 전체 / 우리 학교, 내 순위 요약·백분위, 큰 숫자 목록 / PC·태블릿 표, 내 주변만 보기, 내 줄 강조·고정) + 내 기록(이 기기).
- `05 랭킹에 올리기`: 이번 판 요약 → 학교 검색(NEIS) → 닉네임 → 공개 확인 체크 → 올리기.

## 확인 필요 (운영자)
- 만 14세 미만 이용자의 학교·닉네임 수집에 법정대리인 동의가 필요한지 학교·교육청 개인정보 담당자에게 확인.
- 닉네임 금칙어 목록.
