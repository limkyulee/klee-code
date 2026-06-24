package com.kleecode.backend.user.dto;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Set;

@Document("users")
public record AppUser(
        @Id String id,
        @Indexed(unique = true) String userId,
        String passwordHash,
        @Indexed Set<UserRole> roles,
        @Indexed UserStatus status,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt
) {
    public static AppUser create(String userId, String passwordHash) {
        Instant now = Instant.now();
        return new AppUser(
                null,
                userId,
                passwordHash,
                Set.of(UserRole.USER),
                UserStatus.ACTIVE,
                now,
                now,
                null
        );
    }

    public AppUser markLoggedIn() {
        return new AppUser(id, userId, passwordHash, roles, status, createdAt, Instant.now(), Instant.now());
    }
}
