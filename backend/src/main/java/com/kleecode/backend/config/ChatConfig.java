package com.kleecode.backend.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AI 채팅 관련 Spring 빈 설정.
 *
 * <p>ChatMemory (MessageWindowChatMemory + MongoChatMemoryRepository) 는
 * spring-ai-starter-model-chat-memory-repository-mongodb 스타터가
 * MongoChatMemoryAutoConfiguration 을 통해 자동으로 등록하므로 여기서는 정의하지 않는다.
 *
 * <p>이 클래스의 역할은 ChatClient 빈 하나만 구성하는 것이다:
 * <ul>
 *   <li>어떤 모델을 쓸지 — spring.ai.model.chat 설정으로 Anthropic/Ollama 선택</li>
 *   <li>연속 대화를 위해 MessageChatMemoryAdvisor 를 기본 advisor 로 등록</li>
 *   <li>어시스턴트의 역할을 정의하는 시스템 프롬프트 설정</li>
 * </ul>
 */
@Configuration
public class ChatConfig {

    /**
     * 어플리케이션 전체에서 공유하는 ChatClient 빈.
     *
     * <p>Spring 권고에 따라 @Bean 메서드를 package-private 으로 선언한다.
     * CGLIB 프록시가 메서드 가시성에 의존하지 않으므로 접근 범위를 좁혀도 동작한다.
     *
     * @param chatModel  spring.ai.model.chat 값에 따라 auto-configure 된 모델
     * @param chatMemory auto-configure 된 MongoDB 기반 메모리
     */
    @Bean
    ChatClient chatClient(ChatModel chatModel, ChatMemory chatMemory) {
        /* MessageChatMemoryAdvisor: 매 요청 전 conversationId 로 과거 대화를 불러와
           프롬프트에 주입하고, 응답 후 새 턴을 저장한다 (최대 20턴 유지). */
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
