package com.kleecode.backend.llm.config;

import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OllamaApiConfig {

    @Bean
    public OllamaApi ollamaApi(LlmProperties properties) {
        return OllamaApi.builder()
                .baseUrl(properties.getBaseUrl())
                .build();
    }
}
