package com.firesafetypro.controller;

import com.firesafetypro.model.Device;
import com.firesafetypro.model.DeviceType;
import com.firesafetypro.model.Zone;
import com.firesafetypro.model.User;
import com.firesafetypro.model.UserRole;
import com.firesafetypro.repository.DeviceRepository;
import com.firesafetypro.repository.DeviceTypeRepository;
import com.firesafetypro.repository.ZoneRepository;
import com.firesafetypro.repository.UserRepository;
import com.firesafetypro.service.QrCodeService;
import com.firesafetypro.service.SupabaseStorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/devices")
@CrossOrigin("*")
public class AdminDeviceController {

    private final DeviceRepository deviceRepository;
    private final DeviceTypeRepository deviceTypeRepository;
    private final ZoneRepository zoneRepository;
    private final UserRepository userRepository;
    private final QrCodeService qrCodeService;
    private final SupabaseStorageService storageService;

    public AdminDeviceController(DeviceRepository deviceRepository, DeviceTypeRepository deviceTypeRepository, ZoneRepository zoneRepository, UserRepository userRepository, QrCodeService qrCodeService, SupabaseStorageService storageService) {
        this.deviceRepository = deviceRepository;
        this.deviceTypeRepository = deviceTypeRepository;
        this.zoneRepository = zoneRepository;
        this.userRepository = userRepository;
        this.qrCodeService = qrCodeService;
        this.storageService = storageService;
    }

    @PostMapping
    public ResponseEntity<?> registerDevice(@RequestBody Map<String, String> payload, @AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {
        String serialNumber = payload.get("serialNumber");
        String deviceTypeIdStr = payload.get("deviceTypeId");
        String description = payload.get("description");

        if (deviceTypeIdStr == null) return ResponseEntity.badRequest().body(Map.of("error", "deviceTypeId is required"));
        UUID deviceTypeId = UUID.fromString(deviceTypeIdStr);

        DeviceType dt = deviceTypeRepository.findById(deviceTypeId).orElse(null);
        if (dt == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid device type"));

        if (deviceRepository.findBySerialNumberAndDeviceTypeId(serialNumber, deviceTypeId).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("error", "Device with this serial number and type already exists."));
        }

        String userIdStr = jwt.getClaimAsString("sub");
        if (userIdStr == null) return ResponseEntity.status(401).build();
        UUID userId = UUID.fromString(userIdStr);
        User creator = userRepository.findById(userId).orElse(null);
        if (creator == null) return ResponseEntity.status(401).build();

        Zone targetZone = null;
        if (creator.getRole() == UserRole.ROLE_SUPERADMIN) {
            String zoneIdStr = payload.get("zoneId");
            if (zoneIdStr != null && !zoneIdStr.isBlank()) {
                targetZone = zoneRepository.findById(UUID.fromString(zoneIdStr)).orElse(null);
            }
        } else if (creator.getRole() == UserRole.ROLE_ADMIN) {
            targetZone = creator.getZone(); // Force into Admin's zone
        } else {
            return ResponseEntity.status(403).body(Map.of("error", "Inspectors cannot register devices via this endpoint."));
        }

        if (targetZone == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Zone is required."));
        }

        // 1. Create and save initial device record to generate ID
        Device device = new Device();
        device.setSerialNumber(serialNumber);
        device.setDeviceType(dt);
        device.setZone(targetZone);
        device.setDescription(description);
        device.setRegisteredBy(userId);
        
        device = deviceRepository.save(device);

        // 2. Generate QR Code containing the device's internal UUID
        try {
            byte[] qrImage = qrCodeService.generateQrCodeImage(device.getId().toString(), 300, 300);
            
            // 3. Upload to Supabase Storage
            String filename = device.getId().toString() + ".png";
            storageService.uploadFile("qrcodes", filename, qrImage, "image/png");

            // 4. Generate 50-year signed URL (1577880000 seconds)
            String signedUrl = storageService.createSignedUrl("qrcodes", filename, 1577880000);

            // 5. Update device with storage ref and signed URL
            device.setQrCodeRef("qrcodes/" + filename);
            device.setQrSignedUrl(signedUrl);
            device = deviceRepository.save(device);

            return ResponseEntity.ok(device);
        } catch (Exception e) {
            // Rollback (soft-delete or hard-delete) if upload fails
            deviceRepository.delete(device);
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to generate or upload QR code: " + e.getMessage()));
        }
    }
}
