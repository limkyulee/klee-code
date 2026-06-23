package com.kleecode.backend.chat.dto;

/**
 * 채팅 요청에 포함되는 코드 컨텍스트 메타데이터.
 */
public record CodeContext(
        String filePath,
        String languageId,
        SelectionRange selectionRange,
        String selectedText,
        String surroundingSnippet
) {
}
