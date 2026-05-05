// D:\TOOL\Project\JavaProject\hospital\backend\src\main\java\com\hms\service\PatientPortalService.java
package com.hms.service;

import com.hms.dto.request.BindNicRequest;
import com.hms.util.Response;

public interface PatientPortalService {

    Response<?> getAvailableDoctors(String date, String timeSlot);

    Response<?> getMyAdmissions();

    Response<?> getMyTreatments();

    Response<?> getTreatmentDetail(Long id);

    Response<?> bindNic(BindNicRequest request);

    Response<?> getNicStatus();
}
