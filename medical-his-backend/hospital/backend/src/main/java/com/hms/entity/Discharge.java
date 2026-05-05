package com.hms.entity;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;

@Entity
@Data
public class Discharge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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

    private LocalDate dischargeDate;
    private String dischargeType;
    @Column(length = 2000)
    private String summary;
}
