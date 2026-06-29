package com.kleecode.backend.llm.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "klee.llm")
public class LlmProperties {

    private String provider = "ollama";
    private String baseUrl = "http://ollama:11434";
    private String defaultModel = "qwen2.5-coder:14b";
    private Double defaultTemperature = 0.2;
    private String defaultResponseLanguage = "Korean";

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getDefaultModel() {
        return defaultModel;
    }

    public void setDefaultModel(String defaultModel) {
        this.defaultModel = defaultModel;
    }

    public Double getDefaultTemperature() {
        return defaultTemperature;
    }

    public void setDefaultTemperature(Double defaultTemperature) {
        this.defaultTemperature = defaultTemperature;
    }

    public String getDefaultResponseLanguage() {
        return defaultResponseLanguage;
    }

    public void setDefaultResponseLanguage(String defaultResponseLanguage) {
        this.defaultResponseLanguage = defaultResponseLanguage;
    }
}
