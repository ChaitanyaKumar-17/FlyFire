package com.firesafetypro.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "devices")
public class Device {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "serial_number", nullable = false)
    private String serialNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_type_id")
    private DeviceType deviceType;

    @Column(name = "description")
    private String description;

    @Column(name = "qr_code_ref")
    private String qrCodeRef;

    @Column(name = "qr_signed_url")
    private String qrSignedUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "zone_id")
    private Zone zone;

    @Column(name = "registered_at", nullable = false)
    private OffsetDateTime registeredAt;

    @Column(name = "registered_by")
    private UUID registeredBy;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @PrePersist
    protected void onCreate() {
        if (registeredAt == null) {
            registeredAt = OffsetDateTime.now();
        }
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }
    public DeviceType getDeviceType() { return deviceType; }
    public void setDeviceType(DeviceType deviceType) { this.deviceType = deviceType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getQrCodeRef() { return qrCodeRef; }
    public void setQrCodeRef(String qrCodeRef) { this.qrCodeRef = qrCodeRef; }
    public String getQrSignedUrl() { return qrSignedUrl; }
    public void setQrSignedUrl(String qrSignedUrl) { this.qrSignedUrl = qrSignedUrl; }
    public Zone getZone() { return zone; }
    public void setZone(Zone zone) { this.zone = zone; }
    public OffsetDateTime getRegisteredAt() { return registeredAt; }
    public void setRegisteredAt(OffsetDateTime registeredAt) { this.registeredAt = registeredAt; }
    public UUID getRegisteredBy() { return registeredBy; }
    public void setRegisteredBy(UUID registeredBy) { this.registeredBy = registeredBy; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}
