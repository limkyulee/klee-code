package com.kleecode.backend.tool.dto;

public record ToolResultRequest(
        String runId,
        String toolCallId,
        ToolResultStatus status,
        String result,
        String errorMessage
) {
}
