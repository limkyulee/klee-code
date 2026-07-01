package com.kleecode.backend.security;

import com.kleecode.backend.auth.service.TokenService;
import com.kleecode.backend.user.dto.UserRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final TokenService tokenService;

    /**
     * JWT 인증 필터
     * - 요청 헤더에서 JWT 토큰을 추출하고, 유효성을 검사합니다.
     * - 토큰이 유효하면 SecurityContext에 인증 정보를 설정합니다.
     * - 토큰이 없거나 유효하지 않으면 SecurityContext를 초기화합니다.
     * - 이 필터는 요청당 한 번만 실행됩니다.
     * @param request HTTP 요청
     * @param response HTTP 응답
     * @param filterChain 필터 체인
     * @throws ServletException 서블릿 예외
     * @throws IOException 입출력 예외
     */
    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            Jwt jwt = tokenService.decode(authorization.substring("Bearer ".length()));
            Set<UserRole> roles = tokenService.roles(jwt).stream()
                    .map(UserRole::valueOf)
                    .collect(Collectors.toUnmodifiableSet());
            AuthenticatedUser user = new AuthenticatedUser(jwt.getSubject(), roles);
            var authorities = roles.stream()
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                    .toList();
            var authentication = new UsernamePasswordAuthenticationToken(user, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (RuntimeException ignored) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }
}
