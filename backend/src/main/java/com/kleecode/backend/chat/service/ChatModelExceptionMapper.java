package com.kleecode.backend.chat.service;

import com.kleecode.backend.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClientRequestException;

import java.net.ConnectException;

@Component
public class ChatModelExceptionMapper {

    public RuntimeException map(Throwable ex) {
        if (ex instanceof ApiException apiException) {
            return apiException;
        }

        if (isConnectionFailure(ex)) {
            return new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "MODEL_SERVER_UNAVAILABLE",
                    "Central model server is unavailable. Contact the administrator."
            );
        }

        if (ex instanceof RuntimeException runtimeException) {
            return runtimeException;
        }

        return new ApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "MODEL_REQUEST_FAILED",
                "Model request failed"
        );
    }

    private boolean isConnectionFailure(Throwable ex) {
        Throwable current = ex;
        while (current != null) {
            if (current instanceof WebClientRequestException || current instanceof ConnectException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
