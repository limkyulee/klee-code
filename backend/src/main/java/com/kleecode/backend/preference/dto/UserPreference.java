package com.kleecode.backend.preference.dto;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("user_preferences")
public record UserPreference(
        @Id String id,
        @Indexed(unique = true) String userId,
        String selectedModel,
        Double temperature,
        String responseLanguage,
        Instant createdAt,
        Instant updatedAt
) {
    public static UserPreference create(
            String userId,
            String selectedModel,
            Double temperature,
            String responseLanguage
    ) {
        Instant now = Instant.now();
        return new UserPreference(null, userId, selectedModel, temperature, responseLanguage, now, now);
    }

    public UserPreference update(String selectedModel, Double temperature, String responseLanguage) {
        return new UserPreference(id, userId, selectedModel, temperature, responseLanguage, createdAt, Instant.now());
    }
}
