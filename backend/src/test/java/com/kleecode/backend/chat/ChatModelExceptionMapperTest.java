package com.kleecode.backend.chat;

import com.kleecode.backend.chat.service.ChatModelExceptionMapper;
import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.modelconfig.dto.ModelProvider;
import com.kleecode.backend.modelconfig.dto.UserModelConfig;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.net.ConnectException;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChatModelExceptionMapperTest {

    private final ChatModelExceptionMapper mapper = new ChatModelExceptionMapper();

    @Test
    void mapsModelConnectionFailureToServiceUnavailableApiException() {
        RuntimeException mapped = mapper.map(
                new RuntimeException(new ConnectException("Connection refused")),
                config()
        );

        assertTrue(mapped instanceof ApiException);
        ApiException apiException = (ApiException) mapped;
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, apiException.status());
        assertEquals("MODEL_SERVER_UNAVAILABLE", apiException.code());
        assertEquals(
                "Model server is unreachable at http://localhost:11434. Start Ollama or update the model server URL.",
                apiException.getMessage()
        );
    }

    @Test
    void keepsExistingApiException() {
        ApiException source = new ApiException(HttpStatus.CONFLICT, "MODEL_CONFIG_REQUIRED", "Model configuration is required");

        RuntimeException mapped = mapper.map(source, config());

        assertSame(source, mapped);
    }

    private UserModelConfig config() {
        Instant now = Instant.parse("2026-06-28T00:00:00Z");
        return new UserModelConfig(
                "config-1",
                "user-1",
                ModelProvider.OLLAMA,
                "http://localhost:11434",
                "qwen2.5-coder:3b",
                true,
                now,
                now
        );
    }
}
