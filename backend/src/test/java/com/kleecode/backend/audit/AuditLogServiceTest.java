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

        var saved = auditLogService.start("user-1", request, "ollama", false);

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

        var saved = auditLogService.start("user-3", request, "ollama", false);
        var updated = auditLogService.markFailed(saved, "boom");

        assertTrue(saved.isPresent());
        assertTrue(updated.isPresent());
        assertEquals(AuditLogStatus.STARTED, saved.get().status());
        assertEquals(AuditLogStatus.FAILED, updated.get().status());
        assertEquals("boom", updated.get().errorMessage());
    }

}
