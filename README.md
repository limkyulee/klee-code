# klee-code — On-Premise Coding Assistant

규제 산업(은행 등) 환경을 위한 **LLM 백엔드 교체 가능** 코딩 어시스턴트.

코드와 데이터가 보안 경계를 벗어나지 않으면서, 동일한 사용자 경험을 제공하는 구조를 직접 설계하고 구현한 포트폴리오 프로젝트입니다.

---

## 핵심 가치

- **모델 교체 가능성** — `application.yml` 한 줄로 Ollama(로컬) ↔ Claude / GPT(외부) 전환
- **데이터 보안 경계** — 규제 모드에서 LLM 어댑터가 외부 경로를 차단, 어떤 데이터도 경계 밖으로 나가지 않음

---

## 아키텍처

```
[ VSCode 확장 (TypeScript) ]    ← 얇은 클라이언트
        │ HTTP / SSE
        ▼
┌─────────────────────────────────────────────┐
│  온프렘 서버 (보안 경계)                        │
│                                              │
│   [ Spring 백엔드 (Spring AI) ]              │
│        │                  │                 │
│        ▼                  ▼                 │
│   [ 컨텍스트 조회 ]   [ LLM 어댑터 ]  ─────────┼──▶  외부 API (경계 밖)
│        │                  │                 │       Claude / GPT
│        ▼                  ▼                 │
│   [ DB (MySQL/Mongo) ] [ Ollama (로컬) ]     │
│        │                                    │
│        ▼                                    │
│   [ 감사 로그 ]                               │
└─────────────────────────────────────────────┘
```

정책 강제 지점이 백엔드 한 곳에 집중되어, 서버 한 대만 통제하면 보안 경계가 완성됩니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 클라이언트 | VSCode Extension API, TypeScript |
| 백엔드 | Spring Boot, Spring AI |
| LLM (로컬) | Ollama (`qwen2.5-coder:3b`) |
| LLM (외부) | Claude, GPT (설정으로 교체) |
| DB | MySQL / MongoDB |
| 패키징 | Docker Compose |

---

## 모델 전략

| 구분 | 모델 | 데이터 경계 |
|------|------|-------------|
| 로컬 | `qwen2.5-coder:3b` (Ollama) | 경계 안 — 추론이 로컬 장비에서 실행 |
| 외부 | Claude / GPT | 경계 밖 — 추론이 외부 GPU에서 실행 |
| 프로덕션(참고) | `qwen3.6:35b` (GPU 서버) | 경계 안 |

> 개발 환경: M1 / 16GB. `3b`는 Metal 가속으로 무난, `35b`(24GB)는 미지원.

---

## 구현 단계

- [ ] **Phase 0** — 뼈대: 확장 명령 1개 + `POST /chat` + ChatClient (end-to-end)
- [ ] **Phase 1** — 프로바이더 교체: `application.yml` 토글, Ollama 연결
- [ ] **Phase 2** — MCP: 직접 DB 조회 → MCP 서버/도구로 승격
- [ ] **Phase 3** — 컨텍스트 & 감사 로그: 코드 컨텍스트 수집, 로그 저장
- [ ] **Phase 4** — 온프렘 패키징: docker-compose + 데모 GIF

---

## 빠른 시작

### 사전 요구 사항

- Java 21+
- Node.js 20+
- Docker & Docker Compose
- Ollama (로컬 모드 시)

### 1. Ollama 모델 다운로드

```bash
ollama pull qwen2.5-coder:3b
```

### 2. 백엔드 실행

```bash
cd backend
./mvnw spring-boot:run
```

`src/main/resources/application.yml`에서 모델 프로바이더를 설정합니다.

```yaml
# 로컬 모드 (데이터가 경계 밖으로 나가지 않음)
spring:
  ai:
    ollama:
      chat:
        model: qwen2.5-coder:3b

# 외부 모드 (application-external.yml)
# spring:
#   ai:
#     anthropic:
#       chat:
#         model: claude-sonnet-4-6
```

### 3. VSCode 확장 설치

```bash
cd extension
npm install
npm run compile
```

F5로 Extension Development Host를 실행하거나, `.vsix`로 패키지 후 설치합니다.

VSCode 설정에서 백엔드 URL과 API 키를 입력합니다.

```json
{
  "kleeCode.backendUrl": "http://localhost:8080",
  "kleeCode.apiKey": "your-key-here"
}
```

### 4. Docker Compose로 전체 기동 (Phase 4)

```bash
docker compose up -d
```

---

## 사용 방법

1. VSCode에서 코드를 선택합니다.
2. 커맨드 팔레트(Cmd+Shift+P) → `Klee: Ask` 실행
3. 질문을 입력하면 에디터 사이드에 응답이 스트리밍됩니다.

---

## 설계 결정 요약

전체 아키텍처 결정 근거(ADR)는 [design.md](design.md)에 기록되어 있습니다.

- **ADR-1**: 클라이언트-서버 분리 — 정책 강제 지점을 서버 한 곳으로 집중
- **ADR-2**: Spring AI `ChatClient` 추상화 — `application.yml`만 바꿔 프로바이더 교체
- **ADR-3**: 컨텍스트 조회는 직접 DB 조회로 시작 → MCP로 단계적 전환
- **ADR-4**: 감사 로그에 `외부전송여부` 플래그 — 규제 감사 대응

---

## 증거 묶음

- VS Code Marketplace 등록 URL *(Phase 4 완료 후 추가)*
- GitHub 레포: 이 문서 + docker-compose + 데모 GIF
- 데모 영상 *(Phase 4 완료 후 추가)*

---

## 라이선스

MIT