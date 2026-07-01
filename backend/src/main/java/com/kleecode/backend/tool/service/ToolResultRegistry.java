package com.kleecode.backend.tool.service;

import com.kleecode.backend.tool.dto.ToolResultRequest;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 *  @description Tool의 실행 결과를 관리하는 서비스 
 * - 비동기적으로 Tool의 결과를 기다릴 수 있도록 CompletableFuture를 사용하여 관리합니다.
 *  ToolResultRegistry
 */
@Service
public class ToolResultRegistry {

    private static final Duration TOOL_RESULT_TIMEOUT = Duration.ofSeconds(60);

    /**
     * pendingResults는 현재 실행 중인 Tool의 결과를 관리하는 맵입니다.
     * key: runId + ":" + toolCallId
     * value: CompletableFuture<ToolResultRequest>
     */
    private final Map<String, CompletableFuture<ToolResultRequest>> pendingResults = new ConcurrentHashMap<>();

    public CompletableFuture<ToolResultRequest> register(String runId, String toolCallId) {
        String key = key(runId, toolCallId);
        CompletableFuture<ToolResultRequest> future = new CompletableFuture<ToolResultRequest>()
                .orTimeout(TOOL_RESULT_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
        pendingResults.put(key, future);
        future.whenComplete((ignored, ex) -> pendingResults.remove(key));
        return future;
    }

    /**
     * Tool의 실행 결과를 완료 처리합니다.
     * @param result Tool의 실행 결과
     * @return 완료 여부
     */
    public boolean complete(ToolResultRequest result) {
        return Optional.ofNullable(pendingResults.get(key(result.runId(), result.toolCallId())))
                .map(future -> future.complete(result))
                .orElse(false);
    }

    /**
     * Tool의 실행 결과를 취소 처리합니다.
     * @param runId 실행 ID
     * @param toolCallId Tool 호출 ID
     */
    public void cancel(String runId, String toolCallId) {
        Optional.ofNullable(pendingResults.remove(key(runId, toolCallId)))
                .ifPresent(future -> future.cancel(false));
    }

    private String key(String runId, String toolCallId) {
        return runId + ":" + toolCallId;
    }

    public static boolean isTimeout(Throwable ex) {
        return ex instanceof TimeoutException || ex.getCause() instanceof TimeoutException;
    }
}
