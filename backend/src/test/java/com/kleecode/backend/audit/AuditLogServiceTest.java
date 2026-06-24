package com.kleecode.backend.audit;

import com.kleecode.backend.audit.dto.AuditLogStatus;
import com.kleecode.backend.audit.repository.AuditLogRepository;
import com.kleecode.backend.audit.service.AuditLogService;
import com.kleecode.backend.chat.dto.ChatRequest;
import com.kleecode.backend.chat.dto.CodeContext;
import com.kleecode.backend.chat.dto.SelectionRange;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest
class AuditLogServiceTest {

    @MockitoBean
    private AuditLogRepository auditLogRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Test
    void startPersistsStartedAuditLogWithContext() {
        when(auditLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ChatRequest request = new ChatRequest(
                "conversation-1",
                "selected code",
                "Explain this",
                new CodeContext(
                        "/workspace/src/example.ts",
                        "typescript",
                        new SelectionRange(1, 2, 2, 4),
                        "selected code",
                        "line-1\nline-2"
                )
        );

        var saved = auditLogService.start("user-1", request, "anthropic", true);

        assertTrue(saved.isPresent());
        assertEquals(AuditLogStatus.STARTED, saved.get().status());
        assertEquals("user-1", saved.get().userId());
        assertEquals("conversation-1", saved.get().conversationId());
        assertEquals("selected code", saved.get().selectedText());
        assertEquals("/workspace/src/example.ts", saved.get().filePath());
        verify(auditLogRepository).save(any());
    }

    @Test
    void markSucceededUpdatesSavedAuditLog() {
        when(auditLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ChatRequest request = new ChatRequest("conversation-2", null, "Explain this", null);

        var saved = auditLogService.start("user-2", request, "ollama", false);
        var updated = auditLogService.markSucceeded(saved, "answer");

        assertTrue(saved.isPresent());
        assertTrue(updated.isPresent());
        assertEquals(AuditLogStatus.STARTED, saved.get().status());
        assertEquals(AuditLogStatus.SUCCEEDED, updated.get().status());
        assertEquals("answer", updated.get().answer());
        assertFalse(updated.get().externalTransfer());
    }

    @Test
    void markFailedUpdatesSavedAuditLog() {
        when(auditLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ChatRequest request = new ChatRequest("conversation-3", null, "Explain this", null);

        var saved = auditLogService.start("user-3", request, "anthropic", true);
        var updated = auditLogService.markFailed(saved, "boom");

        assertTrue(saved.isPresent());
        assertTrue(updated.isPresent());
        assertEquals(AuditLogStatus.STARTED, saved.get().status());
        assertEquals(AuditLogStatus.FAILED, updated.get().status());
        assertEquals("boom", updated.get().errorMessage());
    }

    @Test
    void recentChatHistoryGroupsAuditLogsByConversation() {
        Instant firstCreatedAt = Instant.parse("2026-06-24T01:00:00Z");
        Instant secondCreatedAt = Instant.parse("2026-06-24T01:10:00Z");
        Instant secondCompletedAt = Instant.parse("2026-06-24T01:11:00Z");
        Instant failedCreatedAt = Instant.parse("2026-06-24T02:00:00Z");
        Instant failedCompletedAt = Instant.parse("2026-06-24T02:01:00Z");

        when(auditLogRepository.findByUserIdOrderByCreatedAtDesc("user-1")).thenReturn(List.of(
                auditLog(
                        "log-3",
                        "user-1",
                        "conversation-2",
                        failedCreatedAt,
                        AuditLogStatus.FAILED,
                        failedCompletedAt,
                        "Second conversation",
                        null,
                        "boom"),
                auditLog(
                        "log-2",
                        "user-1",
                        "conversation-1",
                        secondCreatedAt,
                        AuditLogStatus.SUCCEEDED,
                        secondCompletedAt,
                        "Follow up question",
                        "follow up answer",
                        null),
                auditLog(
                        "log-1",
                        "user-1",
                        "conversation-1",
                        firstCreatedAt,
                        AuditLogStatus.SUCCEEDED,
                        Instant.parse("2026-06-24T01:01:00Z"),
                        "First question",
                        "first answer",
                        null)
        ));

        var history = auditLogService.recentChatHistory("user-1");

        assertEquals(2, history.size());

        assertEquals("conversation-2", history.get(0).id());
        assertEquals("conversation-2", history.get(0).conversationId());
        assertEquals("Second conversation", history.get(0).title());
        assertEquals(AuditLogStatus.FAILED, history.get(0).status());
        assertEquals(failedCreatedAt, history.get(0).createdAt());
        assertEquals(failedCompletedAt, history.get(0).updatedAt());
        assertEquals(1, history.get(0).turnCount());

        assertEquals("conversation-1", history.get(1).id());
        assertEquals("First question", history.get(1).title());
        assertEquals(AuditLogStatus.SUCCEEDED, history.get(1).status());
        assertEquals(firstCreatedAt, history.get(1).createdAt());
        assertEquals(secondCompletedAt, history.get(1).updatedAt());
        assertEquals(2, history.get(1).turnCount());
    }

    private com.kleecode.backend.audit.dto.AuditLog auditLog(
            String id,
            String userId,
            String conversationId,
            Instant createdAt,
            AuditLogStatus status,
            Instant completedAt,
            String question,
            String answer,
            String errorMessage
    ) {
        return new com.kleecode.backend.audit.dto.AuditLog(
                id,
                userId,
                conversationId,
                createdAt,
                status,
                completedAt,
                "ollama",
                false,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                question,
                answer,
                errorMessage
        );
    }
}
