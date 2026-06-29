# Phase 4 Demo Guide

Phase 4의 증거물은 내부 Docker Network 안에서 백엔드, MongoDB, 중앙 Ollama가 함께 기동되고 VS Code 확장이 같은 백엔드에 질의하는 화면이다.

## 1. 온프렘 스택 기동

```bash
cp .env.example .env
docker compose up -d --build
```

처음 실행할 때는 Ollama 모델 다운로드 때문에 시간이 걸린다. 기동 상태는 다음 명령으로 확인한다.

```bash
docker compose ps
curl http://localhost:8080/models
```

정상 응답 예시는 `qwen2.5-coder:14b`가 기본 모델로 표시되는 형태다.

## 2. 확장 실행

```bash
cd extension
npm install
npm run package
code .
```

VS Code에서 F5로 Extension Development Host를 열고 `klee-code.backendUrl`을 `http://localhost:8080`으로 설정한다.

## 3. GIF/영상 촬영 시나리오

1. `docker compose ps`로 `backend`, `mongodb`, `ollama`가 실행 중인 것을 보여준다.
2. VS Code에서 샘플 코드를 선택한다.
3. Klee Code 패널에서 "이 코드가 하는 일을 설명해줘"라고 질문한다.
4. 응답이 스트리밍되는 장면을 촬영한다.
5. MongoDB에 감사 로그가 저장되는 것을 확인한다.

감사 로그 확인 예시:

```bash
docker compose exec mongodb mongosh kleecode --eval 'db.audit_logs.find({}, {question: 1, modelProvider: 1, externalTransfer: 1, status: 1}).sort({createdAt: -1}).limit(3)'
```
