package com.kleecode.backend.preference.service;

import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.llm.dto.EffectiveLlmSettings;
import com.kleecode.backend.llm.service.LLMGateway;
import com.kleecode.backend.preference.dto.UserPreference;
import com.kleecode.backend.preference.dto.UserPreferenceRequest;
import com.kleecode.backend.preference.dto.UserPreferenceResponse;
import com.kleecode.backend.preference.repository.UserPreferenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserPreferenceService {

    private static final double MIN_TEMPERATURE = 0.0;
    private static final double MAX_TEMPERATURE = 2.0;

    private final UserPreferenceRepository userPreferenceRepository;
    private final LLMGateway llmGateway;

    public UserPreferenceResponse findResponse(String userId) {
        return UserPreferenceResponse.from(effectiveSettings(userId));
    }

    public EffectiveLlmSettings effectiveSettings(String userId) {
        UserPreference preference = userPreferenceRepository.findByUserId(userId).orElse(null);
        return llmGateway.resolve(preference);
    }

    public UserPreferenceResponse save(String userId, UserPreferenceRequest request) {
        String selectedModel = normalizeSelectedModel(request.selectedModel());
        Double temperature = normalizeTemperature(request.temperature());
        String responseLanguage = normalizeResponseLanguage(request.responseLanguage());

        UserPreference saved = userPreferenceRepository.findByUserId(userId)
                .map(existing -> existing.update(selectedModel, temperature, responseLanguage))
                .orElseGet(() -> UserPreference.create(userId, selectedModel, temperature, responseLanguage));

        userPreferenceRepository.save(saved);
        return UserPreferenceResponse.from(llmGateway.resolve(saved));
    }

    private String normalizeSelectedModel(String selectedModel) {
        if (selectedModel == null || selectedModel.isBlank()) {
            return llmGateway.defaultModelName();
        }

        String normalized = selectedModel.trim();
        if (!llmGateway.isAllowedModel(normalized)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_MODEL_SELECTION",
                    "Selected model is not allowed"
            );
        }
        return normalized;
    }

    private Double normalizeTemperature(Double temperature) {
        if (temperature == null) {
            return null;
        }
        if (temperature < MIN_TEMPERATURE || temperature > MAX_TEMPERATURE) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_TEMPERATURE",
                    "Temperature must be between 0.0 and 2.0"
            );
        }
        return temperature;
    }

    private String normalizeResponseLanguage(String responseLanguage) {
        if (responseLanguage == null || responseLanguage.isBlank()) {
            return null;
        }
        String normalized = responseLanguage.trim();
        if (!"Korean".equals(normalized) && !"English".equals(normalized)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_RESPONSE_LANGUAGE",
                    "Response language must be Korean or English"
            );
        }
        return normalized;
    }
}
