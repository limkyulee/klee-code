package com.kleecode.backend.agent.service;

import com.kleecode.backend.tool.dto.ToolCallRequest;

public interface AgentEventSink {
    void progress(String text);

    void token(String text);

    void toolCallRequested(ToolCallRequest toolCall);
}
