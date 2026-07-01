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

/**
 * @description Prompt를 조립하는 서비스
 * - 시스템 프롬프트, 내부 스킬, 사용자 정의 스킬 등을 조합하여 최종 프롬프트를 생성합니다.
 * - LLM을 다루는 심장부
 * - 시스템 프롬프트 -> 내부 스킬 -> 사용자 정의 스킬 -> 프로젝트 규칙 -> 프로젝트 훅 -> 응답 언어 -> 코드 컨텍스트 -> 사용자 질문 순으로 조립됩니다.
 * - 조립 책임을 PromptAssemblyService에 두어, ToolExecutorService와 ToolPromptService가 프롬프트 조립에 관여하지 않도록 한다.
 * PromptAssemblyService
 */
@Service
public class PromptAssemblyService {

    private static final String SYSTEM_PROMPT = "classpath:klee-prompts/system.md";
    private static final String SKILL_PROMPT_PREFIX = "classpath:klee-prompts/skills/";

    private final ResourceLoader resourceLoader;

    public PromptAssemblyService(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    /**
     * 조립된 프롬프트를 생성합니다.
     * @param request Chat 요청 객체
     * @param settings LLM 설정 객체
     * @return 조립된 프롬프트 문자열
     */
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

    /**
     * 코드 컨텍스트를 프롬프트에 추가합니다.
     * @param prompt 프롬프트 문자열 빌더
     * @param request Chat 요청 객체
     */
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

    /**
     * 사용자 정의 스킬을 찾습니다.
     * @param request Chat 요청 객체
     * @param skillName 스킬 이름
     * @return 사용자 정의 스킬 파일 또는 null
     */
    private KleePromptFile findCustomSkill(ChatRequest request, String skillName) {
        if (request.kleeContext() == null || request.kleeContext().skills() == null) {
            return null;
        }
        return request.kleeContext().skills().stream()
                .filter(file -> skillName.equals(normalizeSkillName(file.name())))
                .findFirst()
                .orElse(null);
    }

    /**
     * 여러 개의 파일을 프롬프트에 추가합니다.
     * @param prompt 프롬프트 문자열 빌더
     * @param title 섹션 제목
     * @param files 파일 목록
     */
    private void appendFiles(StringBuilder prompt, String title, List<KleePromptFile> files) {
        if (files == null || files.isEmpty()) {
            return;
        }
        files.stream()
                .filter(file -> file.content() != null && !file.content().isBlank())
                .sorted(Comparator.comparing(KleePromptFile::path, Comparator.nullsLast(String::compareTo)))
                .forEach(file -> appendFile(prompt, title, file));
    }

    /**
     * 단일 파일을 프롬프트에 추가합니다.
     * @param prompt 프롬프트 문자열 빌더
     * @param title 섹션 제목
     * @param file 파일
     */
    private void appendFile(StringBuilder prompt, String title, KleePromptFile file) {
        String label = title;
        if (file.path() != null && !file.path().isBlank()) {
            label += " (" + file.path() + ")";
        }
        appendSection(prompt, label, file.content());
    }

    /**
     * 프롬프트 섹션을 추가합니다.
     * @param prompt 프롬프트 문자열 빌더
     * @param title 섹션 제목
     * @param content 섹션 내용
     */
    private void appendSection(StringBuilder prompt, String title, String content) {
        if (content == null || content.isBlank()) {
            return;
        }
        if (!prompt.isEmpty()) {
            prompt.append("\n\n");
        }
        prompt.append("## ").append(title).append("\n\n").append(content.trim());
    }

    /**
     * 내부 스킬을 로드하고 문자열로 반환합니다.
     * @param skillName 스킬 이름
     * @return 스킬의 내용 문자열 또는 null
     */
    private String loadInternalSkill(String skillName) {
        Resource resource = resourceLoader.getResource(SKILL_PROMPT_PREFIX + skillName + ".md");
        if (!resource.exists()) {
            return null;
        }
        return readResource(resource, SKILL_PROMPT_PREFIX + skillName + ".md");
    }

    /**
     * 리소스를 로드하고 문자열로 반환합니다.
     * @param location 리소스의 위치
     * @return 리소스의 내용 문자열
     */
    private String loadRequiredResource(String location) {
        Resource resource = resourceLoader.getResource(location);
        if (!resource.exists()) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "PROMPT_RESOURCE_MISSING", "Prompt resource is missing");
        }
        return readResource(resource, location);
    }

    /**
     * 리소스를 읽어 문자열로 반환합니다.
     * @param resource 읽을 리소스
     * @param location 리소스의 위치
     * @return 리소스의 내용 문자열
     */
    private String readResource(Resource resource, String location) {
        try {
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "PROMPT_RESOURCE_UNREADABLE", "Prompt resource is unreadable: " + location);
        }
    }

    /**
     * 스킬 이름을 정규화합니다.
     * @param name 스킬 이름
     * @return 정규화된 스킬 이름 또는 null
     */
    private String normalizeSkillName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        String normalized = name.trim().toLowerCase(Locale.ROOT);
        return normalized.matches("[a-z0-9_-]+") ? normalized : null;
    }
}
