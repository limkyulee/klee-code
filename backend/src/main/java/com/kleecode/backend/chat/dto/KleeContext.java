package com.kleecode.backend.chat.dto;

import java.util.List;

/**
 * Project-level Klee customization files collected by the VS Code extension.
 */
public record KleeContext(
        List<KleePromptFile> rules,
        List<KleePromptFile> skills,
        List<KleePromptFile> hooks
) {
}
