package com.kleecode.backend.conversation.controller;

import com.kleecode.backend.audit.dto.ChatHistoryItem;
import com.kleecode.backend.conversation.dto.ConversationDetailResponse;
import com.kleecode.backend.conversation.service.ConversationService;
import com.kleecode.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping
    public ResponseEntity<List<ChatHistoryItem>> recentConversations(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(conversationService.recentConversations(user.userId()));
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<ConversationDetailResponse> detail(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String conversationId
    ) {
        return ResponseEntity.ok(conversationService.detail(user.userId(), conversationId));
    }

    @DeleteMapping("/{conversationId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String conversationId
    ) {
        conversationService.deleteConversation(user.userId(), conversationId);
        return ResponseEntity.noContent().build();
    }
}
