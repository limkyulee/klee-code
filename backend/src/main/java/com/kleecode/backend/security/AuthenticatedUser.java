package com.kleecode.backend.security;

import com.kleecode.backend.user.dto.UserRole;

import java.util.Set;

public record AuthenticatedUser(
        String userId,
        Set<UserRole> roles
) {
}
