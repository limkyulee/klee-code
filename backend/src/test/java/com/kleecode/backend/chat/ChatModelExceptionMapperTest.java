package com.kleecode.backend.chat;

import com.kleecode.backend.chat.service.ChatModelExceptionMapper;
import com.kleecode.backend.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.net.ConnectException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChatModelExceptionMapperTest {

    private final ChatModelExceptionMapper mapper = new ChatModelExceptionMapper();

    @Test
    void mapsModelConnectionFailureToServiceUnavailableApiException() {
        RuntimeException mapped = mapper.map(
                new RuntimeException(new ConnectException("Connection refused"))
        );

        assertTrue(mapped instanceof ApiException);
        ApiException apiException = (ApiException) mapped;
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, apiException.status());
        assertEquals("MODEL_SERVER_UNAVAILABLE", apiException.code());
        assertEquals(
                "Central model server is unavailable. Contact the administrator.",
                apiException.getMessage()
        );
    }

    @Test
    void keepsExistingApiException() {
        ApiException source = new ApiException(HttpStatus.CONFLICT, "EXISTING_ERROR", "Existing error");

        RuntimeException mapped = mapper.map(source);

        assertSame(source, mapped);
    }
}
