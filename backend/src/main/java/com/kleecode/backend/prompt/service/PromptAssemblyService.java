package com.kleecode.backend.prompt.service;

import com.kleecode.backend.chat.dto.ChatRequest;
import com.kleecode.backend.chat.dto.KleePromptFile;
import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.llm.dto.EffectiveLlmSettings;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class PromptAssemblyService {

    private static final String SYSTEM_PROMPT = "classpath:klee-prompts/system.md";
    private static final String SKILL_PROMPT_PREFIX = "classpath:klee-prompts/skills/";

    private final ResourceLoader resourceLoader;

    public PromptAssemblyService(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    public String assemble(ChatRequest request, EffectiveLlmSettings settings) {
        String skillName = normalizeSkillName(request.skillCommand() == null ? null : request.skillCommand().name());
        String internalSkill = skillName == null ? null : loadInternalSkill(skillName);
        KleePromptFile customSkill = skillName == null || internalSkill != null
                ? null
                : findCustomSkill(request, skillName);

        if (skillName != null && internalSkill == null && customSkill == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNKNOWN_SKILL", "Unknown skill: /" + skillName);
        }

        StringBuilder prompt = new StringBuilder();
        appendSection(prompt, "Klee Code System Prompt", loadRequiredResource(SYSTEM_PROMPT));
        if (internalSkill != null) {
            appendSection(prompt, "Internal Skill /" + skillName, internalSkill);
        }
        appendFiles(prompt, "Project Rules", request.kleeContext() == null ? null : request.kleeContext().rules());
        if (customSkill != null) {
            appendFile(prompt, "Custom Skill /" + skillName, customSkill);
        }
        appendFiles(prompt, "Project Hooks", request.kleeContext() == null ? null : request.kleeContext().hooks());
        appendSection(prompt, "Response Language", "Respond in " + settings.responseLanguage() + ".");
        appendCodeContext(prompt, request);
        appendSection(prompt, "User Question", request.question());
        return prompt.toString();
    }

    private void appendCodeContext(StringBuilder prompt, ChatRequest request) {
        if (request.code() == null || request.code().isBlank()) {
            return;
        }

        StringBuilder codeContext = new StringBuilder();
        if (request.context() != null) {
            if (request.context().filePath() != null && !request.context().filePath().isBlank()) {
                codeContext.append("File: ").append(request.context().filePath()).append('\n');
            }
            if (request.context().languageId() != null && !request.context().languageId().isBlank()) {
                codeContext.append("Language: ").append(request.context().languageId()).append('\n');
            }
        }

        codeContext.append("Selected code:\n```\n")
                .append(request.code())
                .append("\n```");

        if (request.context() != null
                && request.context().surroundingSnippet() != null
                && !request.context().surroundingSnippet().isBlank()) {
            codeContext.append("\n\nSurrounding context:\n```\n")
                    .append(request.context().surroundingSnippet())
                    .append("\n```");
        }

        appendSection(prompt, "Code Context", codeContext.toString());
    }

    private KleePromptFile findCustomSkill(ChatRequest request, String skillName) {
        if (request.kleeContext() == null || request.kleeContext().skills() == null) {
            return null;
        }
        return request.kleeContext().skills().stream()
                .filter(file -> skillName.equals(normalizeSkillName(file.name())))
                .findFirst()
                .orElse(null);
    }

    private void appendFiles(StringBuilder prompt, String title, List<KleePromptFile> files) {
        if (files == null || files.isEmpty()) {
            return;
        }
        files.stream()
                .filter(file -> file.content() != null && !file.content().isBlank())
                .sorted(Comparator.comparing(KleePromptFile::path, Comparator.nullsLast(String::compareTo)))
                .forEach(file -> appendFile(prompt, title, file));
    }

    private void appendFile(StringBuilder prompt, String title, KleePromptFile file) {
        String label = title;
        if (file.path() != null && !file.path().isBlank()) {
            label += " (" + file.path() + ")";
        }
        appendSection(prompt, label, file.content());
    }

    private void appendSection(StringBuilder prompt, String title, String content) {
        if (content == null || content.isBlank()) {
            return;
        }
        if (!prompt.isEmpty()) {
            prompt.append("\n\n");
        }
        prompt.append("## ").append(title).append("\n\n").append(content.trim());
    }

    private String loadInternalSkill(String skillName) {
        Resource resource = resourceLoader.getResource(SKILL_PROMPT_PREFIX + skillName + ".md");
        if (!resource.exists()) {
            return null;
        }
        return readResource(resource, SKILL_PROMPT_PREFIX + skillName + ".md");
    }

    private String loadRequiredResource(String location) {
        Resource resource = resourceLoader.getResource(location);
        if (!resource.exists()) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "PROMPT_RESOURCE_MISSING", "Prompt resource is missing");
        }
        return readResource(resource, location);
    }

    private String readResource(Resource resource, String location) {
        try {
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "PROMPT_RESOURCE_UNREADABLE", "Prompt resource is unreadable: " + location);
        }
    }

    private String normalizeSkillName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        String normalized = name.trim().toLowerCase(Locale.ROOT);
        return normalized.matches("[a-z0-9_-]+") ? normalized : null;
    }
}
