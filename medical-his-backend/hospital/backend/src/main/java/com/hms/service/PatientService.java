package com.hms.service;

import com.hms.dto.PatientDTO;
import com.hms.entity.Patient;

import java.util.List;

public interface PatientService {
    Patient create(PatientDTO dto);
    List<Patient> getAll();
    Patient getByNic(String nic);
    Patient update(String nic, PatientDTO dto);
    void delete(String nic);

    List<Patient> findByName(String name);
}
