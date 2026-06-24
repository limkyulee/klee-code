package com.kleecode.backend.modelconfig.repository;

import com.kleecode.backend.modelconfig.dto.UserModelConfig;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserModelConfigRepository extends MongoRepository<UserModelConfig, String> {
    Optional<UserModelConfig> findByUserId(String userId);
}
