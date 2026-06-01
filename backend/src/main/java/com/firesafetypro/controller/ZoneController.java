package com.firesafetypro.controller;

import com.firesafetypro.model.Zone;
import com.firesafetypro.repository.ZoneRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import com.firesafetypro.model.User;
import com.firesafetypro.model.UserRole;
import com.firesafetypro.repository.UserRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/zones")
@CrossOrigin("*")
public class ZoneController {

    private final ZoneRepository zoneRepository;
    private final UserRepository userRepository;

    public ZoneController(ZoneRepository zoneRepository, UserRepository userRepository) {
        this.zoneRepository = zoneRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<Zone>> getZones() {
        return ResponseEntity.ok(zoneRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<?> createZone(@RequestBody Map<String, String> payload, @AuthenticationPrincipal Jwt jwt) {
        String name = payload.get("name");
        
        Zone zone = new Zone();
        zone.setName(name);

        String userId = jwt.getClaimAsString("sub");
        if (userId != null) {
            User creator = userRepository.findById(UUID.fromString(userId)).orElse(null);
            if (creator == null || creator.getRole() != UserRole.ROLE_SUPERADMIN) {
                return ResponseEntity.status(403).body(Map.of("error", "Only super admins can create zones."));
            }
            zone.setCreatedBy(UUID.fromString(userId));
        } else {
            return ResponseEntity.status(401).build();
        }

        zone = zoneRepository.save(zone);
        return ResponseEntity.ok(zone);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteZone(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getClaimAsString("sub");
        if (userId != null) {
            User deleter = userRepository.findById(UUID.fromString(userId)).orElse(null);
            if (deleter == null || deleter.getRole() != UserRole.ROLE_SUPERADMIN) {
                return ResponseEntity.status(403).body(Map.of("error", "Only super admins can delete zones."));
            }
        } else {
            return ResponseEntity.status(401).build();
        }

        try {
            zoneRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Zone deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete zone. It may be assigned to users or devices."));
        }
    }
}
