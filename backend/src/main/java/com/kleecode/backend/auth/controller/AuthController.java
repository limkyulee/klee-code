package com.kleecode.backend.auth.controller;

import com.kleecode.backend.auth.dto.AuthRequest;
import com.kleecode.backend.auth.dto.AuthResponse;
import com.kleecode.backend.auth.dto.LogoutRequest;
import com.kleecode.backend.auth.dto.RefreshRequest;
import com.kleecode.backend.auth.dto.UserProfileResponse;
import com.kleecode.backend.auth.service.AuthService;
import com.kleecode.backend.security.AuthenticatedUser;
import com.kleecode.backend.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody AuthRequest request, HttpServletRequest servletRequest) {
        return ResponseEntity.ok(authService.register(request.userId(), request.password(), userAgent(servletRequest)));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request, HttpServletRequest servletRequest) {
        return ResponseEntity.ok(authService.login(request.userId(), request.password(), userAgent(servletRequest)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody RefreshRequest request, HttpServletRequest servletRequest) {
        return ResponseEntity.ok(authService.refresh(request.refreshToken(), userAgent(servletRequest)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody LogoutRequest request) {
        authService.logout(request.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> me(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        return ResponseEntity.ok(authService.profile(userService.findActiveByUserId(authenticatedUser.userId())));
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader("User-Agent");
    }
}
