package com.kleecode.backend.conversation.dto;

import java.util.List;

public record ConversationDetailResponse(
        String conversationId,
        List<ConversationMessageResponse> messages
) {
}
