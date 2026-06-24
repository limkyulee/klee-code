package com.kleecode.backend.audit.dto;

import java.time.Instant;

public record ChatHistoryItem(
        String id,
        String conversationId,
        String title,
        AuditLogStatus status,
        Instant createdAt,
        Instant updatedAt,
        long turnCount
) {
}
