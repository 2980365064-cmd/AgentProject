package com.hms.service.impl;

import com.hms.dto.WardDTO;
import com.hms.entity.Ward;
import com.hms.repository.WardRepository;
import com.hms.service.WardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class WardServiceImpl implements WardService {

    private final WardRepository repository;

    @Override
    public Ward create(WardDTO dto) {
        Ward w = new Ward();
        return saveOrUpdate(w, dto);
    }

    @Override
    public List<Ward> getAll() {
        return repository.findAll();
    }

    @Override
    public Ward getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ward not found with id: " + id));
    }

    @Override
    public Ward update(Long id, WardDTO dto) {
        Ward w = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ward not found with id: " + id));
        return saveOrUpdate(w, dto);
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private Ward saveOrUpdate(Ward w, WardDTO dto) {
        w.setName(dto.getName());
        w.setType(dto.getType());
        w.setCapacity(dto.getCapacity());
        w.setFloor(dto.getFloor());
        return repository.save(w);
    }
}