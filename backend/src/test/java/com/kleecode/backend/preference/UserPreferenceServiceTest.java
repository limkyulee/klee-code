package com.kleecode.backend.preference;

import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.preference.dto.UserPreference;
import com.kleecode.backend.preference.dto.UserPreferenceRequest;
import com.kleecode.backend.preference.repository.UserPreferenceRepository;
import com.kleecode.backend.preference.service.UserPreferenceService;
import org.junit.jupiter.api.Test;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
class UserPreferenceServiceTest {

    @MockitoBean
    private UserPreferenceRepository userPreferenceRepository;

    @MockitoBean
    private OllamaApi ollamaApi;

    @Autowired
    private UserPreferenceService userPreferenceService;

    @Test
    void missingPreferenceUsesGatewayDefaults() {
        when(userPreferenceRepository.findByUserId("user-1")).thenReturn(Optional.empty());

        var response = userPreferenceService.findResponse("user-1");

        assertEquals("qwen2.5-coder:14b", response.selectedModel());
        assertEquals(0.2, response.temperature());
        assertEquals("Korean", response.responseLanguage());
    }

    @Test
    void rejectsModelOutsideAllowedList() {
        when(ollamaApi.listModels()).thenReturn(new OllamaApi.ListModelResponse(List.of(
                model("qwen2.5-coder:14b"),
                model("deepseek-coder")
        )));

        assertThrows(ApiException.class, () -> userPreferenceService.save(
                "user-1",
                new UserPreferenceRequest("http://localhost:11434", 0.3, "Korean")
        ));
    }

    @Test
    void savesOnlyPersonalPreferences() {
        when(ollamaApi.listModels()).thenReturn(new OllamaApi.ListModelResponse(List.of(
                model("qwen2.5-coder:14b"),
                model("deepseek-coder")
        )));
        when(userPreferenceRepository.findByUserId("user-1")).thenReturn(Optional.empty());
        when(userPreferenceRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = userPreferenceService.save(
                "user-1",
                new UserPreferenceRequest("deepseek-coder", 0.4, "English")
        );

        assertEquals("deepseek-coder", response.selectedModel());
        assertEquals(0.4, response.temperature());
        assertEquals("English", response.responseLanguage());
    }

    @Test
    void effectiveSettingsUsesStoredPreference() {
        when(ollamaApi.listModels()).thenReturn(new OllamaApi.ListModelResponse(List.of(
                model("qwen2.5-coder:14b"),
                model("deepseek-coder")
        )));
        Instant now = Instant.parse("2026-06-29T00:00:00Z");
        when(userPreferenceRepository.findByUserId("user-1")).thenReturn(Optional.of(
                new UserPreference("preference-1", "user-1", "deepseek-coder", 0.6, "English", now, now)
        ));

        var settings = userPreferenceService.effectiveSettings("user-1");

        assertEquals("ollama", settings.provider());
        assertEquals("deepseek-coder", settings.modelName());
        assertEquals(0.6, settings.temperature());
        assertEquals("English", settings.responseLanguage());
    }

    private static OllamaApi.Model model(String name) {
        return new OllamaApi.Model(name, name, Instant.parse("2026-06-29T00:00:00Z"), 1L, "digest", null);
    }
}
