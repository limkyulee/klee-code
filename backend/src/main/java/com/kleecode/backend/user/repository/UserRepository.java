package com.kleecode.backend.user.repository;

import com.kleecode.backend.user.dto.AppUser;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserRepository extends MongoRepository<AppUser, String> {
    Optional<AppUser> findByUserId(String userId);

    boolean existsByUserId(String userId);
}
