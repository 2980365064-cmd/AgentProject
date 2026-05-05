package com.hms.service;

import com.hms.entity.Appointment;

import java.util.List;

public interface AppointmentService {
    List<Appointment> getAll();

    Appointment saveOrUpdate(Appointment appointment);

    void cancelByNic(String nic);
}
