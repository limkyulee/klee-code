package com.kleecode.backend.tool;

import com.kleecode.backend.permission.dto.PermissionMode;
import com.kleecode.backend.tool.dto.ToolSchema;
import com.kleecode.backend.tool.service.ToolPolicyService;
import com.kleecode.backend.tool.service.ToolPromptService;
import com.kleecode.backend.tool.service.ToolRegistry;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ToolRegistryTest {

    private final ToolRegistry registry = new ToolRegistry();

    @Test
    void registryOwnsAvailableToolSchemas() {
        assertTrue(registry.findByName("read_file").isPresent());
        assertTrue(registry.findByName("search_files").isPresent());
        assertTrue(registry.findByName("read_file").orElseThrow().readOnly());
        assertTrue(registry.findByName("read_file").orElseThrow().arguments().stream()
                .anyMatch(argument -> argument.name().equals("path")));
    }

    @Test
    void policyUsesRegistryInsteadOfLocalToolList() {
        ToolPolicyService policyService = new ToolPolicyService(registry);

        assertTrue(policyService.isKnownTool("read_file"));
        assertTrue(policyService.canRunWithoutApproval("search_files", PermissionMode.ASK));
        assertTrue(policyService.canRunWithoutApproval("search_files", PermissionMode.APPROVE));
        assertTrue(policyService.canRunWithoutApproval("search_files", PermissionMode.FULL));
        assertFalse(policyService.isKnownTool("write_file"));
        assertFalse(policyService.canRunWithoutApproval("write_file", PermissionMode.FULL));
    }

    @Test
    void policyAllowsFutureWriteToolsOnlyInFullMode() {
        ToolRegistry registryWithWriteTool = new ToolRegistry() {
            @Override
            public Optional<ToolSchema> findByName(String toolName) {
                if (!toolName.equals("write_file")) {
                    return Optional.empty();
                }
                return Optional.of(new ToolSchema("write_file", "Write a file.", List.of(), false));
            }
        };
        ToolPolicyService policyService = new ToolPolicyService(registryWithWriteTool);

        assertFalse(policyService.canRunWithoutApproval("write_file", PermissionMode.ASK));
        assertFalse(policyService.canRunWithoutApproval("write_file", PermissionMode.APPROVE));
        assertTrue(policyService.canRunWithoutApproval("write_file", PermissionMode.FULL));
    }

    @Test
    void promptInstructionsAreRenderedFromRegistrySchema() {
        ToolPromptService promptService = new ToolPromptService(registry);

        String prompt = promptService.instructions(PermissionMode.ASK);

        assertTrue(prompt.contains("Permission mode: ask"));
        assertTrue(prompt.contains("read_file"));
        assertTrue(prompt.contains("search_files"));
        assertTrue(prompt.contains("path (string, required)"));
        assertTrue(prompt.contains("<klee_tool_call>{\"toolName\":\"read_file\""));
    }
}
