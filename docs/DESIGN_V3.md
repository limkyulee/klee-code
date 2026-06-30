# Klee Code Design V3

## 목표

V3는 Klee Code 내부 스킬과 프로젝트별 사용자 정의 지침을 프롬프트 조립 단계에 통합한다. 사용자는 채팅 첫 토큰에 `/스킬명`을 입력해 내부 스킬 또는 `.klee/skills`의 커스텀 스킬을 활성화한다.

## Slash Skill 문법

- 메시지 첫 토큰이 `/[a-zA-Z0-9_-]+`이면 skill command로 처리한다.
- 예: `/review 선택한 코드 리팩토링 포인트 알려줘`
- 확장은 백엔드에 `skillCommand.name=review`, `question=선택한 코드 리팩토링 포인트 알려줘`를 전달한다.
- 메시지 중간의 `/review`는 일반 텍스트다.
- 알 수 없는 스킬은 백엔드가 `UNKNOWN_SKILL`로 거절한다.
- `/clear`는 모델에 전달하지 않는 로컬 명령이다. 현재 대화 내역을 비우고 새 `conversationId`를 생성해 context window를 초기화한다.

## 내부 스킬

내부 스킬은 백엔드 classpath 리소스로 관리한다.

```text
backend/src/main/resources/klee-prompts/
  system.md
  skills/
    review.md
    explain.md
    fix.md
    test.md
```

내부 스킬명은 예약어다. 내부 스킬과 커스텀 스킬 이름이 충돌하면 내부 스킬이 우선한다.

## 사용자 정의 .klee

확장은 현재 VS Code 워크스페이스 루트의 `.klee`만 읽는다.

```text
.klee/
  rules/
    *.md
  skills/
    *.md
  hooks/
    *.md
```

- `rules/*.md`: 모든 요청에 포함할 프로젝트 지침이다.
- `skills/*.md`: `/파일명`으로 호출할 때만 포함한다.
- `hooks/*.md`: v3에서는 실행하지 않고 이벤트성 Markdown 지침으로만 포함한다.
- `.skill` 폴더는 지원하지 않는다.

## 프롬프트 조립

최종 프롬프트 조립 책임은 백엔드 `prompt` 도메인이 가진다. 확장은 `.klee` 파일을 읽어 구조화된 요청 DTO로 전달하고, 백엔드는 다음 순서로 합성한다.

1. Klee Code 시스템 프롬프트
2. 내부 slash skill
3. `.klee/rules/*.md`
4. 활성화된 `.klee/skills/*.md`
5. `.klee/hooks/*.md`
6. 응답 언어 preference
7. 선택 코드와 주변 컨텍스트
8. 사용자 질문

## 보안 제한

- 커스텀 파일은 Markdown 파일만 읽는다.
- `.klee/skills`만 커스텀 스킬 위치로 인정한다.
- v3 hook은 명령 실행, 파일 수정, 네트워크 호출을 하지 않는다.
- 확장은 큰 Markdown 파일을 요청에서 제외한다.
- 백엔드는 요청으로 받은 커스텀 Markdown을 프롬프트 재료로만 사용한다.

## V4 후보

- 승인 기반 hook 명령 실행
- 사용자 홈 전역 `.klee`
- UI 기반 skill 탐색과 선택
- slash command 자동완성과 스킬 목록 표시
