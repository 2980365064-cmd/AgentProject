package com.hms.controller.admin;

import com.hms.annotation.RequireRole;
import com.hms.dto.TreatmentDTO;
import com.hms.entity.Treatment;
import com.hms.service.TreatmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/treatments")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
@RequireRole({"ADMIN"})
public class TreatmentController {

    private final TreatmentService service;

    @PostMapping
    public Treatment create(@RequestBody TreatmentDTO dto) {
        return service.create(dto);
    }

    @GetMapping
    public List<Treatment> getAll() {
        return service.getAll();
    }

    @GetMapping("/{id}")
    public Treatment getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @GetMapping("/patient/{nic}")
    public List<Treatment> getByPatient(@PathVariable String nic) {
        return service.getByPatient(nic);
    }

    @PutMapping("/{id}")
    public Treatment update(@PathVariable Long id, @RequestBody TreatmentDTO dto) {
        return service.update(id, dto);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

}