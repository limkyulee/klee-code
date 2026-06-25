package com.kleecode.backend.conversation;

import com.kleecode.backend.audit.dto.AuditLog;
import com.kleecode.backend.audit.dto.AuditLogStatus;
import com.kleecode.backend.audit.repository.AuditLogRepository;
import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.conversation.dto.Conversation;
import com.kleecode.backend.conversation.repository.ConversationRepository;
import com.kleecode.backend.conversation.service.ConversationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private ChatMemory chatMemory;

    @InjectMocks
    private ConversationService conversationService;

    @Test
    void recordTurnStartedCreatesConversationForFirstQuestion() {
        Instant createdAt = Instant.parse("2026-06-25T01:00:00Z");
        when(conversationRepository.findByIdAndUserId("conversation-1", "user-1")).thenReturn(Optional.empty());

        conversationService.recordTurnStarted(auditLog(
                "log-1",
                "user-1",
                "conversation-1",
                createdAt,
                AuditLogStatus.STARTED,
                null,
                "Explain this code",
                null,
                null
        ));

        ArgumentCaptor<Conversation> captor = ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());

        assertEquals("conversation-1", captor.getValue().id());
        assertEquals("user-1", captor.getValue().userId());
        assertEquals("Explain this code", captor.getValue().title());
        assertEquals(AuditLogStatus.STARTED, captor.getValue().status());
        assertEquals(createdAt, captor.getValue().createdAt());
        assertEquals(createdAt, captor.getValue().updatedAt());
        assertEquals(1, captor.getValue().turnCount());
    }

    @Test
    void recordTurnStartedUpdatesExistingConversationMetadata() {
        Instant firstCreatedAt = Instant.parse("2026-06-25T01:00:00Z");
        Instant nextCreatedAt = Instant.parse("2026-06-25T01:10:00Z");
        when(conversationRepository.findByIdAndUserId("conversation-1", "user-1"))
                .thenReturn(Optional.of(new Conversation(
                        "conversation-1",
                        "user-1",
                        "First title",
                        AuditLogStatus.SUCCEEDED,
                        firstCreatedAt,
                        firstCreatedAt.plusSeconds(20),
                        1
                )));

        conversationService.recordTurnStarted(auditLog(
                "log-2",
                "user-1",
                "conversation-1",
                nextCreatedAt,
                AuditLogStatus.STARTED,
                null,
                "Follow up",
                null,
                null
        ));

        ArgumentCaptor<Conversation> captor = ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());

        assertEquals("First title", captor.getValue().title());
        assertEquals(AuditLogStatus.STARTED, captor.getValue().status());
        assertEquals(nextCreatedAt, captor.getValue().updatedAt());
        assertEquals(2, captor.getValue().turnCount());
    }

    @Test
    void recentConversationsBackfillsAuditLogOnlyConversations() {
        Instant firstCreatedAt = Instant.parse("2026-06-25T01:00:00Z");
        Instant completedAt = Instant.parse("2026-06-25T01:01:00Z");
        Conversation backfilled = new Conversation(
                "conversation-1",
                "user-1",
                "First question",
                AuditLogStatus.SUCCEEDED,
                firstCreatedAt,
                completedAt,
                1
        );

        when(conversationRepository.findByUserId("user-1")).thenReturn(List.of());
        when(auditLogRepository.findByUserIdOrderByCreatedAtDesc("user-1")).thenReturn(List.of(auditLog(
                "log-1",
                "user-1",
                "conversation-1",
                firstCreatedAt,
                AuditLogStatus.SUCCEEDED,
                completedAt,
                "First question",
                "answer",
                null
        )));
        when(conversationRepository.findByUserIdOrderByUpdatedAtDesc(eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of(backfilled));

        var history = conversationService.recentConversations("user-1");

        ArgumentCaptor<Conversation> captor = ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());
        assertEquals("conversation-1", captor.getValue().id());
        assertEquals("First question", captor.getValue().title());
        assertEquals(completedAt, captor.getValue().updatedAt());
        assertEquals(1, history.size());
        assertEquals("conversation-1", history.getFirst().conversationId());
    }

    @Test
    void detailBuildsMessagesFromAuditLogsInOrder() {
        Instant firstCreatedAt = Instant.parse("2026-06-25T01:00:00Z");
        Instant firstCompletedAt = Instant.parse("2026-06-25T01:01:00Z");
        Instant failedCreatedAt = Instant.parse("2026-06-25T01:10:00Z");
        Instant failedCompletedAt = Instant.parse("2026-06-25T01:11:00Z");

        when(conversationRepository.findByIdAndUserId("conversation-1", "user-1"))
                .thenReturn(Optional.of(new Conversation(
                        "conversation-1",
                        "user-1",
                        "First question",
                        AuditLogStatus.FAILED,
                        firstCreatedAt,
                        failedCompletedAt,
                        2
                )));
        when(auditLogRepository.findByUserIdAndConversationIdOrderByCreatedAtAsc("user-1", "conversation-1"))
                .thenReturn(List.of(
                        auditLog(
                                "log-1",
                                "user-1",
                                "conversation-1",
                                firstCreatedAt,
                                AuditLogStatus.SUCCEEDED,
                                firstCompletedAt,
                                "First question",
                                "First answer",
                                null
                        ),
                        auditLog(
                                "log-2",
                                "user-1",
                                "conversation-1",
                                failedCreatedAt,
                                AuditLogStatus.FAILED,
                                failedCompletedAt,
                                "Broken follow up",
                                null,
                                "boom"
                        )
                ));

        var detail = conversationService.detail("user-1", "conversation-1");

        assertEquals("conversation-1", detail.conversationId());
        assertEquals(4, detail.messages().size());
        assertEquals("user", detail.messages().get(0).role());
        assertEquals("First question", detail.messages().get(0).text());
        assertEquals("assistant", detail.messages().get(1).role());
        assertEquals("First answer", detail.messages().get(1).text());
        assertEquals("user", detail.messages().get(2).role());
        assertEquals("error", detail.messages().get(3).role());
        assertEquals("boom", detail.messages().get(3).text());
    }

    @Test
    void detailRejectsMissingOrOtherUsersConversation() {
        when(conversationRepository.findByIdAndUserId("conversation-1", "user-1")).thenReturn(Optional.empty());

        ApiException exception = assertThrows(
                ApiException.class,
                () -> conversationService.detail("user-1", "conversation-1")
        );

        assertEquals("CONVERSATION_NOT_FOUND", exception.code());
        verify(auditLogRepository, never()).findByUserIdAndConversationIdOrderByCreatedAtAsc(any(), any());
    }

    @Test
    void deleteConversationRemovesConversationAuditLogsAndChatMemory() {
        when(conversationRepository.findByIdAndUserId("conversation-1", "user-1"))
                .thenReturn(Optional.of(new Conversation(
                        "conversation-1",
                        "user-1",
                        "Title",
                        AuditLogStatus.SUCCEEDED,
                        Instant.parse("2026-06-25T01:00:00Z"),
                        Instant.parse("2026-06-25T01:01:00Z"),
                        1
                )));

        conversationService.deleteConversation("user-1", "conversation-1");

        verify(conversationRepository).deleteById("conversation-1");
        verify(auditLogRepository).deleteByUserIdAndConversationId("user-1", "conversation-1");
        verify(chatMemory).clear("conversation-1");
    }

    private AuditLog auditLog(
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
        return new AuditLog(
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
