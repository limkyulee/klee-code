package com.kleecode.backend.auth.dto;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("sessions")
public record UserSession(
        @Id String id,
        @Indexed String userId,
        @Indexed(unique = true) String refreshTokenHash,
        Instant createdAt,
        @Indexed(expireAfter = "0s") Instant expiresAt,
        Instant revokedAt,
        Instant lastUsedAt,
        String userAgent
) {
    public static UserSession create(String userId, String refreshTokenHash, Instant expiresAt, String userAgent) {
        Instant now = Instant.now();
        return new UserSession(null, userId, refreshTokenHash, now, expiresAt, null, now, userAgent);
    }

    public UserSession markUsed() {
        return new UserSession(id, userId, refreshTokenHash, createdAt, expiresAt, revokedAt, Instant.now(), userAgent);
    }

    public UserSession revoke() {
        return new UserSession(id, userId, refreshTokenHash, createdAt, expiresAt, Instant.now(), lastUsedAt, userAgent);
    }

    public boolean isActive(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }
}
