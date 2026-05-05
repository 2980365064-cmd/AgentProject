package com.hms.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Data
public class Patient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String nic;

    private String name;
    private String contact;
    private Integer age;
    private String gender;
    private LocalDate admissionDate;
    private String ward;
    private String team;

    @Column(length = 1000)
    private String description;
}