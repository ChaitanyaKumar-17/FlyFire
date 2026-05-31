package com.firesafetypro.controller;

import com.firesafetypro.model.DeviceType;
import com.firesafetypro.repository.DeviceTypeRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/devicetypes")
@CrossOrigin("*")
public class DeviceTypeController {

    private final DeviceTypeRepository deviceTypeRepository;

    public DeviceTypeController(DeviceTypeRepository deviceTypeRepository) {
        this.deviceTypeRepository = deviceTypeRepository;
    }

    @GetMapping
    public ResponseEntity<List<DeviceType>> getDeviceTypes() {
        return ResponseEntity.ok(deviceTypeRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<?> createDeviceType(@RequestBody Map<String, String> payload, @AuthenticationPrincipal Jwt jwt) {
        String name = payload.get("name");
        
        DeviceType dt = new DeviceType();
        dt.setName(name);

        String userId = jwt.getClaimAsString("sub");
        if (userId != null) {
            dt.setCreatedBy(UUID.fromString(userId));
        }

        dt = deviceTypeRepository.save(dt);
        return ResponseEntity.ok(dt);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDeviceType(@PathVariable UUID id) {
        try {
            deviceTypeRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Device type deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete device type. It may be assigned to devices."));
        }
    }
}
