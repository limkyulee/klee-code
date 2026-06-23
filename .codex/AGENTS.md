# Codex Project Instructions

## Program History

For every user request handled in this repository, maintain a Markdown history file under the `.codex/program-history` directory.

### When to Write

- At the end of each completed Codex task, create or update a history entry.
- Do this automatically without waiting for the user to explicitly ask for history.
- If a task is interrupted or blocked, still record the request, what was attempted, and the blocking reason.

### File Location and Naming

- Store history files in `.codex/program-history/`.
- Use the next numeric index in the filename.
- Filename format:

```text
N. short Korean task title.md
```

Example:

```text
2. 로그인 오류 수정.md
```

### Content Format

Each history file should include:

```markdown
# N. 작업 제목

- 상태: 완료 | 일부 완료 | 실패 | 차단
- 작성일: YYYY-MM-DD

## 질의

사용자가 요청한 내용을 요약한다.

## 처리 내용

Codex가 어떤 파일을 확인했고, 어떤 변경을 했고, 어떤 판단을 했는지 정리한다.

## 기능 추가/변경 결정 기록

기능을 추가하거나 기존 기능을 변경한 경우에만 작성한다.

- 요청 배경: 어떤 사용자 요청 때문에 기능 추가 또는 변경을 결정했는지 정리한다.
- 선택한 기술/방식: 최종적으로 적용한 구현 기술, 설정 방식, 라이브러리, 파일 구조 등을 적는다.
- 검토한 대안: 고려했지만 선택하지 않은 대안과 그 이유를 적는다.
- 선택 이유: 최종 방식을 선택한 근거를 유지보수성, 안정성, 기존 구조와의 일관성, 구현 범위 관점에서 설명한다.

## 변경 파일

- `path/to/file`

## 검증

실행한 테스트, 빌드, 린트 명령과 결과를 기록한다.

## 결과

사용자에게 전달한 최종 결과를 짧게 정리한다.
```

### Rules

- Keep entries concise but specific enough to reconstruct what happened.
- Do not include secrets, API keys, tokens, private credentials, or large raw logs.
- Do not overwrite previous history entries unless correcting the current task's entry.
- If unrelated user changes are present in the working tree, mention only the files relevant to the task.

## Backend Structure Rules

- Treat each business domain as a separate package root; do not nest unrelated domains under `chat/`.
- Organize backend code by MVC layer inside each domain: `controller`, `service`, `repository`, and `dto`.
- Use `record` for request/response/transport objects and simple immutable domain data whenever the type does not need mutation.
- Keep persistence-specific documents and repositories in their own domain package rather than sharing another domain's namespace.
