# MiniGame V2

## 업로드
이 폴더의 모든 파일을 GitHub 저장소 최상단에 업로드한 뒤 GitHub Pages를 켜세요.

필수 파일:
- index.html
- app.js
- manifest.webmanifest
- sw.js
- icon-192.png
- icon-512.png

## Firebase
Realtime Database URL은 app.js에 설정되어 있습니다.
firebase-rules.json 내용을 Firebase Realtime Database 규칙에 적용하세요.

## 게임
- 초성게임: 혼자 10문제 타임어택 / 온라인 10점 선승
- OX: 혼자 PC / 온라인 1:1 / 3선승
- 포트리스: 혼자 PC / 온라인 1:1 / 3선승

## V2.2 수정
- OX: 각자 3개 배치 후 자기 말을 선택해 빈칸으로 이동
- 초성게임: 규칙과 예시 설명 추가
- 포트리스: 탱크 방향 고정, 좌우 이동, 각도/파워 분리
- 모든 조절 버튼 길게 누르기 지원
- PC는 무작위 5~10발 주기로 명중하도록 조정
- 더블 클릭 확대 방지

## V2.3 초성 힌트 개선
- 문제 시작 시 1단계 힌트 즉시 표시
- 3초 동안 정답이 없으면 2단계 힌트
- 추가 3초 동안 정답이 없으면 3단계 힌트
- 다음 문제로 넘어가거나 종료되면 기존 힌트 타이머 자동 초기화
