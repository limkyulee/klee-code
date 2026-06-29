# klee-code — On-Premise AI Coding Assistant

기업 내부망에서 운영되는 중앙 Ollama 서버를 사용하는 **보안형 AI Coding Assistant**.

코드와 데이터가 보안 경계를 벗어나지 않으면서, 동일한 사용자 경험을 제공하는 구조를 직접 설계하고 구현한 포트폴리오 프로젝트입니다.

---

## 핵심 가치

- **중앙 LLM Gateway** — Spring Boot가 운영자 설정의 Ollama 서버만 호출
- **데이터 보안 경계** — 소스코드와 프로젝트 문서를 외부 AI 서비스로 전송하지 않음
- **승인 모델 선택** — 사용자는 허용된 모델 목록에서 기본 모델만 선택

---

## 아키텍처

```
[ VSCode 확장 (TypeScript) ]    ← 얇은 클라이언트
        │ HTTP / SSE
        ▼
┌─────────────────────────────────────────────┐
│  온프렘 서버 (보안 경계)                        │
│                                              │
│   [ Spring 백엔드 ]                         │
│        │                  │                 │
│        ▼                  ▼                 │
│   [ 컨텍스트 조회 ]   [ Internal LLM Gateway ]│
│        │                  │                 │
│        ▼                  ▼                 │
│   [ DB (MongoDB) ]    [ Ollama (중앙 서버) ] │
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
| LLM Gateway | Spring AI Ollama |
| LLM 서버 | Ollama (`qwen2.5-coder:14b`) |
| DB | MongoDB |
| 패키징 | Docker Compose |

---

## 모델 전략

| 구분 | 모델 | 데이터 경계 |
|------|------|-------------|
| 기본 | `qwen2.5-coder:14b` (Ollama) | 경계 안 — 중앙 Ollama 서버에서 실행 |
| 선택 가능 | `deepseek-coder` 등 운영자가 허용한 모델 | 경계 안 |
| 프로덕션(참고) | GPU 서버의 Qwen / DeepSeek 계열 | 경계 안 |

> 개발 환경: M1 / 16GB. `3b`는 Metal 가속으로 무난, `35b`(24GB)는 미지원.

---

## 구현 단계

- [x] **Phase 0** — 뼈대: 확장 명령 1개 + `POST /chat` + ChatClient (end-to-end)
- [x] **Phase 1** — 중앙 Ollama Gateway 연결
- [ ] **Phase 2** — MCP: 직접 DB 조회 → MCP 서버/도구로 승격
- [x] **Phase 3** — 컨텍스트 & 감사 로그: 코드 컨텍스트 수집, 로그 저장
- [ ] **Phase 4** — 온프렘 패키징: docker-compose 완료, 데모 GIF 촬영 전

---

## 빠른 시작

### 사전 요구 사항

- Java 21+
- Node.js 20+
- Docker & Docker Compose
- Docker & Docker Compose

### 1. Ollama 모델 다운로드

```bash
ollama pull qwen2.5-coder:14b
```

### 2. 백엔드 실행

```bash
cd backend
./gradlew bootRun
```

`src/main/resources/application.yml`에서 중앙 LLM Gateway를 설정합니다.

```yaml
klee:
  llm:
    provider: ollama
    base-url: ${KLEE_LLM_BASE_URL:http://ollama:11434}
    default-model: ${KLEE_LLM_DEFAULT_MODEL:qwen2.5-coder:14b}
    models:
      - name: qwen2.5-coder:14b
        display-name: Qwen 2.5 Coder
        default: true
      - name: deepseek-coder
        display-name: DeepSeek Coder
```

### 3. VSCode 확장 설치

```bash
cd extension
npm install
npm run compile
```

F5로 Extension Development Host를 실행하거나, `.vsix`로 패키지 후 설치합니다.

VSCode 설정에서 백엔드 URL을 입력합니다.

```json
{
  "klee-code.backendUrl": "http://localhost:8080"
}
```

### 4. Docker Compose로 전체 기동 (Phase 4)

Compose는 백엔드, MongoDB, Ollama, Ollama 모델 pull 작업을 같은 내부 Docker Network에서 실행합니다.

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:8080/models
```

기본값은 온프렘 중앙 Ollama 모델입니다.

```dotenv
KLEE_LLM_DEFAULT_MODEL=qwen2.5-coder:14b
KLEE_LLM_MODEL_TO_PULL=qwen2.5-coder:14b
```

데모 GIF/영상 촬영 절차는 [docs/demo.md](docs/demo.md)에 정리되어 있습니다.

---

## 사용 방법

1. VSCode에서 코드를 선택합니다.
2. 커맨드 팔레트(Cmd+Shift+P) → `Klee: Ask` 실행
3. 질문을 입력하면 에디터 사이드에 응답이 스트리밍됩니다.

---

## 설계 결정 요약

전체 아키텍처 결정 근거(ADR)는 [DESIGN.md](DESIGN.md)에 기록되어 있습니다.

- **ADR-1**: 클라이언트-서버 분리 — 정책 강제 지점을 서버 한 곳으로 집중
- **ADR-2**: 중앙 LLM Gateway — 운영자 설정의 Ollama 서버만 호출
- **ADR-3**: 컨텍스트 조회는 직접 DB 조회로 시작 → MCP로 단계적 전환
- **ADR-4**: 감사 로그에 `외부전송여부=false` 기록 — 규제 감사 대응

---

## 증거 묶음

- VS Code Marketplace 등록 URL *(Phase 4 완료 후 추가)*
- GitHub 레포: 이 문서 + docker-compose + 데모 GIF
- 데모 영상/GIF *(촬영 후 추가)*

---

## 라이선스

MIT
