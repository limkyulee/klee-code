package com.kleecode.backend.chat.dto;

/**
 * 현재 채팅 백엔드 모델 설정.
 */
public record ChatStatus(
        String provider,
        String model
) {
}
