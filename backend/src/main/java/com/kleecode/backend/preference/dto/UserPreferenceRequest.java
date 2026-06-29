package com.kleecode.backend.preference.dto;

public record UserPreferenceRequest(
        String selectedModel,
        Double temperature,
        String responseLanguage
) {
}
