package com.kleecode.backend.llm;

import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.llm.service.LLMGateway;
import org.junit.jupiter.api.Test;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.ResourceAccessException;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@SpringBootTest
class LLMGatewayTest {

    @Autowired
    private LLMGateway llmGateway;

    @MockitoBean
    private OllamaApi ollamaApi;

    @Test
    void exposesInstalledOllamaModels() {
        when(ollamaApi.listModels()).thenReturn(new OllamaApi.ListModelResponse(List.of(
                model("qwen2.5-coder:14b"),
                model("deepseek-coder")
        )));

        var models = llmGateway.availableModels();

        assertEquals(2, models.size());
        assertEquals("qwen2.5-coder:14b", models.getFirst().getName());
        assertTrue(models.getFirst().isDefault());
        assertTrue(llmGateway.isAllowedModel("deepseek-coder"));
        assertFalse(llmGateway.isAllowedModel("http://localhost:11434"));
    }

    @Test
    void mapsOllamaModelListFailureToServiceUnavailable() {
        when(ollamaApi.listModels()).thenThrow(new ResourceAccessException("Connection refused"));

        ApiException ex = assertThrows(ApiException.class, () -> llmGateway.availableModels());

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.status());
        assertEquals("MODEL_SERVER_UNAVAILABLE", ex.code());
    }

    private static OllamaApi.Model model(String name) {
        return new OllamaApi.Model(name, name, Instant.parse("2026-06-29T00:00:00Z"), 1L, "digest", null);
    }
}
