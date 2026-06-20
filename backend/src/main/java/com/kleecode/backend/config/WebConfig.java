package com.kleecode.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Spring MVC 전역 설정.
 *
 * <p>VS Code 확장(Node.js)은 브라우저가 아니라 CORS 제약이 없지만,
 * 추후 WebView나 외부 클라이언트 연동을 위해 전역 CORS를 허용해 둔다.
 * 실제 프로덕션에서는 allowedOrigins 를 사내 도메인으로 제한해야 한다.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        /* 모든 엔드포인트에 대해 CORS 허용 — Phase 0 개발 편의용 */
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "OPTIONS");
    }
}
