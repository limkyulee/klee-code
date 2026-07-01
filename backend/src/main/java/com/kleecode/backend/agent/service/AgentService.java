package com.kleecode.backend.agent.service;

import com.kleecode.backend.agent.dto.AgentRequest;
import com.kleecode.backend.agent.dto.AgentToolCallInstruction;
import com.kleecode.backend.audit.dto.AuditLog;
import com.kleecode.backend.audit.service.AuditLogService;
import com.kleecode.backend.chat.dto.ChatRequest;
import com.kleecode.backend.chat.service.ChatModelExceptionMapper;
import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.conversation.service.ConversationService;
import com.kleecode.backend.llm.dto.EffectiveLlmSettings;
import com.kleecode.backend.llm.service.LLMGateway;
import com.kleecode.backend.permission.dto.PermissionMode;
import com.kleecode.backend.preference.service.UserPreferenceService;
import com.kleecode.backend.prompt.service.PromptAssemblyService;
import com.kleecode.backend.tool.dto.ToolResultRequest;
import com.kleecode.backend.tool.service.ToolExecutorService;
import com.kleecode.backend.tool.service.ToolPromptService;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AgentService {

    private static final String CONVERSATION_ID_KEY = "chat_memory_conversation_id";
    private static final int MAX_TOOL_CALLS = 3;
    private static final int MAX_TOOL_RESULT_CHARS = 12_000;
    private static final Pattern TOOL_CALL_PATTERN = Pattern.compile(
            "<klee_tool_call>\\s*(\\{.*?})\\s*</klee_tool_call>",
            Pattern.DOTALL
    );

    private final AuditLogService auditLogService;
    private final ConversationService conversationService;
    private final UserPreferenceService userPreferenceService;
    private final LLMGateway llmGateway;
    private final PromptAssemblyService promptAssemblyService;
    private final ChatModelExceptionMapper exceptionMapper;
    private final ToolPromptService toolPromptService;
    private final ToolExecutorService toolExecutorService;
    private final JsonMapper jsonMapper;

    public void run(String userId, AgentRequest request, AgentEventSink sink) {
        ChatRequest chatRequest = toChatRequest(request);
        EffectiveLlmSettings settings = userPreferenceService.effectiveSettings(userId);
        Optional<AuditLog> auditLog = auditLogService.start(userId, chatRequest, settings.provider(), false);
        auditLog.ifPresent(conversationService::recordTurnStarted);

        String answer = "";
        try {
            sink.progress("Agent mode enabled. Preparing tool-aware prompt...");
            String prompt = promptAssemblyService.assemble(chatRequest, settings)
                    + "\n\n"
                    + toolPromptService.instructions(PermissionMode.from(request.permissionMode()));

            StringBuilder observations = new StringBuilder();
            for (int step = 1; step <= MAX_TOOL_CALLS; step += 1) {
                String modelOutput = callModel(settings, chatRequest.conversationId(), prompt, observations.toString());
                AgentToolCallInstruction toolCall = parseToolCall(modelOutput);

                if (toolCall == null) {
                    answer = stripToolCall(modelOutput);
                    sink.token(answer);
                    auditLogService.markSucceeded(auditLog, answer).ifPresent(conversationService::recordTurnCompleted);
                    return;
                }

                ToolResultRequest result = requestToolExecution(toolCall, request, sink);
                observations.append("\n\n## Tool Observation ").append(step).append("\n")
                        .append("Tool: ").append(toolCall.toolName()).append('\n')
                        .append("Status: ").append(result.status()).append('\n');
                if (result.errorMessage() != null && !result.errorMessage().isBlank()) {
                    observations.append("Error: ").append(result.errorMessage()).append('\n');
                }
                if (result.result() != null && !result.result().isBlank()) {
                    observations.append("Result:\n```\n")
                            .append(trimToolResult(result.result()))
                            .append("\n```\n");
                }
                sink.progress("Tool result received: " + toolCall.toolName());
            }

            answer = "I inspected the available tool results, but the agent reached the tool-call limit before producing a final answer.";
            sink.token(answer);
            auditLogService.markSucceeded(auditLog, answer).ifPresent(conversationService::recordTurnCompleted);
        } catch (RuntimeException ex) {
            RuntimeException mappedException = exceptionMapper.map(ex);
            auditLogService.markFailed(auditLog, mappedException.getMessage()).ifPresent(conversationService::recordTurnCompleted);
            throw mappedException;
        }
    }

    private String callModel(
            EffectiveLlmSettings settings,
            String conversationId,
            String prompt,
            String observations
    ) {
        return llmGateway.chatClient()
                .prompt()
                .user(prompt + observations)
                .options(ChatOptions.builder()
                        .model(settings.modelName())
                        .temperature(settings.temperature()))
                .advisors(a -> a.param(CONVERSATION_ID_KEY, conversationId))
                .call()
                .content();
    }

    private ToolResultRequest requestToolExecution(
            AgentToolCallInstruction instruction,
            AgentRequest request,
            AgentEventSink sink
    ) {
        PermissionMode permissionMode = PermissionMode.from(request.permissionMode());
        sink.progress("Waiting for local tool result: " + instruction.toolName());
        return toolExecutorService.execute(
                request.conversationId(),
                instruction.toolName(),
                instruction.arguments(),
                permissionMode,
                sink::toolCallRequested
        );
    }

    private AgentToolCallInstruction parseToolCall(String modelOutput) {
        if (modelOutput == null || modelOutput.isBlank()) {
            return null;
        }
        Matcher matcher = TOOL_CALL_PATTERN.matcher(modelOutput);
        if (!matcher.find()) {
            return null;
        }
        try {
            return jsonMapper.readValue(matcher.group(1), AgentToolCallInstruction.class);
        } catch (RuntimeException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TOOL_CALL", "Model returned an invalid tool call");
        }
    }

    private String stripToolCall(String modelOutput) {
        if (modelOutput == null) {
            return "";
        }
        return TOOL_CALL_PATTERN.matcher(modelOutput).replaceAll("").trim();
    }

    private String trimToolResult(String result) {
        if (result.length() <= MAX_TOOL_RESULT_CHARS) {
            return result;
        }
        return result.substring(0, MAX_TOOL_RESULT_CHARS) + "\n... [tool result truncated]";
    }

    private ChatRequest toChatRequest(AgentRequest request) {
        return new ChatRequest(
                request.conversationId(),
                request.code(),
                request.question(),
                request.context(),
                request.skillCommand(),
                request.kleeContext()
        );
    }

}
