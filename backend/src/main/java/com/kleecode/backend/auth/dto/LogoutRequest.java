package com.kleecode.backend.auth.dto;

public record LogoutRequest(
        String refreshToken
) {
}
