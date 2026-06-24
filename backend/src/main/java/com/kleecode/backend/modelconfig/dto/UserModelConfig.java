package com.kleecode.backend.modelconfig.dto;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("user_model_configs")
public record UserModelConfig(
        @Id String id,
        @Indexed(unique = true) String userId,
        ModelProvider provider,
        String baseUrl,
        String modelName,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {
    public static UserModelConfig create(String userId, ModelProvider provider, String baseUrl, String modelName) {
        Instant now = Instant.now();
        return new UserModelConfig(null, userId, provider, baseUrl, modelName, true, now, now);
    }

    public UserModelConfig update(ModelProvider provider, String baseUrl, String modelName) {
        return new UserModelConfig(id, userId, provider, baseUrl, modelName, true, createdAt, Instant.now());
    }
}
