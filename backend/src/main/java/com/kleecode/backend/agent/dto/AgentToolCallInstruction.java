package com.kleecode.backend.agent.dto;

import java.util.Map;

public record AgentToolCallInstruction(
        String toolName,
        Map<String, Object> arguments
) {
}
