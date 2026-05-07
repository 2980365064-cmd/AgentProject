package com.hms.service;

import com.hms.dto.DoctorDTO;
import com.hms.entity.Doctor;

import java.util.List;

public interface DoctorService {
    Doctor create(DoctorDTO dto);
    List<Doctor> getAll();
    Doctor getByMobile(String mobile); // Changed
    Doctor update(String mobile, DoctorDTO dto); // Changed
    void delete(String mobile);

    List<Doctor> findByName(String name);
}
