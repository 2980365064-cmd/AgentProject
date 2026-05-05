package com.hms.service.impl;

import com.hms.dto.TreatmentDTO;
import com.hms.entity.Treatment;
import com.hms.repository.TreatmentRepository;
import com.hms.service.TreatmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TreatmentServiceImpl implements TreatmentService {

    private final TreatmentRepository repository;

    @Override
    public Treatment create(TreatmentDTO dto) {
        Treatment t = new Treatment();
        mapDtoToEntity(t, dto);
        t.setNic(dto.getNic()); // NIC usually isn't changed in updates
        return repository.save(t);
    }

    @Override
    public List<Treatment> getAll() {
        return repository.findAll();
    }

    @Override
    public Treatment getById(Long id) {
        return repository.findById(id).orElseThrow(() -> new RuntimeException("Record not found"));
    }

    @Override
    public List<Treatment> getByPatient(String nic) {
        return repository.findByNic(nic);
    }

    @Override
    public Treatment update(Long id, TreatmentDTO dto) {
        Treatment t = repository.findById(id).orElseThrow(() -> new RuntimeException("Record not found"));
        mapDtoToEntity(t, dto);
        return repository.save(t);
    }

    private void mapDtoToEntity(Treatment t, TreatmentDTO dto) {
        t.setDoctor(dto.getDoctor());
        t.setTreatmentDate(dto.getTreatmentDate());
        t.setNextReview(dto.getNextReview());
        t.setMedications(dto.getMedications());
        t.setNotes(dto.getNotes());
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }
}