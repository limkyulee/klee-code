# Klee Code 기술 스택

## Backend

- Java 21
- Spring Boot 4.1
- Spring Web MVC
- Spring Security
- Spring Data MongoDB
- Spring AI 2.0
- Spring AI Ollama
- Spring AI MongoDB ChatMemory
- JWT: Spring Security OAuth2 JOSE
- Password hashing: BCryptPasswordEncoder
- Build: Gradle

## Extension / Webview

- VS Code Extension API
- TypeScript
- React
- Vite
- SSE fetch streaming
- VS Code SecretStorage
- oxlint

## Infra

- MongoDB
- Docker Compose
- Ollama

## Storage

- `users`: login identity, roles, password hash
- `sessions`: refresh session state and TTL
- `user_preferences`: selected model, temperature, response language
- `audit_logs`: request/response audit trail
- `ai_chat_memory`: Spring AI conversation memory
