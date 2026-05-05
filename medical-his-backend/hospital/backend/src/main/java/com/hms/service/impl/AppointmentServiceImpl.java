package com.hms.service.impl;

import com.hms.entity.Appointment;
import com.hms.repository.AppointmentRepository;
import com.hms.service.AppointmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AppointmentServiceImpl implements AppointmentService {
    @Autowired
    private AppointmentRepository repository;

    public List<Appointment> getAll() {
        return repository.findAll();
    }

    public Appointment saveOrUpdate(Appointment appointment) {
        // Check if an appointment with this NIC already exists
        return repository.findByNic(appointment.getNic())
                .map(existing -> {
                    // Update existing record
                    existing.setPatient(appointment.getPatient());
                    existing.setDoctor(appointment.getDoctor());
                    existing.setDate(appointment.getDate());
                    existing.setTime(appointment.getTime());
                    existing.setType(appointment.getType());
                    existing.setStatus(appointment.getStatus());
                    return repository.save(existing);
                })
                .orElseGet(() -> {
                    // Save as new record
                    if (appointment.getStatus() == null) {
                        appointment.setStatus("Confirmed");
                    }
                    return repository.save(appointment);
                });
    }

    public void cancelByNic(String nic) {
        Appointment app = repository.findByNic(nic)
                .orElseThrow(() -> new RuntimeException("No appointment found for NIC: " + nic));
        app.setStatus("Cancelled");
        repository.save(app);
    }

}
