package com.kleecode.backend.preference.repository;

import com.kleecode.backend.preference.dto.UserPreference;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserPreferenceRepository extends MongoRepository<UserPreference, String> {
    Optional<UserPreference> findByUserId(String userId);
}
