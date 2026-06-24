package com.kleecode.backend.audit.service;

import com.kleecode.backend.audit.dto.AuditLog;
import com.kleecode.backend.audit.dto.AuditLogStatus;
import com.kleecode.backend.audit.dto.ChatHistoryItem;
import com.kleecode.backend.audit.repository.AuditLogRepository;
import com.kleecode.backend.chat.dto.ChatRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 감사 로그 저장 서비스.
 *
 * <p>감사 로그 실패가 채팅 응답 자체를 망가뜨리지 않도록 예외를 삼킨다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public Optional<AuditLog> start(String userId, ChatRequest request, String modelProvider, boolean externalTransfer) {
        return saveSafely(AuditLog.started(
                userId,
                request.conversationId(),
                modelProvider,
                externalTransfer,
                request.context(),
                request.question()));
    }

    public Optional<AuditLog> markSucceeded(Optional<AuditLog> auditLog, String answer) {
        return auditLog.flatMap(log -> saveSafely(log.markSucceeded(answer)));
    }

    public Optional<AuditLog> markFailed(Optional<AuditLog> auditLog, String errorMessage) {
        return auditLog.flatMap(log -> saveSafely(log.markFailed(errorMessage)));
    }

    public List<ChatHistoryItem> recentChatHistory(String userId) {
        Map<String, ConversationSummary> summaries = new LinkedHashMap<>();

        for (AuditLog log : auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            if (log.conversationId() == null || log.conversationId().isBlank()) {
                continue;
            }

            summaries.computeIfAbsent(log.conversationId(), ConversationSummary::new).accept(log);
        }

        return summaries.values()
                .stream()
                .sorted(Comparator.comparing(ConversationSummary::updatedAt).reversed())
                .limit(30)
                .map(ConversationSummary::toHistoryItem)
                .toList();
    }

    private Optional<AuditLog> saveSafely(AuditLog auditLog) {
        try {
            return Optional.of(auditLogRepository.save(auditLog));
        } catch (DataAccessException ex) {
            log.warn("Failed to persist audit log: {}", ex.getMessage());
            return Optional.empty();
        } catch (RuntimeException ex) {
            log.warn("Failed to persist audit log: {}", ex.getMessage());
            return Optional.empty();
        }
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
            turnCount++;

            if (createdAt == null || isBefore(log.createdAt(), createdAt)) {
                createdAt = log.createdAt();
                title = titleFromQuestion(log.question());
            }

            Instant logUpdatedAt = log.completedAt() == null ? log.createdAt() : log.completedAt();
            if (updatedAt == null || isAfter(logUpdatedAt, updatedAt)) {
                updatedAt = logUpdatedAt;
            }

            if (latestTurnCreatedAt == null || isAfterOrEqual(log.createdAt(), latestTurnCreatedAt)) {
                latestTurnCreatedAt = log.createdAt();
                status = log.status();
            }
        }

        private Instant updatedAt() {
            return updatedAt == null ? Instant.EPOCH : updatedAt;
        }

        private ChatHistoryItem toHistoryItem() {
            return new ChatHistoryItem(
                    conversationId,
                    conversationId,
                    title,
                    status,
                    createdAt,
                    updatedAt,
                    turnCount);
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
