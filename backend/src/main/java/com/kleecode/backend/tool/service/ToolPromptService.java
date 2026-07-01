package com.kleecode.backend.tool.service;

import com.kleecode.backend.permission.dto.PermissionMode;
import com.kleecode.backend.tool.dto.ToolArgumentSchema;
import com.kleecode.backend.tool.dto.ToolSchema;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.stream.Collectors;

/**
 * @description Tool의 프롬프트를 관리하는 서비스
 * ToolPromptService
 */
@Service
@RequiredArgsConstructor
public class ToolPromptService {

    private final ToolRegistry toolRegistry;

    public String instructions(PermissionMode permissionMode) {
        return """
                ## Tool Calling

                You are running in Klee Code agent mode.
                You may request one local read-only tool call at a time when the current context is insufficient.
                The host will execute only approved local tools and return the result as a tool observation.

                Permission mode: %s

                Available tools:
                %s

                To request a tool, respond with exactly this tag and JSON shape, with no extra prose:
                <klee_tool_call>%s</klee_tool_call>

                When you have enough information, do not emit a tool call. Return the final answer directly.
                Do not request write, patch, command, shell, network, or external tools in this version.
                """.formatted(permissionMode.wireValue(), toolList(), exampleToolCall());
    }

    private String toolList() {
        return toolRegistry.availableTools().stream()
                .map(this::toolDescription)
                .collect(Collectors.joining("\n"));
    }

    private String toolDescription(ToolSchema tool) {
        return "- %s: %s Arguments: %s".formatted(
                tool.name(),
                tool.description(),
                argumentDescription(tool)
        );
    }

    private String argumentDescription(ToolSchema tool) {
        return tool.arguments().stream()
                .map(argument -> "%s (%s%s): %s".formatted(
                        argument.name(),
                        argument.type(),
                        argument.required() ? ", required" : "",
                        argument.description()
                ))
                .collect(Collectors.joining("; "));
    }

    private String exampleToolCall() {
        return toolRegistry.availableTools().stream()
                .findFirst()
                .map(tool -> "{\"toolName\":\"%s\",\"arguments\":{%s}}".formatted(
                        tool.name(),
                        exampleArguments(tool)
                ))
                .orElse("{\"toolName\":\"tool_name\",\"arguments\":{}}");
    }

    private String exampleArguments(ToolSchema tool) {
        return tool.arguments().stream()
                .map(this::exampleArgument)
                .collect(Collectors.joining(","));
    }

    private String exampleArgument(ToolArgumentSchema argument) {
        return "\"%s\":\"%s\"".formatted(argument.name(), argument.exampleValue());
    }
}
