package com.kleecode.backend.modelconfig;

import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.modelconfig.dto.ModelConfigRequest;
import com.kleecode.backend.modelconfig.dto.ModelProvider;
import com.kleecode.backend.modelconfig.repository.UserModelConfigRepository;
import com.kleecode.backend.modelconfig.service.ModelConfigService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
class ModelConfigServiceTest {

    @MockitoBean
    private UserModelConfigRepository userModelConfigRepository;

    @Autowired
    private ModelConfigService modelConfigService;

    @Test
    void missingConfigReturnsUnconfiguredState() {
        when(userModelConfigRepository.findByUserId("user-1")).thenReturn(Optional.empty());

        var response = modelConfigService.findResponse("user-1");

        assertFalse(response.configured());
    }

    @Test
    void requireConfigRejectsMissingConfig() {
        when(userModelConfigRepository.findByUserId("user-1")).thenReturn(Optional.empty());

        assertThrows(ApiException.class, () -> modelConfigService.requireConfig("user-1"));
    }

    @Test
    void saveStoresOllamaConfigForUser() {
        when(userModelConfigRepository.findByUserId("user-1")).thenReturn(Optional.empty());
        when(userModelConfigRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = modelConfigService.save(
                "user-1",
                new ModelConfigRequest(ModelProvider.OLLAMA, "http://localhost:11434/", "qwen2.5-coder:3b")
        );

        assertTrue(response.configured());
        assertEquals("http://localhost:11434", response.baseUrl());
        assertEquals("qwen2.5-coder:3b", response.modelName());
    }
}
