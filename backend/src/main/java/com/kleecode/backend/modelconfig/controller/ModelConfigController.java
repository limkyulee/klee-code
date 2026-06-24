package com.kleecode.backend.modelconfig.controller;

import com.kleecode.backend.modelconfig.dto.ModelConfigRequest;
import com.kleecode.backend.modelconfig.dto.ModelConfigResponse;
import com.kleecode.backend.modelconfig.service.ModelConfigService;
import com.kleecode.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/me/model-config")
@RequiredArgsConstructor
public class ModelConfigController {

    private final ModelConfigService modelConfigService;

    @GetMapping
    public ResponseEntity<ModelConfigResponse> get(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(modelConfigService.findResponse(user.userId()));
    }

    @PutMapping
    public ResponseEntity<ModelConfigResponse> save(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody ModelConfigRequest request
    ) {
        return ResponseEntity.ok(modelConfigService.save(user.userId(), request));
    }
}
