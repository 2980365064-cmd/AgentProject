package com.hms.service;

import com.hms.entity.Discharge;

import java.util.List;

public interface DischargeService {
    Discharge dischargePatient(Discharge discharge);

    List<Discharge> getAllHistory();
}
