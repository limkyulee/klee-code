package com.kleecode.backend.user.service;

import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.user.dto.AppUser;
import com.kleecode.backend.user.dto.UserStatus;
import com.kleecode.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AppUser register(String userId, String password) {
        String normalizedUserId = normalizeUserId(userId);
        validatePassword(password);

        if (userRepository.existsByUserId(normalizedUserId)) {
            throw new ApiException(HttpStatus.CONFLICT, "USER_ID_ALREADY_EXISTS", "User ID already exists");
        }

        return userRepository.save(AppUser.create(normalizedUserId, passwordEncoder.encode(password)));
    }

    public AppUser authenticate(String userId, String password) {
        AppUser user = findActiveByUserId(userId);
        if (!passwordEncoder.matches(password, user.passwordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid user ID or password");
        }

        return userRepository.save(user.markLoggedIn());
    }

    public AppUser findActiveByUserId(String userId) {
        AppUser user = userRepository.findByUserId(normalizeUserId(userId))
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED,
                        "INVALID_CREDENTIALS",
                        "Invalid user ID or password"
                ));

        if (user.status() != UserStatus.ACTIVE) {
            throw new ApiException(HttpStatus.FORBIDDEN, "USER_DISABLED", "User is disabled");
        }

        return user;
    }

    private String normalizeUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_USER_ID", "User ID is required");
        }

        String normalized = userId.trim();
        if (!normalized.matches("^[A-Za-z0-9._-]{3,40}$")) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_USER_ID",
                    "User ID must be 3-40 characters and use letters, numbers, dot, underscore, or hyphen"
            );
        }
        return normalized;
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 128) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_PASSWORD",
                    "Password must be 8-128 characters"
            );
        }
    }
}
