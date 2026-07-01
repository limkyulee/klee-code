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

/**
 * @description Tool을 실행하는 서비스 
 * - 동기적으로 Tool을 실행하고 결과를 기다립니다.
 * ToolExecutorService
 */
@Service
@RequiredArgsConstructor
public class ToolExecutorService {

    private final ToolPolicyService toolPolicyService;
    private final ToolResultRegistry toolResultRegistry;

    /**
     * Tool을 실행하고 결과를 기다립니다.
     * @param runId 실행 ID
     * @param toolName Tool 이름
     * @param arguments Tool 인자
     * @param permissionMode 권한 모드
     * @param dispatcher Tool 호출을 처리하는 Consumer
     * @return Tool 실행 결과
     */
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
        try {
            dispatcher.accept(toolCall);
        } catch (RuntimeException ex) {
            toolResultRegistry.cancel(runId, toolCallId);
            throw ex;
        }

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
