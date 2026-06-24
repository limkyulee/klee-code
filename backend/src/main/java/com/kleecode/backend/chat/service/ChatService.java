package com.kleecode.backend.chat.service;

import com.kleecode.backend.audit.dto.AuditLog;
import com.kleecode.backend.audit.service.AuditLogService;
import com.kleecode.backend.chat.dto.ChatRequest;
import com.kleecode.backend.chat.dto.ChatStatus;
import com.kleecode.backend.modelconfig.dto.ModelConfigResponse;
import com.kleecode.backend.modelconfig.dto.UserModelConfig;
import com.kleecode.backend.modelconfig.service.ModelConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.SignalType;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 채팅 비즈니스 로직.
 *
 * <p>ChatClient(Spring AI 추상화) 를 통해 LLM 을 호출한다.
 * 호출 전 MessageChatMemoryAdvisor 가 conversationId 에 해당하는
 * 과거 대화를 MongoDB 에서 읽어 프롬프트에 주입하고,
 * 호출 후 새 턴(질문 + 응답)을 다시 MongoDB 에 저장한다.
 *
 * <p>V2부터 모델 서버는 로그인 사용자의 user_model_configs 설정으로 결정된다.
 * 설정이 없으면 기본 모델을 대신 쓰지 않고 MODEL_CONFIG_REQUIRED 오류로 차단한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    /*
     * Spring AI 2.0 에서 MessageChatMemoryAdvisor 가 advisor context 에서
     * conversationId 를 조회할 때 사용하는 키 (BaseChatMemoryAdvisor#getConversationId 참고).
    */
    private static final String CONVERSATION_ID_KEY = "chat_memory_conversation_id";

    private final AuditLogService auditLogService;
    private final ModelConfigService modelConfigService;
    private final UserOllamaChatClientFactory chatClientFactory;

    public ChatStatus status(String userId) {
        ModelConfigResponse config = modelConfigService.findResponse(userId);
        return new ChatStatus(
                config.configured(),
                config.provider() == null ? null : config.provider().name().toLowerCase(),
                config.modelName()
        );
    }

    /**
     * LLM 에 질문을 보내고 응답 텍스트를 반환한다.
     *
     * @param request conversationId, code(선택), question 을 담은 요청 DTO
     * @return LLM 응답 텍스트
     */
    public String chat(String userId, ChatRequest request) {
        UserModelConfig modelConfig = modelConfigService.requireConfig(userId);
        Optional<AuditLog> auditLog = auditLogService.start(userId, request, modelConfig.provider().name().toLowerCase(), false);

        /* advisor param 으로 conversationId 를 넘기면 MessageChatMemoryAdvisor 가
           해당 ID 의 과거 대화 이력을 프롬프트 앞에 자동으로 주입한다. */
        try {
            String answer = chatClientFactory.create(modelConfig)
                    .prompt()
                    .user(toUserMessage(request))
                    .options(ChatOptions.builder().model(modelConfig.modelName()))
                    .advisors(a -> a.param(CONVERSATION_ID_KEY, request.conversationId()))
                    .call()
                    .content();

            auditLogService.markSucceeded(auditLog, answer);
            return answer;
        } catch (RuntimeException ex) {
            auditLogService.markFailed(auditLog, ex.getMessage());
            throw ex;
        }
    }

    /**
     * LLM 응답을 조각 단위로 반환한다.
     *
     * @param request conversationId, code(선택), question 을 담은 요청 DTO
     * @return LLM 응답 텍스트 조각 스트림
     */
    public Flux<String> stream(String userId, ChatRequest request) {
        UserModelConfig modelConfig = modelConfigService.requireConfig(userId);
        Optional<AuditLog> auditLog = auditLogService.start(userId, request, modelConfig.provider().name().toLowerCase(), false);
        AtomicReference<StringBuilder> answer = new AtomicReference<>(new StringBuilder());

        log.info("Streaming chat request: conversationId={}, question={}", request.conversationId(), request.question());
        log.info("answer reference: {}", answer.get());

        return chatClientFactory.create(modelConfig)
                .prompt()
                .user(toUserMessage(request))
                .options(ChatOptions.builder().model(modelConfig.modelName()))
                .advisors(a -> a.param(CONVERSATION_ID_KEY, request.conversationId()))
                .stream()
                .content()
                .doOnNext(answerChunk -> {
                    answer.get().append(answerChunk);
                    log.info("Received answer chunk: {}", answerChunk);
                })
                .doOnError(ex -> auditLogService.markFailed(auditLog, ex.getMessage()))
                .doFinally(signalType -> {
                    if (signalType == SignalType.ON_COMPLETE) {
                        auditLogService.markSucceeded(auditLog, answer.get().toString());
                    }
                });
    }

    private String toUserMessage(ChatRequest request) {
        /* 코드가 있으면 선택 코드와 주변 컨텍스트를 함께 전달한다.
           코드가 없으면 질문만 그대로 전달한다. */
        if (request.code() == null || request.code().isBlank()) {
            return request.question();
        }

        StringBuilder message = new StringBuilder();
        if (request.context() != null) {
            if (request.context().filePath() != null && !request.context().filePath().isBlank()) {
                message.append("File: ").append(request.context().filePath()).append('\n');
            }
            if (request.context().languageId() != null && !request.context().languageId().isBlank()) {
                message.append("Language: ").append(request.context().languageId()).append('\n');
            }
        }

        message.append("Selected code:\n```\n")
                .append(request.code())
                .append("\n```\n");

        if (request.context() != null
                && request.context().surroundingSnippet() != null
                && !request.context().surroundingSnippet().isBlank()) {
            message.append("\nSurrounding context:\n```\n")
                    .append(request.context().surroundingSnippet())
                    .append("\n```\n");
        }

        message.append("\nQuestion: ").append(request.question());
        return message.toString();
    }

}
