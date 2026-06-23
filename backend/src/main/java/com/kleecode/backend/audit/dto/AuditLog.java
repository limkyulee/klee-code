package com.kleecode.backend.audit.dto;

import com.kleecode.backend.chat.dto.CodeContext;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * 채팅 요청 감사 로그 문서.
 */
@Document("audit_logs")
public record AuditLog(
        @Id String id,
        @Indexed String conversationId,
        @Indexed Instant createdAt,
        @Indexed AuditLogStatus status,
        Instant completedAt,
        String modelProvider,
        boolean externalTransfer,
        String filePath,
        String languageId,
        Integer selectionStartLine,
        Integer selectionStartCharacter,
        Integer selectionEndLine,
        Integer selectionEndCharacter,
        String selectedText,
        String surroundingSnippet,
        String question,
        String answer,
        String errorMessage
) {

    public static AuditLog started(
            String conversationId,
            String modelProvider,
            boolean externalTransfer,
            CodeContext context,
            String question
    ) {
        return new AuditLog(
                null,
                conversationId,
                Instant.now(),
                AuditLogStatus.STARTED,
                null,
                modelProvider,
                externalTransfer,
                context == null ? null : context.filePath(),
                context == null ? null : context.languageId(),
                context != null && context.selectionRange() != null ? context.selectionRange().startLine() : null,
                context != null && context.selectionRange() != null ? context.selectionRange().startCharacter() : null,
                context != null && context.selectionRange() != null ? context.selectionRange().endLine() : null,
                context != null && context.selectionRange() != null ? context.selectionRange().endCharacter() : null,
                context == null ? null : context.selectedText(),
                context == null ? null : context.surroundingSnippet(),
                question,
                null,
                null
        );
    }

    public AuditLog markSucceeded(String answer) {
        return new AuditLog(
                id,
                conversationId,
                createdAt,
                AuditLogStatus.SUCCEEDED,
                Instant.now(),
                modelProvider,
                externalTransfer,
                filePath,
                languageId,
                selectionStartLine,
                selectionStartCharacter,
                selectionEndLine,
                selectionEndCharacter,
                selectedText,
                surroundingSnippet,
                question,
                answer,
                null
        );
    }

    public AuditLog markFailed(String errorMessage) {
        return new AuditLog(
                id,
                conversationId,
                createdAt,
                AuditLogStatus.FAILED,
                Instant.now(),
                modelProvider,
                externalTransfer,
                filePath,
                languageId,
                selectionStartLine,
                selectionStartCharacter,
                selectionEndLine,
                selectionEndCharacter,
                selectedText,
                surroundingSnippet,
                question,
                answer,
                errorMessage
        );
    }
}
