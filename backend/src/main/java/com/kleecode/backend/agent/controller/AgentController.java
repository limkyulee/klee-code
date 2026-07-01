package com.kleecode.backend.agent.controller;

import com.kleecode.backend.agent.dto.AgentRequest;
import com.kleecode.backend.agent.service.AgentEventSink;
import com.kleecode.backend.agent.service.AgentService;
import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.security.AuthenticatedUser;
import com.kleecode.backend.tool.dto.ToolCallRequest;
import com.kleecode.backend.tool.dto.ToolResultRequest;
import com.kleecode.backend.tool.service.ToolResultRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/agent")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final ToolResultRegistry toolResultRegistry;
    private final JsonMapper jsonMapper;

    @PostMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody AgentRequest request) {
        SseEmitter emitter = new SseEmitter(0L);
        AgentEventSink sink = new SseAgentEventSink(emitter);

        CompletableFuture.runAsync(() -> {
            try {
                agentService.run(user.userId(), request, sink);
                sendEvent(emitter, "progress", "Agent response complete.");
                sendEvent(emitter, "done", "");
                emitter.complete();
            } catch (Throwable ex) {
                sendEvent(emitter, "error", streamErrorMessage(ex));
                emitter.complete();
            }
        });

        return emitter;
    }

    @PostMapping("/tool-results")
    public ResponseEntity<Void> toolResult(@RequestBody ToolResultRequest result) {
        if (!toolResultRegistry.complete(result)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.accepted().build();
    }

    private void sendEvent(SseEmitter emitter, String name, Object data) {
        try {
            String encodedData = jsonMapper.writeValueAsString(data);
            synchronized (emitter) {
                emitter.send(SseEmitter.event().name(name).data(encodedData));
            }
        } catch (IOException ex) {
            emitter.completeWithError(ex);
        }
    }

    private String streamErrorMessage(Throwable ex) {
        if (ex instanceof ApiException) {
            return ex.getMessage();
        }
        return "Agent stream failed";
    }

    private class SseAgentEventSink implements AgentEventSink {
        private final SseEmitter emitter;

        private SseAgentEventSink(SseEmitter emitter) {
            this.emitter = emitter;
        }

        @Override
        public void progress(String text) {
            sendEvent(emitter, "progress", text);
        }

        @Override
        public void token(String text) {
            sendEvent(emitter, "token", text);
        }

        @Override
        public void toolCallRequested(ToolCallRequest toolCall) {
            sendEvent(emitter, "tool_call_requested", toolCall);
        }
    }
}
