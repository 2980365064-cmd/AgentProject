package com.hms.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class PatientDTO {
    private String name;
    private String contact;
    private String nic;
    private Integer age;
    private String gender;
    private LocalDate date;
    private String ward;
    private String team;
    private String description;
}