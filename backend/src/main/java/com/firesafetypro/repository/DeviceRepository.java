package com.firesafetypro.repository;

import com.firesafetypro.model.Device;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;
import java.util.Optional;

@Repository
public interface DeviceRepository extends JpaRepository<Device, UUID> {
    Optional<Device> findBySerialNumberAndDeviceTypeId(String serialNumber, UUID deviceTypeId);
}
