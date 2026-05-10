package com.hms.dto.request;

import lombok.Data;

@Data
public class AppointmentRequest {
    private String doctorName;
    private String patientName;
    private String appointmentDate;
    private String appointmentTime;
    /** 可选：传入时用于按真实患者证件号预约；不传也可预约 */
    private String patientNic;
    /** 可选，默认 Consultation */
    private String appointmentType;
}
