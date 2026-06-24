package com.kleecode.backend.chat.service;

import com.kleecode.backend.modelconfig.dto.UserModelConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.ai.ollama.api.OllamaModel;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UserOllamaChatClientFactory {

    private final ChatMemory chatMemory;

    public ChatClient create(UserModelConfig config) {
        OllamaApi ollamaApi = OllamaApi.builder()
                .baseUrl(config.baseUrl())
                .build();
        OllamaChatModel chatModel = OllamaChatModel.builder()
                .ollamaApi(ollamaApi)
                .options(OllamaChatOptions.builder().model(OllamaModel.QWEN_2_5_3B).build())
                .build();

        return ChatClient.builder(chatModel)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .defaultSystem("""
                        You are a helpful coding assistant running on-premises.
                        When given code and a question, provide clear and concise answers.
                        Keep responses focused and actionable.
                        """)
                .build();
    }
}
