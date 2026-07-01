package com.kleecode.backend.tool.service;

import com.kleecode.backend.tool.dto.ToolArgumentSchema;
import com.kleecode.backend.tool.dto.ToolSchema;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * @description Tool을 관리하는 서비스
 * ToolRegistry
 */
@Service
public class ToolRegistry {

    private final List<ToolSchema> tools = List.of(
            new ToolSchema(
                    "read_file",
                    "Read a UTF-8 text file inside the active VS Code workspace.",
                    List.of(new ToolArgumentSchema(
                            "path",
                            "string",
                            "Relative or workspace file path to read.",
                            "path/from/workspace",
                            true
                    )),
                    true
            ),
            new ToolSchema(
                    "search_files",
                    "Search active workspace file paths by a short query.",
                    List.of(new ToolArgumentSchema(
                            "query",
                            "string",
                            "Filename or path fragment to search for.",
                            "filename-or-path-fragment",
                            true
                    )),
                    true
            )
    );

    public List<ToolSchema> availableTools() {
        return tools;
    }

    public Optional<ToolSchema> findByName(String toolName) {
        return tools.stream()
                .filter(tool -> tool.name().equals(toolName))
                .findFirst();
    }
}
