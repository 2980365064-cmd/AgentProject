package com.hms.repository;

import com.hms.entity.Treatment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TreatmentRepository extends JpaRepository<Treatment, Long> {
    List<Treatment> findByNic(String nic);
}