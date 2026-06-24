package com.kleecode.backend.user;

import com.kleecode.backend.common.ApiException;
import com.kleecode.backend.user.dto.AppUser;
import com.kleecode.backend.user.repository.UserRepository;
import com.kleecode.backend.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
class UserServiceTest {

    @MockitoBean
    private UserRepository userRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void registerStoresBcryptPasswordHash() {
        when(userRepository.existsByUserId("user-1")).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var user = userService.register("user-1", "password-1");

        assertNotEquals("password-1", user.passwordHash());
        assertTrue(passwordEncoder.matches("password-1", user.passwordHash()));
    }

    @Test
    void registerRejectsDuplicateUserId() {
        when(userRepository.existsByUserId("user-1")).thenReturn(true);

        assertThrows(ApiException.class, () -> userService.register("user-1", "password-1"));
    }

    @Test
    void authenticateRejectsWrongPassword() {
        var user = AppUser.create("user-2", passwordEncoder.encode("password-1"));
        when(userRepository.findByUserId("user-2")).thenReturn(Optional.of(user));

        assertThrows(ApiException.class, () -> userService.authenticate("user-2", "password-2"));
    }
}
