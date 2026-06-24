package com.kleecode.backend.auth.dto;

public record AuthRequest(
        String userId,
        String password
) {
}
