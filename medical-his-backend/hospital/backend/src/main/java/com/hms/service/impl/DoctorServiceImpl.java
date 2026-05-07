package com.hms.service.impl;

import com.hms.dto.DoctorDTO;
import com.hms.entity.Doctor;
import com.hms.repository.DoctorRepository;
import com.hms.service.DoctorService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DoctorServiceImpl implements DoctorService {

    private final DoctorRepository repository;

    public Doctor create(DoctorDTO dto) {
        Doctor d = new Doctor();
        d.setName(dto.getName());
        d.setSpecialisation(dto.getSpecialisation());
        d.setWard(dto.getWard());
        d.setTeam(dto.getTeam());
        d.setMobile(dto.getMobile());
        return repository.save(d);
    }

    public List<Doctor> getAll() {
        return repository.findAll();
    }

    public Doctor getByMobile(String mobile) {
        return repository.findByMobile(mobile)
                .orElseThrow(() -> new RuntimeException("Doctor not found with mobile: " + mobile));
    }

    public Doctor update(String mobile, DoctorDTO dto) {
        Doctor d = repository.findByMobile(mobile)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        d.setName(dto.getName());
        d.setSpecialisation(dto.getSpecialisation());
        d.setWard(dto.getWard());
        d.setTeam(dto.getTeam());
        d.setMobile(dto.getMobile());

        return repository.save(d);
    }

    @Transactional
    public void delete(String mobile) {
        repository.deleteByMobile(mobile);
    }

    @Override
    public List<Doctor> findByName(String name) {
        return repository.findByName(name);
    }
}