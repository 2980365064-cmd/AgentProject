package com.hms.repository;

import com.hms.entity.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {

    Optional<Doctor> findByMobile(String mobile);

    void deleteByMobile(String mobile);
}