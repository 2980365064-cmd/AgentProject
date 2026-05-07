// D:\TOOL\Project\JavaProject\hospital\backend\src\main\java\com\hms\service\PatientPortalService.java
package com.hms.service;

import com.hms.dto.request.AppointmentRequest;
import com.hms.dto.request.BindNicRequest;
import com.hms.util.Response;

public interface PatientPortalService {

    Response<?> getAvailableDoctors(String date, String timeSlot);

    /** 当前绑定 NIC 下的预约（系统中 NIC 唯一，最多一条有效记录） */
    Response<?> getMyAppointment();

    /** 新建或改约（与管理端 saveOrUpdate 规则一致，按 NIC upsert） */
    Response<?> bookAppointment(AppointmentRequest request);

    /** 取消当前患者的预约 */
    Response<?> cancelMyAppointment();

    Response<?> getMyAdmissions();

    Response<?> getMyTreatments();

    Response<?> getTreatmentDetail(Long id);

    Response<?> bindNic(BindNicRequest request);

    Response<?> getNicStatus();
}
