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

        if (userRepository.findByEmail(email).isPresent() || userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("error", "User with this email or username already exists."));
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
            // Unlink relationships and delete from public.users in a fully committed transaction
            transactionTemplate.execute(status -> {
                entityManager.createNativeQuery("UPDATE devices SET registered_by = NULL WHERE registered_by = :id")
                             .setParameter("id", id).executeUpdate();
                entityManager.createNativeQuery("UPDATE zones SET created_by = NULL WHERE created_by = :id")
                             .setParameter("id", id).executeUpdate();
                entityManager.createNativeQuery("UPDATE device_types SET created_by = NULL WHERE created_by = :id")
                             .setParameter("id", id).executeUpdate();
                entityManager.createNativeQuery("UPDATE users SET created_by = NULL WHERE created_by = :id")
                             .setParameter("id", id).executeUpdate();
                userRepository.deleteById(id);
                return null;
            });
            
            // Delete from auth.users via Admin API ONLY AFTER local database commits
            authService.deleteAuthUser(id.toString());
            return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to delete user: " + e.getMessage()));
        }
    }
}
