package com.hms.dto.request;

import lombok.Data;

@Data
public class AppointmentRequest {
    private String doctorName;
    private String patientName;
    private String appointmentDate;
    private String appointmentTime;
    /** 管理员代预约时必填（与 Patient.nic 一致）；患者端调用应忽略，以登录用户 NIC 为准 */
    private String patientNic;
    /** 可选，默认 Consultation */
    private String appointmentType;
}
