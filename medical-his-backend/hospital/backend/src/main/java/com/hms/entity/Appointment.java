package com.hms.entity;


import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Entity
@Data
public class Appointment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String nic;
    private String patient;
    private String doctor;
    private LocalDate date;
    private String time;
    private String type;
    private String status;
}
