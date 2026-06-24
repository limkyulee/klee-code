package com.kleecode.backend.modelconfig.dto;

public record ModelConfigRequest(
        ModelProvider provider,
        String baseUrl,
        String modelName
) {
}
