package com.firesafetypro.repository;

import com.firesafetypro.model.DeviceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface DeviceTypeRepository extends JpaRepository<DeviceType, UUID> {
}
