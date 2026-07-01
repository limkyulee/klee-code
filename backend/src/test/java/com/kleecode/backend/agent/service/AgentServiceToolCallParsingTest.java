package com.kleecode.backend.agent.service;

import com.kleecode.backend.agent.dto.AgentToolCallInstruction;
import com.kleecode.backend.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AgentServiceToolCallParsingTest {

    private final AgentService agentService = new AgentService(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            JsonMapper.builder().build()
    );

    @Test
    void returnsNullWhenNoToolCallTagExists() {
        assertNull(agentService.parseToolCall("Final answer without tools."));
    }

    @Test
    void parsesSingleToolCallWhenTagContainsOnlyJson() {
        AgentToolCallInstruction instruction = agentService.parseToolCall("""
                <klee_tool_call>{"toolName":"read_file","arguments":{"path":"src/App.tsx"}}</klee_tool_call>
                """);

        assertEquals("read_file", instruction.toolName());
        assertEquals("src/App.tsx", instruction.arguments().get("path"));
    }

    @Test
    void rejectsToolCallWithSurroundingProse() {
        ApiException ex = assertInvalidToolCall("""
                I need to inspect a file.
                <klee_tool_call>{"toolName":"read_file","arguments":{"path":"src/App.tsx"}}</klee_tool_call>
                """);

        assertEquals(HttpStatus.BAD_REQUEST, ex.status());
    }

    @Test
    void rejectsMultipleToolCallTags() {
        assertInvalidToolCall("""
                <klee_tool_call>{"toolName":"read_file","arguments":{"path":"a"}}</klee_tool_call>
                <klee_tool_call>{"toolName":"search_files","arguments":{"query":"b"}}</klee_tool_call>
                """);
    }

    @Test
    void rejectsBlankToolName() {
        assertInvalidToolCall("""
                <klee_tool_call>{"toolName":" ","arguments":{}}</klee_tool_call>
                """);
    }

    @Test
    void rejectsNullArguments() {
        assertInvalidToolCall("""
                <klee_tool_call>{"toolName":"read_file","arguments":null}</klee_tool_call>
                """);
    }

    private ApiException assertInvalidToolCall(String modelOutput) {
        ApiException ex = assertThrows(ApiException.class, () -> agentService.parseToolCall(modelOutput));
        assertEquals("INVALID_TOOL_CALL", ex.code());
        return ex;
    }
}
