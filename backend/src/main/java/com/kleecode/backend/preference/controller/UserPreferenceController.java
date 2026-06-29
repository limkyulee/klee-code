package com.kleecode.backend.preference.controller;

import com.kleecode.backend.preference.dto.UserPreferenceRequest;
import com.kleecode.backend.preference.dto.UserPreferenceResponse;
import com.kleecode.backend.preference.service.UserPreferenceService;
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
@RequestMapping("/me/preferences")
@RequiredArgsConstructor
public class UserPreferenceController {

    private final UserPreferenceService userPreferenceService;

    @GetMapping
    public ResponseEntity<UserPreferenceResponse> get(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(userPreferenceService.findResponse(user.userId()));
    }

    @PutMapping
    public ResponseEntity<UserPreferenceResponse> save(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody UserPreferenceRequest request
    ) {
        return ResponseEntity.ok(userPreferenceService.save(user.userId(), request));
    }
}
