package com.hms.service.impl;

import com.hms.dto.PatientDTO;
import com.hms.entity.Patient;
import com.hms.repository.PatientRepository;
import com.hms.service.PatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PatientServiceImpl implements PatientService {

    private final PatientRepository repository;

    @Override
    public Patient create(PatientDTO dto) {
        if(repository.findByNic(dto.getNic()).isPresent()) {
            throw new RuntimeException("Patient with this NIC already exists");
        }
        Patient p = new Patient();
        return saveOrUpdate(p, dto);
    }

    @Override
    public List<Patient> getAll() {
        return repository.findAll();
    }

    @Override
    public Patient getByNic(String nic) {
        return repository.findByNic(nic)
                .orElseThrow(() -> new RuntimeException("Patient not found with NIC: " + nic));
    }

    @Override
    public Patient update(String nic, PatientDTO dto) {
        Patient p = repository.findByNic(nic)
                .orElseThrow(() -> new RuntimeException("Patient not found with NIC: " + nic));
        return saveOrUpdate(p, dto);
    }

    @Override
    public void delete(String nic) {
        repository.deleteByNic(nic);
    }

    private Patient saveOrUpdate(Patient p, PatientDTO dto) {
        p.setName(dto.getName());
        p.setContact(dto.getContact());
        p.setNic(dto.getNic());
        p.setAge(dto.getAge());
        p.setGender(dto.getGender());
        p.setAdmissionDate(dto.getDate());
        p.setWard(dto.getWard());
        p.setTeam(dto.getTeam());
        p.setDescription(dto.getDescription());
        return repository.save(p);
    }
}