package com.kleecode.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * @description 웹 애플리케이션의 CORS 설정을 관리하는 구성 클래스
 * - 모든 엔드포인트에 대해 CORS를 허용하여 개발 편의성을 제공합니다.
 * - 실제 운영 환경에서는 보안상의 이유로 CORS 정책을 제한하는 것이 권장됩니다.
 * WebConfig
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        /* 모든 엔드포인트에 대해 CORS 허용 — Phase 0 개발 편의용 */
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type", "Accept");
    }
}
