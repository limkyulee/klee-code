package com.kleecode.backend.audit.service;

import com.kleecode.backend.audit.dto.AuditLog;
import com.kleecode.backend.audit.dto.ChatHistoryItem;
import com.kleecode.backend.audit.repository.AuditLogRepository;
import com.kleecode.backend.chat.dto.ChatRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.util.List;
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
        return auditLogRepository.findTop30ByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(log -> new ChatHistoryItem(
                        log.id(),
                        log.conversationId(),
                        titleFromQuestion(log.question()),
                        log.status(),
                        log.createdAt(),
                        log.completedAt()))
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
}
