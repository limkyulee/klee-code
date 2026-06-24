package com.kleecode.backend.audit.repository;

import com.kleecode.backend.audit.dto.AuditLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

/**
 * 감사 로그 MongoDB 저장소.
 */
public interface AuditLogRepository extends MongoRepository<AuditLog, String> {
    List<AuditLog> findTop30ByUserIdOrderByCreatedAtDesc(String userId);
}
