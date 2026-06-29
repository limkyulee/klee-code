package com.kleecode.backend.auth.service;

import com.kleecode.backend.user.dto.AppUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class TokenService {

    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;
    private final Duration accessTokenTtl;

    public TokenService(
            JwtEncoder jwtEncoder,
            JwtDecoder jwtDecoder,
            @Value("${klee-code.security.access-token-ttl-minutes}") long accessTokenTtlMinutes
    ) {
        this.jwtEncoder = jwtEncoder;
        this.jwtDecoder = jwtDecoder;
        this.accessTokenTtl = Duration.ofMinutes(accessTokenTtlMinutes);
    }

    public String createAccessToken(AppUser user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("klee-code")
                .issuedAt(now)
                .expiresAt(now.plus(accessTokenTtl))
                .subject(user.userId())
                .claim("roles", user.roles().stream().map(Enum::name).toList())
                .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public Jwt decode(String token) {
        return jwtDecoder.decode(token);
    }

    public long accessTokenTtlSeconds() {
        return accessTokenTtl.toSeconds();
    }

    public List<String> roles(Jwt jwt) {
        Object roles = jwt.getClaims().get("roles");
        if (roles instanceof List<?> roleList) {
            return roleList.stream().map(String::valueOf).toList();
        }
        return List.of();
    }
}
