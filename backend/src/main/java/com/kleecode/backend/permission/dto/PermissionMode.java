package com.kleecode.backend.permission.dto;

import java.util.Locale;

/**
 * @description 권한 모드를 나타내는 Enum
 * - ASK: 사용자가 권한을 요청해야 하는 모드
 * - APPROVE: 사용자가 권한을 승인해야 하는 모드
 * - FULL: 모든 권한이 허용되는 모드
 * PermissionMode
 */
public enum PermissionMode {
    ASK,
    APPROVE,
    FULL;

    public static PermissionMode from(String value) {
        if (value == null || value.isBlank()) {
            return ASK;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "approve" -> APPROVE;
            case "full" -> FULL;
            default -> ASK;
        };
    }

    public String wireValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
