package com.hms.repository;

import com.hms.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface PatientRepository extends JpaRepository<Patient, Long> {

    Optional<Patient> findByNic(String nic);

    @Transactional
    void deleteByNic(String nic);
}