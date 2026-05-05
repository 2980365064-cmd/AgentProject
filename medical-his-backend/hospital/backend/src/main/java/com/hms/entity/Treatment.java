package com.hms.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Data
public class Treatment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nic;

    private String doctor;

    private LocalDate treatmentDate;

    private LocalDate nextReview;

    @Column(length = 1000)
    private String medications;

    @Column(columnDefinition = "TEXT")
    private String notes;

}