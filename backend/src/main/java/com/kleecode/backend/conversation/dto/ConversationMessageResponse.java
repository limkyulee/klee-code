package com.kleecode.backend.conversation.dto;

import com.kleecode.backend.audit.dto.AuditLogStatus;

import java.time.Instant;

public record ConversationMessageResponse(
        String role,
        String text,
        Instant createdAt,
        AuditLogStatus status
) {
}
