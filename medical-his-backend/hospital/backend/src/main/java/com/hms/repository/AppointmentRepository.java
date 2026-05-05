package com.hms.repository;

import com.hms.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    Optional<Appointment> findByNic(String nic);

    void deleteByNic(String nic);

    boolean existsByNic(String nic);
}