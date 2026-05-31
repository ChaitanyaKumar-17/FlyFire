package com.firesafetypro.controller;

import com.firesafetypro.model.Device;
import com.firesafetypro.repository.DeviceRepository;
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
    private final QrCodeService qrCodeService;
    private final SupabaseStorageService storageService;

    public AdminDeviceController(DeviceRepository deviceRepository, QrCodeService qrCodeService, SupabaseStorageService storageService) {
        this.deviceRepository = deviceRepository;
        this.qrCodeService = qrCodeService;
        this.storageService = storageService;
    }

    @PostMapping
    public ResponseEntity<?> registerDevice(@RequestBody Map<String, String> payload, @AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {
        String serialNumber = payload.get("serialNumber");
        String deviceType = payload.get("deviceType");
        String description = payload.get("description");

        if (deviceRepository.findBySerialNumber(serialNumber).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("error", "Device with this serial number already exists."));
        }

        // 1. Create and save initial device record to generate ID
        Device device = new Device();
        device.setSerialNumber(serialNumber);
        device.setDeviceType(deviceType);
        device.setDescription(description);
        
        // Extract user ID from JWT sub claim
        String userId = jwt.getClaimAsString("sub");
        if (userId != null) {
            device.setRegisteredBy(UUID.fromString(userId));
        }
        
        device = deviceRepository.save(device);

        // 2. Generate QR Code containing the device's internal UUID
        try {
            byte[] qrImage = qrCodeService.generateQrCodeImage(device.getId().toString(), 300, 300);
            
            // 3. Upload to Supabase Storage
            String filename = device.getId().toString() + ".png";
            storageService.uploadFile("qrcodes", filename, qrImage, "image/png");

            // 4. Generate 10-year signed URL
            String signedUrl = storageService.createSignedUrl("qrcodes", filename, 315360000);

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
