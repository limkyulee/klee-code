package com.kleecode.backend.conversation.service;

import com.kleecode.backend.audit.dto.AuditLog;
import com.kleecode.backend.audit.dto.AuditLogStatus;
import com.kleecode.backend.audit.dto.ChatHistoryItem;
import com.kleecode.backend.audit.repository.AuditLogRepository;
import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.conversation.dto.Conversation;
import com.kleecode.backend.conversation.dto.ConversationDetailResponse;
import com.kleecode.backend.conversation.dto.ConversationMessageResponse;
import com.kleecode.backend.conversation.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private static final int HISTORY_LIMIT = 30;

    private final ConversationRepository conversationRepository;
    private final AuditLogRepository auditLogRepository;
    private final ChatMemory chatMemory;

    public List<ChatHistoryItem> recentConversations(String userId) {
        backfillMissingConversations(userId);

        return conversationRepository.findByUserIdOrderByUpdatedAtDesc(userId, PageRequest.of(0, HISTORY_LIMIT))
                .stream()
                .map(this::toHistoryItem)
                .toList();
    }

    public ConversationDetailResponse detail(String userId, String conversationId) {
        requireOwnedConversation(userId, conversationId);

        List<ConversationMessageResponse> messages = new ArrayList<>();
        for (AuditLog log : auditLogRepository.findByUserIdAndConversationIdOrderByCreatedAtAsc(userId, conversationId)) {
            if (log.question() != null && !log.question().isBlank()) {
                messages.add(new ConversationMessageResponse("user", log.question(), log.createdAt(), log.status()));
            }
            if (log.status() == AuditLogStatus.SUCCEEDED && log.answer() != null && !log.answer().isBlank()) {
                messages.add(new ConversationMessageResponse("assistant", log.answer(), messageCreatedAt(log), log.status()));
            }
            if (log.status() == AuditLogStatus.FAILED) {
                messages.add(new ConversationMessageResponse(
                        "error",
                        errorText(log),
                        messageCreatedAt(log),
                        log.status()
                ));
            }
        }

        return new ConversationDetailResponse(conversationId, messages);
    }

    public void recordTurnStarted(AuditLog auditLog) {
        if (auditLog.conversationId() == null || auditLog.conversationId().isBlank()) {
            return;
        }

        Conversation conversation = conversationRepository.findByIdAndUserId(auditLog.conversationId(), auditLog.userId())
                .map(existing -> existing.markTurnStarted(auditLog.createdAt()))
                .orElseGet(() -> new Conversation(
                        auditLog.conversationId(),
                        auditLog.userId(),
                        titleFromQuestion(auditLog.question()),
                        AuditLogStatus.STARTED,
                        auditLog.createdAt(),
                        auditLog.createdAt(),
                        1
                ));

        conversationRepository.save(conversation);
    }

    public void recordTurnCompleted(AuditLog auditLog) {
        if (auditLog.conversationId() == null || auditLog.conversationId().isBlank()) {
            return;
        }

        Conversation conversation = conversationRepository.findByIdAndUserId(auditLog.conversationId(), auditLog.userId())
                .orElseGet(() -> new Conversation(
                        auditLog.conversationId(),
                        auditLog.userId(),
                        titleFromQuestion(auditLog.question()),
                        auditLog.status(),
                        auditLog.createdAt(),
                        messageCreatedAt(auditLog),
                        1
                ));

        conversationRepository.save(conversation.markCompleted(auditLog.status(), messageCreatedAt(auditLog)));
    }

    public void deleteConversation(String userId, String conversationId) {
        requireOwnedConversation(userId, conversationId);

        conversationRepository.deleteById(conversationId);
        auditLogRepository.deleteByUserIdAndConversationId(userId, conversationId);
        chatMemory.clear(conversationId);
    }

    private void backfillMissingConversations(String userId) {
        Set<String> existingConversationIds = conversationRepository.findByUserId(userId)
                .stream()
                .map(Conversation::id)
                .collect(Collectors.toSet());

        Map<String, ConversationSummary> summaries = new LinkedHashMap<>();
        for (AuditLog log : auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            if (log.conversationId() == null || log.conversationId().isBlank()) {
                continue;
            }
            if (existingConversationIds.contains(log.conversationId())) {
                continue;
            }
            summaries.computeIfAbsent(log.conversationId(), ConversationSummary::new).accept(log);
        }

        summaries.values()
                .stream()
                .map(ConversationSummary::toConversation)
                .forEach(conversationRepository::save);
    }

    private Conversation requireOwnedConversation(String userId, String conversationId) {
        return conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "CONVERSATION_NOT_FOUND",
                        "Conversation not found"
                ));
    }

    private ChatHistoryItem toHistoryItem(Conversation conversation) {
        return new ChatHistoryItem(
                conversation.id(),
                conversation.id(),
                conversation.title(),
                conversation.status(),
                conversation.createdAt(),
                conversation.updatedAt(),
                conversation.turnCount()
        );
    }

    private Instant messageCreatedAt(AuditLog log) {
        return log.completedAt() == null ? log.createdAt() : log.completedAt();
    }

    private String errorText(AuditLog log) {
        return log.errorMessage() == null || log.errorMessage().isBlank()
                ? "Request failed"
                : log.errorMessage();
    }

    private String titleFromQuestion(String question) {
        if (question == null || question.isBlank()) {
            return "Untitled conversation";
        }

        String compact = question.replaceAll("\\s+", " ").trim();
        return compact.length() <= 80 ? compact : compact.substring(0, 77) + "...";
    }

    private class ConversationSummary {
        private final String conversationId;
        private String userId;
        private String title = "Untitled conversation";
        private AuditLogStatus status = AuditLogStatus.STARTED;
        private Instant createdAt;
        private Instant latestTurnCreatedAt;
        private Instant updatedAt;
        private long turnCount;

        private ConversationSummary(String conversationId) {
            this.conversationId = conversationId;
        }

        private void accept(AuditLog log) {
            userId = log.userId();
            turnCount++;

            if (createdAt == null || isBefore(log.createdAt(), createdAt)) {
                createdAt = log.createdAt();
                title = titleFromQuestion(log.question());
            }

            Instant logUpdatedAt = messageCreatedAt(log);
            if (updatedAt == null || isAfter(logUpdatedAt, updatedAt)) {
                updatedAt = logUpdatedAt;
            }

            if (latestTurnCreatedAt == null || isAfterOrEqual(log.createdAt(), latestTurnCreatedAt)) {
                latestTurnCreatedAt = log.createdAt();
                status = log.status();
            }
        }

        private Conversation toConversation() {
            return new Conversation(
                    conversationId,
                    userId,
                    title,
                    status,
                    createdAt,
                    updatedAt == null ? createdAt : updatedAt,
                    turnCount
            );
        }

        private boolean isBefore(Instant candidate, Instant baseline) {
            return candidate != null && (baseline == null || candidate.isBefore(baseline));
        }

        private boolean isAfter(Instant candidate, Instant baseline) {
            return candidate != null && (baseline == null || candidate.isAfter(baseline));
        }

        private boolean isAfterOrEqual(Instant candidate, Instant baseline) {
            return candidate != null && (baseline == null || !candidate.isBefore(baseline));
        }
    }
}
