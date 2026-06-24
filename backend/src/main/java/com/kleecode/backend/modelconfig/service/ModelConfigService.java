package com.kleecode.backend.modelconfig.service;

import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.modelconfig.dto.ModelConfigRequest;
import com.kleecode.backend.modelconfig.dto.ModelConfigResponse;
import com.kleecode.backend.modelconfig.dto.ModelProvider;
import com.kleecode.backend.modelconfig.dto.UserModelConfig;
import com.kleecode.backend.modelconfig.repository.UserModelConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URISyntaxException;

@Service
@RequiredArgsConstructor
public class ModelConfigService {

    private final UserModelConfigRepository userModelConfigRepository;

    public ModelConfigResponse findResponse(String userId) {
        return userModelConfigRepository.findByUserId(userId)
                .map(ModelConfigResponse::from)
                .orElseGet(ModelConfigResponse::missing);
    }

    public UserModelConfig requireConfig(String userId) {
        UserModelConfig config = userModelConfigRepository.findByUserId(userId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.CONFLICT,
                        "MODEL_CONFIG_REQUIRED",
                        "Model configuration is required before chatting"
                ));

        if (!config.enabled()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "MODEL_CONFIG_REQUIRED",
                    "Model configuration is disabled"
            );
        }
        return config;
    }

    public ModelConfigResponse save(String userId, ModelConfigRequest request) {
        ModelProvider provider = request.provider() == null ? ModelProvider.OLLAMA : request.provider();
        if (provider != ModelProvider.OLLAMA) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_MODEL_PROVIDER", "Only OLLAMA is supported");
        }

        String baseUrl = normalizeBaseUrl(request.baseUrl());
        String modelName = normalizeModelName(request.modelName());
        UserModelConfig saved = userModelConfigRepository.findByUserId(userId)
                .map(existing -> existing.update(provider, baseUrl, modelName))
                .orElseGet(() -> UserModelConfig.create(userId, provider, baseUrl, modelName));

        return ModelConfigResponse.from(userModelConfigRepository.save(saved));
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MODEL_BASE_URL", "Model server URL is required");
        }

        String normalized = baseUrl.trim();
        try {
            URI uri = new URI(normalized);
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_MODEL_BASE_URL",
                        "Model server URL must start with http or https"
                );
            }
            return normalized.endsWith("/") ? normalized.substring(0, normalized.length() - 1) : normalized;
        } catch (URISyntaxException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MODEL_BASE_URL", "Invalid model server URL");
        }
    }

    private String normalizeModelName(String modelName) {
        if (modelName == null || modelName.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MODEL_NAME", "Model name is required");
        }
        return modelName.trim();
    }
}
