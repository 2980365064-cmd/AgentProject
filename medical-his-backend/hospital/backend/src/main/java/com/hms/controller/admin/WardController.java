package com.hms.controller.admin;


import com.hms.annotation.RequireRole;
import com.hms.dto.WardDTO;
import com.hms.entity.Ward;
import com.hms.service.WardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/wards")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
@RequireRole({"ADMIN"})
public class WardController {

    private final WardService service;

    @PostMapping
    public Ward create(@RequestBody WardDTO dto) {
        return service.create(dto);
    }

    @GetMapping
    public List<Ward> getAll() {
        return service.getAll();
    }

    @GetMapping("/{id}")
    public Ward getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @PutMapping("/{id}")
    public Ward update(@PathVariable Long id, @RequestBody WardDTO dto) {
        return service.update(id, dto);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

}