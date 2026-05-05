package com.hms.entity;


import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String specialisation;

    private String ward;

    private String team;

    @Column(unique = true, nullable = false)
    private String mobile;

}