package com.kleecode.backend.tool.service;

import com.kleecode.backend.permission.dto.PermissionMode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * @description Tool의 정책을 관리하는 서비스
 * ToolPolicyService
 */
@Service
@RequiredArgsConstructor
public class ToolPolicyService {

    private final ToolRegistry toolRegistry;

    public boolean isKnownTool(String toolName) {
        return toolRegistry.findByName(toolName).isPresent();
    }

    public boolean canRunWithoutApproval(String toolName, PermissionMode permissionMode) {
        return toolRegistry.findByName(toolName)
                .map(tool -> switch (permissionMode) {
                    case ASK, APPROVE -> tool.readOnly();
                    case FULL -> true;
                })
                .orElse(false);
    }
}
