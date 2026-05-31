package com.firesafetypro.controller;

import com.firesafetypro.model.User;
import com.firesafetypro.repository.UserRepository;
import com.firesafetypro.service.SupabaseAuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final UserRepository userRepository;
    private final SupabaseAuthService authService;

    public AdminUserController(UserRepository userRepository, SupabaseAuthService authService) {
        this.userRepository = userRepository;
        this.authService = authService;
    }

    @PostMapping
    public ResponseEntity<?> registerUser(@RequestBody Map<String, String> payload, @AuthenticationPrincipal Jwt jwt) {
        String email = payload.get("email");
        String username = payload.get("username");
        String fullName = payload.get("fullName");
        String password = payload.get("password");
        String role = "ROLE_USER"; // By default, admins create inspectors (ROLE_USER)

        if (userRepository.findByEmail(email).isPresent() || userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("error", "User with this email or username already exists."));
        }

        try {
            // 1. Create user in Supabase Auth via Admin API
            String authUserIdStr = authService.createAuthUser(email, password, fullName, role);
            UUID authUserId = UUID.fromString(authUserIdStr);

            // 2. Insert into our public.users table
            User user = new User();
            user.setId(authUserId);
            user.setEmail(email);
            user.setUsername(username);
            user.setFullName(fullName);
            user.setRole(role);
            user.setIsEnabled(true);

            String creatorId = jwt.getClaimAsString("sub");
            if (creatorId != null) {
                user.setCreatedBy(UUID.fromString(creatorId));
            }

            user = userRepository.save(user);
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to create user: " + e.getMessage()));
        }
    }
}
