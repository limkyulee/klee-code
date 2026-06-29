package com.kleecode.backend.chat.service;

import com.kleecode.backend.audit.dto.AuditLog;
import com.kleecode.backend.audit.service.AuditLogService;
import com.kleecode.backend.chat.dto.ChatRequest;
import com.kleecode.backend.chat.dto.ChatStatus;
import com.kleecode.backend.conversation.service.ConversationService;
import com.kleecode.backend.llm.dto.EffectiveLlmSettings;
import com.kleecode.backend.llm.service.LLMGateway;
import com.kleecode.backend.preference.service.UserPreferenceService;
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
 * <p>모델 서버는 중앙 LLM Gateway 설정으로만 결정된다. 사용자는 운영자가 허용한
 * 모델 중 하나와 응답 성향만 선택할 수 있으며, 서버 URL은 저장하거나 입력하지 않는다.
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
    private final ConversationService conversationService;
    private final UserPreferenceService userPreferenceService;
    private final LLMGateway llmGateway;
    private final ChatModelExceptionMapper exceptionMapper;

    public ChatStatus status(String userId) {
        EffectiveLlmSettings settings = userPreferenceService.effectiveSettings(userId);
        return new ChatStatus(
                true,
                settings.provider(),
                settings.modelName()
        );
    }

    /**
     * LLM 에 질문을 보내고 응답 텍스트를 반환한다.
     *
     * @param request conversationId, code(선택), question 을 담은 요청 DTO
     * @return LLM 응답 텍스트
     */
    public String chat(String userId, ChatRequest request) {
        EffectiveLlmSettings settings = userPreferenceService.effectiveSettings(userId);
        Optional<AuditLog> auditLog = auditLogService.start(userId, request, settings.provider(), false);
        auditLog.ifPresent(conversationService::recordTurnStarted);

        /* advisor param 으로 conversationId 를 넘기면 MessageChatMemoryAdvisor 가
           해당 ID 의 과거 대화 이력을 프롬프트 앞에 자동으로 주입한다. */
        try {
            String answer = llmGateway.chatClient()
                    .prompt()
                    .user(toUserMessage(request, settings))
                    .options(ChatOptions.builder()
                            .model(settings.modelName())
                            .temperature(settings.temperature()))
                    .advisors(a -> a.param(CONVERSATION_ID_KEY, request.conversationId()))
                    .call()
                    .content();

            auditLogService.markSucceeded(auditLog, answer).ifPresent(conversationService::recordTurnCompleted);
            return answer;
        } catch (RuntimeException ex) {
            RuntimeException mappedException = exceptionMapper.map(ex);
            auditLogService.markFailed(auditLog, mappedException.getMessage()).ifPresent(conversationService::recordTurnCompleted);
            throw mappedException;
        }
    }

    /**
     * LLM 응답을 조각 단위로 반환한다.
     *
     * @param request conversationId, code(선택), question 을 담은 요청 DTO
     * @return LLM 응답 텍스트 조각 스트림
     */
    public Flux<String> stream(String userId, ChatRequest request) {
        EffectiveLlmSettings settings = userPreferenceService.effectiveSettings(userId);
        Optional<AuditLog> auditLog = auditLogService.start(userId, request, settings.provider(), false);
        auditLog.ifPresent(conversationService::recordTurnStarted);
        AtomicReference<StringBuilder> answer = new AtomicReference<>(new StringBuilder());

        log.info("Streaming chat request: conversationId={}, question={}", request.conversationId(), request.question());
        log.info("answer reference: {}", answer.get());

        return llmGateway.chatClient()
                .prompt()
                .user(toUserMessage(request, settings))
                .options(ChatOptions.builder()
                        .model(settings.modelName())
                        .temperature(settings.temperature()))
                .advisors(a -> a.param(CONVERSATION_ID_KEY, request.conversationId()))
                .stream()
                .content()
                .doOnNext(answerChunk -> {
                    answer.get().append(answerChunk);
                    log.info("Received answer chunk: {}", answerChunk);
                })
                .onErrorMap(exceptionMapper::map)
                .doOnError(ex -> auditLogService.markFailed(auditLog, ex.getMessage())
                        .ifPresent(conversationService::recordTurnCompleted))
                .doFinally(signalType -> {
                    if (signalType == SignalType.ON_COMPLETE) {
                        auditLogService.markSucceeded(auditLog, answer.get().toString())
                                .ifPresent(conversationService::recordTurnCompleted);
                    }
                });
    }

    private String toUserMessage(ChatRequest request, EffectiveLlmSettings settings) {
        /* 코드가 있으면 선택 코드와 주변 컨텍스트를 함께 전달한다.
           코드가 없으면 질문만 그대로 전달한다. */
        String languageInstruction = "Respond in " + settings.responseLanguage() + ".\n\n";
        if (request.code() == null || request.code().isBlank()) {
            return languageInstruction + request.question();
        }

        StringBuilder message = new StringBuilder(languageInstruction);
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
