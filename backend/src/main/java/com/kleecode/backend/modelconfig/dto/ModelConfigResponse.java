package com.kleecode.backend.modelconfig.dto;

public record ModelConfigResponse(
        boolean configured,
        ModelProvider provider,
        String baseUrl,
        String modelName
) {
    public static ModelConfigResponse missing() {
        return new ModelConfigResponse(false, null, null, null);
    }

    public static ModelConfigResponse from(UserModelConfig config) {
        return new ModelConfigResponse(true, config.provider(), config.baseUrl(), config.modelName());
    }
}
