package com.kleecode.backend.agent.dto;

import com.kleecode.backend.chat.dto.CodeContext;
import com.kleecode.backend.chat.dto.KleeContext;
import com.kleecode.backend.chat.dto.SkillCommand;

public record AgentRequest(
        String conversationId,
        String code,
        String question,
        CodeContext context,
        SkillCommand skillCommand,
        KleeContext kleeContext,
        String permissionMode
) {
}
