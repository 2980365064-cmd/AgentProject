package com.hms.controller.admin;

import com.hms.annotation.RequireRole;
import com.hms.entity.Appointment;
import com.hms.service.AppointmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/appointments")
@CrossOrigin(origins = "http://localhost:5173")
@RequireRole({"ADMIN"})
public class AppointmentController {

    @Autowired
    private AppointmentService service;

    @GetMapping
    public List<Appointment> getAll() {
        return service.getAll();
    }

    @PostMapping
    public ResponseEntity<Appointment> saveAppointment(@RequestBody Appointment appointment) {
        return ResponseEntity.ok(service.saveOrUpdate(appointment));
    }

    @PutMapping("/{nic}")
    public ResponseEntity<Appointment> updateByNic(@PathVariable String nic, @RequestBody Appointment appointment) {
        appointment.setNic(nic);
        return ResponseEntity.ok(service.saveOrUpdate(appointment));
    }

    @PatchMapping("/{nic}/cancel")
    public ResponseEntity<Void> cancelAppointment(@PathVariable String nic) {
        service.cancelByNic(nic);
        return ResponseEntity.ok().build();
    }
}
