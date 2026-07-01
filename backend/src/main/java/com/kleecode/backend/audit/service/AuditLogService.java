package com.kleecode.backend.audit.service;

import com.kleecode.backend.audit.dto.AuditLog;
import com.kleecode.backend.audit.repository.AuditLogRepository;
import com.kleecode.backend.chat.dto.ChatRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * @description Audit Log를 관리하는 서비스
 * - Audit Log의 시작, 성공, 실패 상태를 관리합니다.
 * - 데이터베이스에 안전하게 저장하며, 저장 실패 시 경고 로그를 남깁니다.
 * AuditLogService
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    /**
     * 새로운 Audit Log를 시작합니다.
     * @param userId 사용자 ID
     * @param request Chat 요청 정보
     * @param modelProvider 모델 제공자
     * @param externalTransfer 외부 전송 여부
     * @return 시작된 Audit Log
     */
    public Optional<AuditLog> start(String userId, ChatRequest request, String modelProvider, boolean externalTransfer) {
        return saveSafely(AuditLog.started(
                userId,
                request.conversationId(),
                modelProvider,
                externalTransfer,
                request.context(),
                request.question()));
    }

    /**
     * Audit Log를 성공 상태로 표시합니다.
     * @param auditLog 현재 Audit Log
     * @param answer LLM의 응답
     * @return 성공 상태로 표시된 Audit Log
     */
    public Optional<AuditLog> markSucceeded(Optional<AuditLog> auditLog, String answer) {
        return auditLog.flatMap(log -> saveSafely(log.markSucceeded(answer)));
    }

    /**
     * Audit Log를 실패 상태로 표시합니다.
     * @param auditLog 현재 Audit Log
     * @param errorMessage 오류 메시지
     * @return 실패 상태로 표시된 Audit Log
     */
    public Optional<AuditLog> markFailed(Optional<AuditLog> auditLog, String errorMessage) {
        return auditLog.flatMap(log -> saveSafely(log.markFailed(errorMessage)));
    }

    /**
     * Audit Log를 안전하게 저장합니다.
     * - 데이터베이스 저장 중 예외가 발생하면 경고 로그를 남기고 Optional.empty()를 반환합니다.
     * @param auditLog 저장할 Audit Log
     * @return 저장된 Audit Log 또는 Optional.empty()
     */
    private Optional<AuditLog> saveSafely(AuditLog auditLog) {
        try {
            return Optional.of(auditLogRepository.save(auditLog));
        } catch (DataAccessException ex) {
            log.warn("Failed to persist audit log: {}", ex.getMessage());
            return Optional.empty();
        } catch (RuntimeException ex) {
            log.warn("Failed to persist audit log: {}", ex.getMessage());
            return Optional.empty();
        }
    }
}
