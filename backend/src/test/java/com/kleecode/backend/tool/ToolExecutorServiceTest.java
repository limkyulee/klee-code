package com.kleecode.backend.tool;

import com.kleecode.backend.permission.dto.PermissionMode;
import com.kleecode.backend.tool.dto.ToolCallRequest;
import com.kleecode.backend.tool.dto.ToolResultRequest;
import com.kleecode.backend.tool.dto.ToolResultStatus;
import com.kleecode.backend.tool.service.ToolExecutorService;
import com.kleecode.backend.tool.service.ToolPolicyService;
import com.kleecode.backend.tool.service.ToolRegistry;
import com.kleecode.backend.tool.service.ToolResultRegistry;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ToolExecutorServiceTest {

    @Test
    void removesPendingResultWhenDispatcherFails() {
        ToolResultRegistry resultRegistry = new ToolResultRegistry();
        ToolExecutorService executorService = new ToolExecutorService(
                new ToolPolicyService(new ToolRegistry()),
                resultRegistry
        );
        AtomicReference<ToolCallRequest> dispatched = new AtomicReference<>();

        assertThrows(IllegalStateException.class, () -> executorService.execute(
                "run-1",
                "read_file",
                Map.of("path", "src/App.tsx"),
                PermissionMode.ASK,
                toolCall -> {
                    dispatched.set(toolCall);
                    throw new IllegalStateException("SSE failed");
                }
        ));

        ToolCallRequest toolCall = dispatched.get();
        assertFalse(resultRegistry.complete(new ToolResultRequest(
                toolCall.runId(),
                toolCall.toolCallId(),
                ToolResultStatus.SUCCEEDED,
                "content",
                null
        )));
    }
}
