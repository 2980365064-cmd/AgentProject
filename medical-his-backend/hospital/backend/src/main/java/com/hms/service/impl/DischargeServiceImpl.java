package com.hms.service.impl;

import com.hms.entity.Discharge;
import com.hms.entity.Patient;
import com.hms.repository.DischargeRepository;
import com.hms.repository.PatientRepository;
import com.hms.service.DischargeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DischargeServiceImpl implements DischargeService {
    private final DischargeRepository dischargeRepo;
    private final PatientRepository patientRepo;

    @Transactional
    public Discharge dischargePatient(Discharge dto) {
        Patient patient = patientRepo.findByNic(dto.getNic())
                .orElseThrow(() -> new RuntimeException("Patient not found with NIC: " + dto.getNic()));

        Discharge history = new Discharge();
        history.setNic(patient.getNic());
        history.setName(patient.getName());
        history.setAge(patient.getAge());
        history.setGender(patient.getGender());
        history.setContact(patient.getContact());
        history.setWard(patient.getWard());
        history.setTeam(patient.getTeam());
        history.setAdmissionDate(patient.getAdmissionDate());
        history.setDescription(patient.getDescription());

        history.setDischargeDate(dto.getDischargeDate());
        history.setDischargeType(dto.getDischargeType());
        history.setSummary(dto.getSummary());

        Discharge saved = dischargeRepo.save(history);
        patientRepo.deleteByNic(dto.getNic());

        return saved;
    }

    public List<Discharge> getAllHistory() {
        return dischargeRepo.findAll();
    }
}
