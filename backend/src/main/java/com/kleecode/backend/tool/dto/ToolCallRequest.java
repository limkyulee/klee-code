package com.kleecode.backend.tool.dto;

import java.util.Map;

public record ToolCallRequest(
        String runId,
        String toolCallId,
        String toolName,
        Map<String, Object> arguments
) {
}
