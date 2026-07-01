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

@Service
public class ToolResultRegistry {

    private static final Duration TOOL_RESULT_TIMEOUT = Duration.ofSeconds(60);

    private final Map<String, CompletableFuture<ToolResultRequest>> pendingResults = new ConcurrentHashMap<>();

    public CompletableFuture<ToolResultRequest> register(String runId, String toolCallId) {
        String key = key(runId, toolCallId);
        CompletableFuture<ToolResultRequest> future = new CompletableFuture<ToolResultRequest>()
                .orTimeout(TOOL_RESULT_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
        pendingResults.put(key, future);
        future.whenComplete((ignored, ex) -> pendingResults.remove(key));
        return future;
    }

    public boolean complete(ToolResultRequest result) {
        return Optional.ofNullable(pendingResults.get(key(result.runId(), result.toolCallId())))
                .map(future -> future.complete(result))
                .orElse(false);
    }

    private String key(String runId, String toolCallId) {
        return runId + ":" + toolCallId;
    }

    public static boolean isTimeout(Throwable ex) {
        return ex instanceof TimeoutException || ex.getCause() instanceof TimeoutException;
    }
}
