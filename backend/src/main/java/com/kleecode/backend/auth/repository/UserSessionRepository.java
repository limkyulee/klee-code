package com.kleecode.backend.auth.repository;

import com.kleecode.backend.auth.dto.UserSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserSessionRepository extends MongoRepository<UserSession, String> {
    Optional<UserSession> findByRefreshTokenHash(String refreshTokenHash);
}
