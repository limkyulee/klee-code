package com.kleecode.backend.tool.dto;

import java.util.List;

public record ToolSchema(
        String name,
        String description,
        List<ToolArgumentSchema> arguments,
        boolean readOnly
) {
}
