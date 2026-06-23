package com.kleecode.backend.chat.dto;

/**
 * 코드 선택 범위.
 */
public record SelectionRange(
        int startLine,
        int startCharacter,
        int endLine,
        int endCharacter
) {
}
