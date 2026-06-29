package com.kleecode.backend.llm.dto;

public record EffectiveLlmSettings(
        String provider,
        String modelName,
        double temperature,
        String responseLanguage
) {
}
