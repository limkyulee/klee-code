package com.kleecode.backend.chat.dto;

/**
 * Markdown prompt fragment loaded from .klee.
 */
public record KleePromptFile(
        String name,
        String path,
        String content
) {
}
