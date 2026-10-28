# Korean Gift 상품 접수·승인 연결 안내

## 현재 상태
- 한국어/영어 홈페이지 배경: 스카이 그레이 #e7eef2.
- 한국어 메뉴에 “내상품 판매 등록 의뢰하기” → submit.html.
- 상품 관리 → admin.html.
- 서버 연결 설정이 비어 있으면 접수·로그인은 비활성화됩니다. 입력 내용을 로컬 저장으로 접수 완료 처리하지 않습니다.
- GitHub Pages 주소는 유지합니다. Sites 도구를 사용하지 않습니다.

## Supabase 연결
1. 사용할 Supabase 프로젝트를 선택합니다. 이 프로젝트에는 인증, PostgreSQL, Storage가 필요합니다.
2. backend/schema.sql을 SQL Editor에서 1회 실행합니다. 기존 테이블을 삭제하지 않지만 kg_* 이름이 이미 있으면 충돌을 검토해야 합니다. 스키마는 아직 실제 DB에서 실행/검증하지 않았습니다.
3. Auth 설정에서 이메일 인증을 활성화하고 회원가입을 허용합니다. Site URL은 https://koreangift.github.io/main/submit.html 로 설정합니다. 인증 메일 발송 서비스/제한은 사용 계정에 맞게 설정합니다.
4. 운영자 계정을 Auth Users에 생성하거나 직접 가입·인증합니다. 운영자 비밀번호는 공개 코드나 채팅에 기록하지 않습니다.
5. 운영자 이메일을 넣어 SQL을 실행합니다:
   insert into public.kg_admins(user_id) select id from auth.users where email='운영자 이메일';
6. market-config.js의 supabaseUrl과 publishableKey를 해당 프로젝트 URL과 공개 publishable key(또는 legacy anon key)로 설정합니다. service_role/secret key는 절대 프런트엔드에 넣지 않습니다.
7. 변경된 market-config.js를 GitHub에 반영합니다.

## 실제 사용
- 제조자: submit.html에서 회원가입 → 이메일 인증 → 로그인 → 제조사, 담당자, 연락처, 상품명, 가격, 소개, 스펙, 대표 이미지 등록.
- 이미지: JPG/PNG/WebP, 5MB 이하. 미승인 이미지는 비공개 Storage.
- 운영자: admin.html 로그인 → 목록 선택 → 가격·설명·스펙·영문 내용·이미지 수정 → “저장 후 승인·공개”.
- 승인은 한국어/영어 상품명·설명·스펙과 공개용 이미지가 모두 있어야 가능합니다.
- 승인 트랜잭션으로 공개 테이블에 게시합니다. 공개 홈페이지는 접속 시와 60초마다 최신 승인 목록을 읽습니다. 열린 탭은 탭으로 돌아왔을 때도 갱신합니다.
- 이미 공개된 상품을 저장하면 공개 정보도 갱신합니다. 반려/공개 중지는 두 언어의 공개 목록에서 제거합니다.
- 새로 올리는 이미지는 별도 파일로 저장하므로 과거 캐시가 새 이미지를 가리지 않습니다.
- 이 기능은 상품 소개 등록입니다. 결제·주문·배송 기능은 포함하지 않습니다.

## 권한 설계
- 제조자: 자기 신청 내역만 읽기, 검토 대기 상태로만 새 신청. 제출 후 임의 수정·승인 불가.
- 운영자: kg_admins 등록 계정만 신청 전체 조회·편집·승인/반려/중지 가능.
- 방문자: 공개 상품 테이블만 조회. 담당자 이메일·연락처 및 비공개 신청 이미지 접근 불가.
- 공개 저장소에는 공개 제품 정보와 공개 이미지에 대한 코드만 게시. 실제 신청자의 연락처는 DB에 저장.

## 검증
- JavaScript 구문 검사 및 모의 API 테스트 통과: 연결 전 모드, 인증 업로드, 접수 데이터, 파일 유형/용량, 이미지 임시 주소, 승인 RPC, 로그아웃, 접근 거절 응답.
- 실제 DB 정책, 이메일 인증, 파일 업로드, 관리자 승인, 양 언어 공개는 연결 후 별도로 검증해야 합니다.
- 연결 후 테스트: 제조자 A 접수 → 다른 제조자 B가 A 정보를 읽거나 승인하지 못함 확인 → 운영자 가격·이미지 교체/양언어 작성 → 승인 → 로그인하지 않은 창에서 ko/en 공개 확인 → 공개 중지 후 두 언어에서 제거 확인.

공식 자료:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/auth/passwords
