package com.kleecode.backend.prompt;

import com.kleecode.backend.chat.dto.ChatRequest;
import com.kleecode.backend.chat.dto.KleeContext;
import com.kleecode.backend.chat.dto.KleePromptFile;
import com.kleecode.backend.chat.dto.SkillCommand;
import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.llm.dto.EffectiveLlmSettings;
import com.kleecode.backend.prompt.service.PromptAssemblyService;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.http.HttpStatus;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PromptAssemblyServiceTest {

    private final PromptAssemblyService service = new PromptAssemblyService(new DefaultResourceLoader());
    private final EffectiveLlmSettings settings = new EffectiveLlmSettings("ollama", "qwen", 0.2, "Korean");

    @Test
    void includesInternalSkillForSlashCommand() {
        ChatRequest request = request("Review this", new SkillCommand("review"), null);

        String prompt = service.assemble(request, settings);

        assertTrue(prompt.contains("## Internal Skill /review"));
        assertTrue(prompt.contains("요약보다 발견한 문제와 근거를 먼저 제시하세요."));
        assertTrue(prompt.contains("## User Question"));
        assertTrue(prompt.contains("Review this"));
    }

    @Test
    void includesCustomSkillWhenInternalSkillDoesNotExist() {
        KleeContext context = new KleeContext(
                List.of(),
                List.of(new KleePromptFile("foo", ".klee/skills/foo.md", "Use the foo workflow.")),
                List.of()
        );

        String prompt = service.assemble(request("Run it", new SkillCommand("foo"), context), settings);

        assertTrue(prompt.contains("## Custom Skill /foo"));
        assertTrue(prompt.contains("Use the foo workflow."));
    }

    @Test
    void internalSkillWinsWhenCustomSkillNameConflicts() {
        KleeContext context = new KleeContext(
                List.of(),
                List.of(new KleePromptFile("review", ".klee/skills/review.md", "Custom review override.")),
                List.of()
        );

        String prompt = service.assemble(request("Review this", new SkillCommand("review"), context), settings);

        assertTrue(prompt.contains("## Internal Skill /review"));
        assertTrue(!prompt.contains("Custom review override."));
    }

    @Test
    void unknownSkillFails() {
        ApiException ex = assertThrows(ApiException.class, () ->
                service.assemble(request("Run it", new SkillCommand("missing"), null), settings));

        assertEquals(HttpStatus.BAD_REQUEST, ex.status());
        assertEquals("UNKNOWN_SKILL", ex.code());
    }

    @Test
    void worksWithoutSlashCommand() {
        String prompt = service.assemble(request("Plain question", null, null), settings);

        assertTrue(prompt.contains("## Klee Code System Prompt"));
        assertTrue(prompt.contains("Plain question"));
    }

    private ChatRequest request(String question, SkillCommand command, KleeContext context) {
        return new ChatRequest("conversation-1", null, question, null, command, context);
    }
}
