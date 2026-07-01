package com.kleecode.backend.tool.service;

import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.permission.dto.PermissionMode;
import com.kleecode.backend.tool.dto.ToolCallRequest;
import com.kleecode.backend.tool.dto.ToolResultRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletionException;
import java.util.function.Consumer;

@Service
@RequiredArgsConstructor
public class ToolExecutorService {

    private final ToolPolicyService toolPolicyService;
    private final ToolResultRegistry toolResultRegistry;

    public ToolResultRequest execute(
            String runId,
            String toolName,
            Map<String, Object> arguments,
            PermissionMode permissionMode,
            Consumer<ToolCallRequest> dispatcher
    ) {
        if (!toolPolicyService.canRunWithoutApproval(toolName, permissionMode)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "TOOL_NOT_ALLOWED",
                    "Tool is not allowed in the current agent policy: " + toolName
            );
        }

        String toolCallId = UUID.randomUUID().toString();
        ToolCallRequest toolCall = new ToolCallRequest(runId, toolCallId, toolName, arguments);
        var resultFuture = toolResultRegistry.register(runId, toolCallId);
        dispatcher.accept(toolCall);

        try {
            return resultFuture.join();
        } catch (CompletionException ex) {
            if (ToolResultRegistry.isTimeout(ex)) {
                throw new ApiException(HttpStatus.REQUEST_TIMEOUT, "TOOL_RESULT_TIMEOUT", "Local tool result timed out");
            }
            throw ex;
        }
    }
}
