package com.kleecode.backend.audit.controller;

import com.kleecode.backend.audit.dto.ChatHistoryItem;
import com.kleecode.backend.conversation.service.ConversationService;
import com.kleecode.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/audit")
@RequiredArgsConstructor
public class AuditHistoryController {

    private final ConversationService conversationService;

    @GetMapping("/chat-history")
    public ResponseEntity<List<ChatHistoryItem>> chatHistory(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(conversationService.recentConversations(user.userId()));
    }
}
