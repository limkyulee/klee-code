package com.kleecode.backend.chat.controller;

import com.kleecode.backend.chat.dto.ChatRequest;
import com.kleecode.backend.chat.dto.ChatResponse;
import com.kleecode.backend.chat.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;

/**
 * 채팅 API 컨트롤러.
 *
 * <p>Spring MVC 레이어 역할만 담당하며 비즈니스 로직은 ChatService 에 위임한다.
 * CORS 는 WebConfig 에서 전역으로 허용하므로 이 클래스에는 설정하지 않는다.
 *
 * <ul>
 *   <li>POST /chat — 질문을 받아 LLM 응답을 반환</li>
 * </ul>
 */
@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    /**
     * 질문을 LLM 에 전달하고 응답을 반환한다.
     *
     * @param request conversationId, code(선택), question 을 담은 요청 바디
     * @return 200 OK + LLM 응답 텍스트
     */
    @PostMapping
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        String answer = chatService.chat(request);

        /* ResponseEntity 로 감싸 HTTP 상태 코드를 명시적으로 제어한다.
           이후 에러 케이스(모델 타임아웃, 잘못된 요청 등)에서 상태 코드를 달리할 수 있다. */
        return ResponseEntity.ok(new ChatResponse(answer));
    }

    /**
     * 질문을 LLM 에 전달하고 SSE 로 진행 상태와 응답 조각을 반환한다.
     *
     * @param request conversationId, code(선택), question 을 담은 요청 바디
     * @return progress/token/done SSE 이벤트 스트림
     */
    @PostMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestBody ChatRequest request) {
        SseEmitter emitter = new SseEmitter(0L);

        sendEvent(emitter, "progress", "Request received. Preparing prompt and conversation memory...");

        chatService.stream(request)
                .doOnSubscribe(subscription ->
                        sendEvent(emitter, "progress", "Model stream opened. Receiving tokens..."))
                .subscribe(
                        token -> sendEvent(emitter, "token", token),
                        emitter::completeWithError,
                        () -> {
                            sendEvent(emitter, "progress", "Response complete.");
                            sendEvent(emitter, "done", "");
                            emitter.complete();
                        }
                );

        return emitter;
    }

    private void sendEvent(SseEmitter emitter, String name, String data) {
        try {
            synchronized (emitter) {
                emitter.send(SseEmitter.event().name(name).data(data));
            }
        } catch (IOException ex) {
            emitter.completeWithError(ex);
        }
    }
}
