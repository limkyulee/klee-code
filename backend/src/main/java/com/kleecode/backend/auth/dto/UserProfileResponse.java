package com.kleecode.backend.auth.dto;

import com.kleecode.backend.user.dto.UserRole;
import com.kleecode.backend.user.dto.UserStatus;

import java.util.Set;

public record UserProfileResponse(
        String userId,
        Set<UserRole> roles,
        UserStatus status
) {
}
