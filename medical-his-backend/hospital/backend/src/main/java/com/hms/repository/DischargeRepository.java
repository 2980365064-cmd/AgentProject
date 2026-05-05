package com.hms.repository;

import com.hms.entity.Discharge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DischargeRepository extends JpaRepository<Discharge, Long> {
    List<Discharge> findByNic(String nic);
}
