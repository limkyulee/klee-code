package com.kleecode.backend.auth.service;

import com.kleecode.backend.auth.dto.AuthResponse;
import com.kleecode.backend.auth.dto.UserProfileResponse;
import com.kleecode.backend.user.dto.AppUser;
import com.kleecode.backend.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final TokenService tokenService;
    private final RefreshTokenService refreshTokenService;

    public AuthResponse register(String userId, String password, String userAgent) {
        AppUser user = userService.register(userId, password);
        return issueTokens(user, userAgent);
    }

    public AuthResponse login(String userId, String password, String userAgent) {
        AppUser user = userService.authenticate(userId, password);
        return issueTokens(user, userAgent);
    }

    public AuthResponse refresh(String refreshToken, String userAgent) {
        var session = refreshTokenService.verify(refreshToken);
        AppUser user = userService.findActiveByUserId(session.userId());
        return issueTokens(user, userAgent);
    }

    public void logout(String refreshToken) {
        refreshTokenService.revoke(refreshToken);
    }

    public UserProfileResponse profile(AppUser user) {
        return new UserProfileResponse(user.userId(), user.roles(), user.status());
    }

    private AuthResponse issueTokens(AppUser user, String userAgent) {
        var refreshToken = refreshTokenService.issue(user.userId(), userAgent);
        return new AuthResponse(
                tokenService.createAccessToken(user),
                refreshToken.token(),
                "Bearer",
                tokenService.accessTokenTtlSeconds(),
                new AuthResponse.UserProfile(user.userId(), user.roles(), user.status())
        );
    }
}
