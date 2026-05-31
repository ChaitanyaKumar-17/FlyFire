package com.firesafetypro.controller;

import com.firesafetypro.model.Zone;
import com.firesafetypro.repository.ZoneRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/zones")
@CrossOrigin("*")
public class ZoneController {

    private final ZoneRepository zoneRepository;

    public ZoneController(ZoneRepository zoneRepository) {
        this.zoneRepository = zoneRepository;
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
            zone.setCreatedBy(UUID.fromString(userId));
        }

        zone = zoneRepository.save(zone);
        return ResponseEntity.ok(zone);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteZone(@PathVariable UUID id) {
        try {
            zoneRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Zone deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete zone. It may be assigned to users or devices."));
        }
    }
}
