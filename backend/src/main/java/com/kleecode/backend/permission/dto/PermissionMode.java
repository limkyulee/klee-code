package com.kleecode.backend.permission.dto;

import java.util.Locale;

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
