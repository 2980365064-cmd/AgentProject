package com.hms.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class TreatmentDTO {

    private String nic;
    private String doctor;
    private LocalDate treatmentDate;
    private LocalDate nextReview;
    private String medications;
    private String notes;

}