package com.kleecode.backend.tool.dto;

public record ToolArgumentSchema(
        String name,
        String type,
        String description,
        String exampleValue,
        boolean required
) {
}
