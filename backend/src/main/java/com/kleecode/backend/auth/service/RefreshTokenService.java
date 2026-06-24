package com.kleecode.backend.auth.service;

import com.kleecode.backend.auth.dto.UserSession;
import com.kleecode.backend.auth.repository.UserSessionRepository;
import com.kleecode.backend.common.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final UserSessionRepository userSessionRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${klee-code.security.refresh-token-ttl-days}")
    private long refreshTokenTtlDays;

    public IssuedRefreshToken issue(String userId, String userAgent) {
        String refreshToken = createOpaqueToken();
        String hash = sha256(refreshToken);
        Instant expiresAt = Instant.now().plus(refreshTokenTtlDays, ChronoUnit.DAYS);
        userSessionRepository.save(UserSession.create(userId, hash, expiresAt, userAgent));
        return new IssuedRefreshToken(refreshToken, expiresAt);
    }

    public UserSession verify(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw invalidRefreshToken();
        }

        UserSession session = userSessionRepository.findByRefreshTokenHash(sha256(refreshToken))
                .orElseThrow(this::invalidRefreshToken);

        if (!session.isActive(Instant.now())) {
            throw invalidRefreshToken();
        }

        return userSessionRepository.save(session.markUsed());
    }

    public void revoke(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }

        userSessionRepository.findByRefreshTokenHash(sha256(refreshToken))
                .ifPresent(session -> userSessionRepository.save(session.revoke()));
    }

    private String createOpaqueToken() {
        byte[] bytes = new byte[48];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private ApiException invalidRefreshToken() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    public record IssuedRefreshToken(String token, Instant expiresAt) {
    }
}
