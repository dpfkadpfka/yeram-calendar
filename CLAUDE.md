# RamCalendar

## 무엇을 하는 앱인가
구글 캘린더와 연동되는 윈도우 바탕화면 달력 앱(Electron). 예람쌤(김예람)이 스케두 대신 쓰려고 만들었고, 다른 선생님들께도 무료로 배포한다.
메신저·공문·메일 글이나 파일을 넣으면 날짜·마감을 찾아 일정으로 만드는 "일정 도우미"가 핵심 기능이다.

## 정해진 규칙
- 답변·보고는 한국어로 짧게. 설명·목록 앞에 이모지를 붙이지 않는다. 노란색 포인트를 쓰지 않는다.
- 앱 이름은 "RamCalendar"(붙여 씀). 예전 이름(예람달력, Ram Calendar, yeram-calendar)은 쓰지 않는다.
- 고친 뒤 배포할지 묻지 말고 바로 배포한다.
- 바탕화면 달력답게 모든 스킨은 바탕화면 바로 위에 붙어 있다(다른 창 뒤). "다른 창 뒤에 두기"·"항상 위에" 설정은 없앴다. 트레이를 누르면 잠깐 맨 앞에 뜬다.
- 맨 아래(HWND_BOTTOM)로 보내면 바탕화면 아이콘보다 밑으로 내려가 안 보인다. 반드시 바탕화면 아이콘 창(SHELLDLL_DefView를 품은 Progman/WorkerW) 바로 위 자리에 둔다.
- 1초마다 확인하는 식의 폴링은 쓰지 않는다. 윈도우 이벤트(SetWinEventHook)로 처리한다.
- 창은 frame:false, thickFrame:false(그림자 없음), 둥근 모서리, 가장자리 손잡이로 크기 조절. −·× 버튼은 기본으로 숨김.
- 칸 크게 보기·카드 그림자·일정 색 상자는 그대로 둔다(예람쌤이 마음에 들어 함).
- 기본 스킨은 "바탕화면 비침"(윈도우 바탕화면 그림을 창 자리에 깔아 비치는 것처럼). 예전 아크릴 방식은 없앴다.
- 무늬 스킨: 모눈 노트·코르크 보드·다이어리(색감 고르기 가능). 앱 아이콘 6가지 중 1번이 기본.
- 업데이트는 자동으로 받아 조용히 설치하고 다시 켠다(electron-updater, 1시간마다 확인).
- 일정 도우미: AI(Gemini, 사용자가 키를 넣었을 때) + 날짜 규칙을 함께 쓴다. 메신저 머리글(보낸 사람·보낸 시각)은 일정으로 잡지 않는다. 날짜 없는 글은 오늘 날짜 카드로 만든다. PDF·hwpx·docx·사진(AI 필요) 파일을 끌어다 놓을 수 있다.
- 구글 클라이언트 비밀값·키 같은 비밀은 절대 코드나 대화에 넣지 않는다(creds.json은 빌드 때 GitHub Secrets로 만들어짐).

## 파일 구조
- main.js: 창·트레이·구글 로그인/캘린더 API·알림·업데이트·바탕화면 고정(koffi로 user32 호출)·일정 도우미 AI/파일 읽기
- preload.js: 화면 쪽에 열어 주는 기능 목록
- renderer/index.html, app.js, style.css: 달력 화면·설정 창·일정 도우미
- renderer/assist.js: 날짜 규칙으로 일정 찾기(AI 없이)
- renderer/alarm.html: 일정 알림 창
- assets/icons/icon1~6.png, build/icon.ico: 앱 아이콘
- docs/releases/vX.Y.Z.md: 버전별 릴리스 노트(릴리스 설명으로 그대로 올라감)
- docs/readme/: README 사진
- .github/workflows/release.yml: "설치 파일 만들기" 워크플로

## 배포
- 저장소: https://github.com/dpfkadpfka/RamCalendar
- 최신 설치 파일: https://github.com/dpfkadpfka/RamCalendar/releases/latest/download/RamCalendar-Setup.exe
- 방법: package.json version 올리기 → docs/releases/v버전.md 쓰기 → 커밋·푸시 → `gh workflow run release.yml --ref main -R dpfkadpfka/RamCalendar` → latest.yml 버전 확인
- 소개 페이지: 예람쌤 홈페이지(dpfkadpfka.github.io)의 RamCalendar 항목, 사용 가이드 PDF(apps/ram-calendar-guide.pdf)

## 지금까지 결정한 것
- 2026-11 초: 이름을 RamCalendar로 통일, 저장소 이름 변경, README·릴리스 노트·사용 가이드 새로 작성, 툴바 아이콘·글자 크기 통일
- 1.2.x: 무늬 스킨, 앱 아이콘 고르기, 자동 업데이트·자동 다시 켜기, 작업 표시줄 숨기기 설정
- 1.2.8~1.2.9: 창 −·× 숨김, 둥근 모서리, 그림자 제거, 바탕화면 그림 스킨
- 1.2.10~1.2.12: 일정 도우미 — 메신저 머리글 무시, 날짜 없는 글은 오늘 카드, 말풍선 스크롤, 파일 넣기, AI+규칙 함께
- 1.2.13~1.2.16: 바탕화면에 붙어 있게(모든 스킨), 트레이로 잠깐 앞에
- 1.2.17: 바탕화면 비침 하나로 합치고 기본 스킨으로
- 1.2.18~1.2.20: 캡처·Esc 때 사라지던 문제 — 이벤트 방식 지킴이로 제자리 복귀

## 남은 일
- 1.2.20에서 캡처 후 달력이 사라지지 않는지 실제 윈도우에서 확인(원인은 아직 모름)
- 윈도우 키+D(바탕화면 보기) 때도 달력이 보이게 할지 — 예람쌤이 원하면 진행

## 자료 목록
앱 폴더의 `자료\`에 있는 파일(코드 저장소에는 올리지 않음, .gitignore에 제외)
- 올린파일\ (40개): 예람쌤이 채팅방에 올린 화면 캡처·오류 캡처, GPT로 만든 그림 3장, 처음 코드(예전코드_main.js·preload.js·package.json·calendar-board.html). 파일 이름 앞 숫자는 올린 날짜·시각(월일_시분)
- 사용가이드\ (21개): 사용 가이드 PDF v1.2.0·v1.2.3·v1.2.4·v1.2.7, 만들기\ 안에 가이드를 만드는 스크립트(build.py·cap.py·mock.js)와 쪽별 HTML
- README_만들기\ (16개): 깃허브 README 사진·홈페이지 사진을 찍는 스크립트(build.py·cap.py·hpcap.py·gh.py·mock.js)와 사진별 HTML
- 홈페이지_캡처\ (11개): 예람쌤 홈페이지에 올린 RamCalendar 캡처 10장과 가이드 PDF
- 아이콘\ (6개): 앱 아이콘 1~6 PNG(다운로드 폴더에 저장해 드렸던 것, 앱 안 아이콘은 assets/icons)
- 디자인_비교\ (10개): 무늬 스킨 미리보기, 바탕화면 그림 스킨 비교, 창틀 비교(코르크·파스텔), 바탕화면형 비교
- 캡처_스크립트\ (7개): 일정 도우미·바탕화면 스킨·홈페이지 캡처용 스크립트(mock.js로 구글 없이 화면 띄움)
