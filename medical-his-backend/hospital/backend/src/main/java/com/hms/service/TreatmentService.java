package com.hms.service;

import com.hms.dto.TreatmentDTO;
import com.hms.entity.Treatment;

import java.util.List;

public interface TreatmentService {
    Treatment create(TreatmentDTO dto);
    List<Treatment> getAll();
    Treatment getById(Long id);
    List<Treatment> getByPatient(String nic);
    Treatment update(Long id, TreatmentDTO dto);
    void delete(Long id);
}
