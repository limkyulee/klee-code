package com.kleecode.backend.tool;

import com.kleecode.backend.agent.controller.AgentController;
import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.tool.dto.ToolResultRequest;
import com.kleecode.backend.tool.dto.ToolResultStatus;
import com.kleecode.backend.tool.service.ToolResultRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ToolResultRequestTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    @Test
    void readsToolResultStatusFromWireValue() {
        ToolResultRequest result = jsonMapper.readValue(
                """
                        {"runId":"run-1","toolCallId":"tool-1","status":"SUCCEEDED","result":"ok"}
                        """,
                ToolResultRequest.class
        );

        assertEquals(ToolResultStatus.SUCCEEDED, result.status());
    }

    @Test
    void rejectsInvalidToolResultStatusWireValue() {
        assertThrows(RuntimeException.class, () -> jsonMapper.readValue(
                """
                        {"runId":"run-1","toolCallId":"tool-1","status":"DONE","result":"ok"}
                        """,
                ToolResultRequest.class
        ));
    }

    @Test
    void controllerRejectsMissingRequiredToolResultFields() {
        AgentController controller = new AgentController(null, new ToolResultRegistry(), jsonMapper);

        ApiException ex = assertThrows(ApiException.class, () -> controller.toolResult(
                new ToolResultRequest("", "tool-1", ToolResultStatus.SUCCEEDED, "ok", null)
        ));

        assertEquals(HttpStatus.BAD_REQUEST, ex.status());
        assertEquals("INVALID_TOOL_RESULT", ex.code());
    }
}
