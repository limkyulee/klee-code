package com.kleecode.backend.conversation.dto;

import com.kleecode.backend.audit.dto.AuditLogStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("conversations")
public record Conversation(
        @Id String id,
        @Indexed String userId,
        String title,
        @Indexed AuditLogStatus status,
        @Indexed Instant createdAt,
        @Indexed Instant updatedAt,
        long turnCount
) {
    public Conversation markTurnStarted(Instant turnCreatedAt) {
        return new Conversation(
                id,
                userId,
                title,
                AuditLogStatus.STARTED,
                createdAt,
                turnCreatedAt,
                turnCount + 1
        );
    }

    public Conversation markCompleted(AuditLogStatus completedStatus, Instant completedAt) {
        return new Conversation(
                id,
                userId,
                title,
                completedStatus,
                createdAt,
                completedAt,
                turnCount
        );
    }
}
