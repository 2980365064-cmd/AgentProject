package com.hms.controller.admin;

import com.hms.annotation.RequireRole;
import com.hms.dto.PatientDTO;
import com.hms.entity.Patient;
import com.hms.service.PatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/patients")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
@RequireRole({"ADMIN"})
public class PatientController {

    private final PatientService service;

    @PostMapping
    public Patient create(@RequestBody PatientDTO dto) {
        return service.create(dto);
    }

    @GetMapping
    public List<Patient> getAll() {
        return service.getAll();
    }

    @GetMapping("/{nic}")
    public Patient getByNic(@PathVariable String nic) {
        return service.getByNic(nic);
    }

    @PutMapping("/{nic}")
    public Patient update(@PathVariable String nic, @RequestBody PatientDTO dto) {
        return service.update(nic, dto);
    }

    @DeleteMapping("/{nic}")
    public void delete(@PathVariable String nic) {
        service.delete(nic);
    }
}