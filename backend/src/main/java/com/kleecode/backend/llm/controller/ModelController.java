package com.kleecode.backend.llm.controller;

import com.kleecode.backend.llm.dto.ModelResponse;
import com.kleecode.backend.llm.service.LLMGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ModelController {

    private final LLMGateway llmGateway;

    @GetMapping("/models")
    public ResponseEntity<List<ModelResponse>> list() {
        return ResponseEntity.ok(llmGateway.availableModels());
    }
}
