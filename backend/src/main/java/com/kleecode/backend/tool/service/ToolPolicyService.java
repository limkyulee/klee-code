package com.kleecode.backend.tool.service;

import com.kleecode.backend.permission.dto.PermissionMode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ToolPolicyService {

    private final ToolRegistry toolRegistry;

    public boolean isKnownTool(String toolName) {
        return toolRegistry.findByName(toolName).isPresent();
    }

    public boolean canRunWithoutApproval(String toolName, PermissionMode permissionMode) {
        return toolRegistry.findByName(toolName)
                .map(tool -> tool.readOnly())
                .orElse(false);
    }
}
