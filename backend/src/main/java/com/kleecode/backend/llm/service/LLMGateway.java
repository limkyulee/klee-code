package com.kleecode.backend.llm.service;

import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.llm.config.LlmProperties;
import com.kleecode.backend.llm.dto.EffectiveLlmSettings;
import com.kleecode.backend.llm.dto.ModelResponse;
import com.kleecode.backend.preference.dto.UserPreference;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class LLMGateway {

    private static final String OLLAMA_PROVIDER = "ollama";

    private final LlmProperties properties;
    private final ChatMemory chatMemory;
    private final OllamaApi ollamaApi;
    private ChatClient chatClient;

    @PostConstruct
    void initialize() {
        validateProperties();
        OllamaChatModel chatModel = OllamaChatModel.builder()
                .ollamaApi(ollamaApi)
                .options(OllamaChatOptions.builder().model(defaultModelName()).build())
                .build();

        chatClient = ChatClient.builder(chatModel)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .defaultSystem("""
                        You are Klee Code, an on-premise AI coding assistant for enterprise internal networks.
                        Never suggest sending source code or project documents to external AI services.
                        When given code and a question, provide clear, concise, and actionable answers.
                        """)
                .build();
    }

    public ChatClient chatClient() {
        return chatClient;
    }

    public List<ModelResponse> availableModels() {
        return installedModels().stream()
                .map(model -> new ModelResponse(model.name(), model.name(), model.name().equals(defaultModelName())))
                .toList();
    }

    public EffectiveLlmSettings resolve(UserPreference preference) {
        String selectedModel = preference == null ? null : preference.selectedModel();
        String modelName = isAllowedModel(selectedModel) ? selectedModel.trim() : defaultModelName();
        double temperature = preference == null || preference.temperature() == null
                ? properties.getDefaultTemperature()
                : preference.temperature();
        String responseLanguage = preference == null || preference.responseLanguage() == null
                || preference.responseLanguage().isBlank()
                ? properties.getDefaultResponseLanguage()
                : preference.responseLanguage().trim();

        return new EffectiveLlmSettings(OLLAMA_PROVIDER, modelName, temperature, responseLanguage);
    }

    public boolean isAllowedModel(String modelName) {
        if (modelName == null || modelName.isBlank()) {
            return false;
        }
        String normalized = modelName.trim();
        return installedModels().stream().anyMatch(model -> normalized.equals(model.name()));
    }

    public String defaultModelName() {
        return properties.getDefaultModel();
    }

    private void validateProperties() {
        if (!OLLAMA_PROVIDER.equalsIgnoreCase(properties.getProvider())) {
            throw new IllegalStateException("Only ollama is supported as klee.llm.provider");
        }
        if (properties.getBaseUrl() == null || properties.getBaseUrl().isBlank()) {
            throw new IllegalStateException("klee.llm.base-url is required");
        }
        if (properties.getDefaultModel() == null || properties.getDefaultModel().isBlank()) {
            throw new IllegalStateException("klee.llm.default-model is required");
        }
    }

    private List<OllamaApi.Model> installedModels() {
        try {
            OllamaApi.ListModelResponse response = ollamaApi.listModels();
            log.info("Retrieved {} models from Ollama API", response.models() == null ? 0 : response.models().size());
            if (response.models() == null) {
                return List.of();
            }
            return response.models().stream()
                    .filter(model -> model != null)
                    .filter(model -> model.name() != null && !model.name().isBlank())
                    .toList();
        } catch (RestClientException ex) {
            log.warn("Failed to retrieve models from Ollama API at {}", properties.getBaseUrl(), ex);
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "MODEL_SERVER_UNAVAILABLE",
                    "Central model server is unavailable. Contact the administrator."
            );
        }
    }
}
