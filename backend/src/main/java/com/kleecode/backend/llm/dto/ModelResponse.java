package com.kleecode.backend.llm.dto;

public class ModelResponse {

    private final String name;
    private final String displayName;
    private final boolean defaultModel;

    public ModelResponse(String name, String displayName, boolean defaultModel) {
        this.name = name;
        this.displayName = displayName;
        this.defaultModel = defaultModel;
    }

    public String getName() {
        return name;
    }

    public String getDisplayName() {
        return displayName;
    }

    public boolean isDefault() {
        return defaultModel;
    }
}
