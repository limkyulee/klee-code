package com.kleecode.backend.agent.service;

import com.kleecode.backend.agent.dto.AgentToolCallInstruction;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AgentToolCallInstructionMappingTest {

    @Test
    void mapsToolCallInstructionJson() {
        AgentToolCallInstruction instruction = JsonMapper.builder().build().readValue(
                """
                        {"toolName":"read_file","arguments":{"path":"src/App.tsx"}}
                        """,
                AgentToolCallInstruction.class
        );

        assertEquals("read_file", instruction.toolName());
        assertEquals("src/App.tsx", instruction.arguments().get("path"));
    }
}
