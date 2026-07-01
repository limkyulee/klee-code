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

/**
 * @description User Preference를 관리하는 서비스
 * - 사용자의 LLM 설정 선호도를 관리합니다.
 * - 사용자가 선택한 모델, 온도, 응답 언어 등의 설정을 저장하고, 이를 기반으로 LLM과의 통신에 필요한 설정을 제공합니다.
 * - LLMGateway를 통해 사용자의 선호도에 따라 적절한 모델과 설정을 선택합니다.
 * - 온프렘 정책 기술적 강제
 * UserPreferenceService
 */
@Service
@RequiredArgsConstructor
public class UserPreferenceService {

    private static final double MIN_TEMPERATURE = 0.0;
    private static final double MAX_TEMPERATURE = 2.0;

    private final UserPreferenceRepository userPreferenceRepository;
    private final LLMGateway llmGateway;

    /**
     * 사용자의 선호도에 따른 응답을 반환합니다.
     * @param userId 사용자 ID
     * @return 사용자 선호도에 따른 응답
     */
    public UserPreferenceResponse findResponse(String userId) {
        return UserPreferenceResponse.from(effectiveSettings(userId));
    }

    /**
     * 사용자의 선호도에 따라 LLM과의 통신에 필요한 설정을 반환합니다.
     * - 사용자의 선호도가 존재하지 않는 경우, LLMGateway의 기본 설정을 반환합니다.
     * - 사용자의 선호도가 존재하는 경우, 해당 선호도를 기반으로 LLM과의 통신에 필요한 설정을 반환합니다.
     * - 선택한 모델이 허용되지 않은 경우, 온도가 범위를 벗어난 경우, 응답 언어가 유효하지 않은 경우에는 ApiException을 발생시킵니다.
     * @param userId 사용자 ID
     * @return 사용자의 선호도에 따른 LLM 설정
     */
    public EffectiveLlmSettings effectiveSettings(String userId) {
        UserPreference preference = userPreferenceRepository.findByUserId(userId).orElse(null);
        return llmGateway.resolve(preference);
    }

    /**
     * 사용자의 선호도를 저장합니다.
     * - 선택한 모델, 온도, 응답 언어 등의 설정을 검증하고, 유효한 경우 데이터베이스에 저장합니다.
     * - 저장된 선호도에 따라 LLM과의 통신에 필요한 설정을 반환합니다.
     * - 선택한 모델이 허용되지 않은 경우, 온도가 범위를 벗어난 경우, 응답 언어가 유효하지 않은 경우에는 ApiException을 발생시킵니다.
     * @param userId 사용자 ID
     * @param request 사용자 선호도 요청
     * @return 저장된 사용자 선호도 응답
     */
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

    /**
     * 선택한 모델을 검증하고 정규화합니다.
     * - 선택한 모델이 null이거나 공백인 경우, LLMGateway의 기본 모델 이름을 반환합니다.
     * - 선택한 모델이 허용되지 않은 경우, ApiException을 발생시킵니다.
     * @param selectedModel 사용자가 선택한 모델 이름
     * @return 정규화된 모델 이름
     * @throws ApiException 선택한 모델이 허용되지 않은 경우 발생
     */
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

    /**
     * 온도를 검증하고 정규화합니다.
     * - 온도가 null인 경우, null을 반환합니다.
     * - 온도가 허용된 범위(0.0 ~ 2.0)를 벗어난 경우, ApiException을 발생시킵니다.
     * @param temperature 사용자가 선택한 온도 값
     * @return 정규화된 온도 값
     * @throws ApiException 온도가 허용된 범위를 벗어난 경우 발생
     */
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

    /**
     * 응답 언어를 검증하고 정규화합니다.
     * - 응답 언어가 null이거나 공백인 경우, null을 반환합니다.
     * - 응답 언어가 허용되지 않은 경우, ApiException을 발생시킵니다.
     * @param responseLanguage 사용자가 선택한 응답 언어
     * @return 정규화된 응답 언어
     * @throws ApiException 응답 언어가 허용되지 않은 경우 발생
     */
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
