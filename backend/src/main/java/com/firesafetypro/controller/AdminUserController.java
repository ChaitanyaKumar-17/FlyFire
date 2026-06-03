package com.firesafetypro.controller;

import com.firesafetypro.model.User;
import com.firesafetypro.model.UserRole;
import com.firesafetypro.model.Zone;
import com.firesafetypro.repository.UserRepository;
import com.firesafetypro.repository.ZoneRepository;
import com.firesafetypro.service.SupabaseAuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import jakarta.persistence.EntityManager;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
@CrossOrigin("*")
public class AdminUserController {

    private final UserRepository userRepository;
    private final ZoneRepository zoneRepository;
    private final SupabaseAuthService authService;
    private final EntityManager entityManager;
    private final TransactionTemplate transactionTemplate;

    public AdminUserController(UserRepository userRepository, ZoneRepository zoneRepository, SupabaseAuthService authService, EntityManager entityManager, TransactionTemplate transactionTemplate) {
        this.userRepository = userRepository;
        this.zoneRepository = zoneRepository;
        this.authService = authService;
        this.entityManager = entityManager;
        this.transactionTemplate = transactionTemplate;
    }

    @PostMapping
    public ResponseEntity<?> registerUser(@RequestBody Map<String, String> payload, @AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {
        String email = payload.get("email");
        String username = payload.get("username");
        String fullName = payload.get("fullName");
        String password = payload.get("password");
        
        String creatorIdStr = jwt.getClaimAsString("sub");
        if (creatorIdStr == null) return ResponseEntity.status(401).build();
        UUID creatorId = UUID.fromString(creatorIdStr);
        
        User creator = userRepository.findById(creatorId).orElse(null);
        if (creator == null) return ResponseEntity.status(401).build();

        String requestedRoleStr = payload.getOrDefault("role", "ROLE_USER");
        UserRole targetRole = UserRole.valueOf(requestedRoleStr);
        
        Zone targetZone = null;

        if (creator.getRole() == UserRole.ROLE_SUPERADMIN) {
            String zoneIdStr = payload.get("zoneId");
            if (zoneIdStr != null && !zoneIdStr.isBlank()) {
                targetZone = zoneRepository.findById(UUID.fromString(zoneIdStr)).orElse(null);
            }
        } else if (creator.getRole() == UserRole.ROLE_ADMIN) {
            if (targetRole == UserRole.ROLE_SUPERADMIN || targetRole == UserRole.ROLE_ADMIN) {
                return ResponseEntity.status(403).body(Map.of("error", "Admins can only create users."));
            }
            targetZone = creator.getZone(); // Force into Admin's zone
        } else {
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions."));
        }

        User existingByEmail = userRepository.findByEmail(email).orElse(null);
        User existingByUsername = userRepository.findByUsername(username).orElse(null);

        if (existingByEmail != null || existingByUsername != null) {
            User existing = existingByEmail != null ? existingByEmail : existingByUsername;

            if (existing.getIsEnabled()) {
                return ResponseEntity.status(409).body(Map.of("error", "User with this email or username already exists and is active."));
            }

            try {
                // User exists but is soft-deleted. Reactivate them.
                authService.reactivateAuthUser(existing.getId().toString(), password, fullName, targetRole.name());

                existing.setFullName(fullName);
                existing.setRole(targetRole);
                existing.setZone(targetZone);
                existing.setIsEnabled(true);
                existing.setIsFirstLogin(true);
                
                // Allow them to reuse their email and username for the new registration
                existing.setEmail(email);
                existing.setUsername(username);

                userRepository.save(existing);
                return ResponseEntity.ok(existing);
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Failed to reactivate soft-deleted user: " + e.getMessage()));
            }
        }

        try {
            // 1. Create user in Supabase Auth via Admin API
            String authUserIdStr = authService.createAuthUser(email, password, fullName, targetRole.name());
            UUID authUserId = UUID.fromString(authUserIdStr);

            // 2. Insert into our public.users table
            User user = new User();
            user.setId(authUserId);
            user.setEmail(email);
            user.setUsername(username);
            user.setFullName(fullName);
            user.setRole(targetRole);
            user.setZone(targetZone);
            user.setIsEnabled(true);
            user.setCreatedBy(creatorId);

            user = userRepository.save(user);
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to create user: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        String requesterIdStr = jwt.getClaimAsString("sub");
        if (requesterIdStr == null) return ResponseEntity.status(401).build();

        User requester = userRepository.findById(UUID.fromString(requesterIdStr)).orElse(null);
        User targetUser = userRepository.findById(id).orElse(null);

        if (requester == null || targetUser == null) return ResponseEntity.notFound().build();

        if (requester.getRole() == UserRole.ROLE_ADMIN) {
            if (targetUser.getRole() == UserRole.ROLE_SUPERADMIN || targetUser.getRole() == UserRole.ROLE_ADMIN) {
                return ResponseEntity.status(403).body(Map.of("error", "Admins can only delete normal users."));
            }
            if (!requester.getZone().getId().equals(targetUser.getZone().getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Cannot delete users outside your zone."));
            }
        } else if (requester.getRole() != UserRole.ROLE_SUPERADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions."));
        }

        try {
            // Perform soft delete to preserve inspection records
            transactionTemplate.execute(status -> {
                targetUser.setIsEnabled(false);
                userRepository.save(targetUser);
                return null;
            });
            
            // Suspend the user in Supabase Auth so they can never log in again
            authService.disableAuthUser(id.toString());
            return ResponseEntity.ok(Map.of("message", "User successfully soft-deleted and records preserved."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to delete user: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<?> resetUserPassword(@PathVariable UUID id, @RequestBody Map<String, String> payload, @AuthenticationPrincipal Jwt jwt) {
        String requesterIdStr = jwt.getClaimAsString("sub");
        if (requesterIdStr == null) return ResponseEntity.status(401).build();

        String newPassword = payload.get("password");
        if (newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password is required."));
        }

        User requester = userRepository.findById(UUID.fromString(requesterIdStr)).orElse(null);
        User targetUser = userRepository.findById(id).orElse(null);

        if (requester == null || targetUser == null) return ResponseEntity.notFound().build();

        // Permission check
        if (requester.getRole() == UserRole.ROLE_ADMIN) {
            if (targetUser.getRole() == UserRole.ROLE_SUPERADMIN || targetUser.getRole() == UserRole.ROLE_ADMIN) {
                return ResponseEntity.status(403).body(Map.of("error", "Admins can only reset passwords for normal users."));
            }
            if (!requester.getZone().getId().equals(targetUser.getZone().getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Cannot reset passwords for users outside your zone."));
            }
        } else if (requester.getRole() != UserRole.ROLE_SUPERADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions."));
        }

        try {
            authService.resetAuthUserPassword(id.toString(), newPassword);
            
            // Force user to change password on next login
            targetUser.setIsFirstLogin(true);
            userRepository.save(targetUser);

            return ResponseEntity.ok(Map.of("message", "Password reset successfully. User must change it on next login."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to reset password: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/profile")
    public ResponseEntity<?> updateUserProfile(@PathVariable UUID id, @RequestBody Map<String, String> payload, @AuthenticationPrincipal Jwt jwt) {
        String requesterIdStr = jwt.getClaimAsString("sub");
        if (requesterIdStr == null) return ResponseEntity.status(401).build();

        String fullName = payload.get("fullName");
        if (fullName == null || fullName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Full name is required."));
        }

        User requester = userRepository.findById(UUID.fromString(requesterIdStr)).orElse(null);
        User targetUser = userRepository.findById(id).orElse(null);

        if (requester == null || targetUser == null) return ResponseEntity.notFound().build();

        // Permission check
        if (requester.getRole() == UserRole.ROLE_ADMIN) {
            if (targetUser.getRole() == UserRole.ROLE_SUPERADMIN || targetUser.getRole() == UserRole.ROLE_ADMIN) {
                return ResponseEntity.status(403).body(Map.of("error", "Admins can only edit normal users."));
            }
            if (!requester.getZone().getId().equals(targetUser.getZone().getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Cannot edit users outside your zone."));
            }
        } else if (requester.getRole() != UserRole.ROLE_SUPERADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions."));
        }

        try {
            targetUser.setFullName(fullName);
            userRepository.save(targetUser);

            // Supabase auth service would typically require updating user meta_data if we cared, but we fetch from users table.
            
            return ResponseEntity.ok(Map.of("message", "Profile updated successfully.", "fullName", fullName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to update profile: " + e.getMessage()));
        }
    }
}
