package com.kleecode.backend.preference.dto;

import com.kleecode.backend.llm.dto.EffectiveLlmSettings;

public record UserPreferenceResponse(
        String selectedModel,
        Double temperature,
        String responseLanguage
) {
    public static UserPreferenceResponse from(EffectiveLlmSettings settings) {
        return new UserPreferenceResponse(
                settings.modelName(),
                settings.temperature(),
                settings.responseLanguage()
        );
    }
}
