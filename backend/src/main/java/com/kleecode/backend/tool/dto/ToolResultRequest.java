package com.kleecode.backend.tool.dto;

public record ToolResultRequest(
        String runId,
        String toolCallId,
        String status,
        String result,
        String errorMessage
) {
}
