package com.kleecode.backend.auth.dto;

import com.kleecode.backend.user.dto.UserRole;
import com.kleecode.backend.user.dto.UserStatus;

import java.util.Set;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresInSeconds,
        UserProfile user
) {
    public record UserProfile(
            String userId,
            Set<UserRole> roles,
            UserStatus status
    ) {
    }
}
