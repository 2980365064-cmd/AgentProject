package com.hms.controller.patient;

import com.hms.annotation.RequireRole;
import com.hms.dto.request.AppointmentRequest;
import com.hms.dto.request.BindNicRequest;
import com.hms.service.PatientPortalService;
import com.hms.util.Response;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/patient")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
@RequireRole({"PATIENT"}) // 只有患者可以访问
public class patient {
    @Autowired private PatientPortalService patientPortalService;

    /**
     * 查看指定时间段空闲医生
     */
    @GetMapping("/doctors/available")
    public Response<?> getAvailableDoctors(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String timeSlot) {
        return patientPortalService.getAvailableDoctors(date, timeSlot);
    }

    /**
     * 我的预约挂号
     */
    @GetMapping("/appointments")
    public Response<?> getMyAppointment() {
        return patientPortalService.getMyAppointment();
    }

    /**
     * 新建或改约
     */
    @PostMapping("/appointments")
    public Response<?> bookAppointment(@RequestBody AppointmentRequest request) {
        return patientPortalService.bookAppointment(request);
    }

    /**
     * 取消我的预约
     */
    @PatchMapping("/appointments/cancel")
    public Response<?> cancelMyAppointment() {
        return patientPortalService.cancelMyAppointment();
    }

    /**
     * 查看我的住院记录
     */
    @GetMapping("/admissions")
    public Response<?> getMyAdmissions() {
        return patientPortalService.getMyAdmissions();
    }

    /**
     * 查看我的病例（治疗记录）
     */
    @GetMapping("/treatments")
    public Response<?> getMyTreatments() {
        return patientPortalService.getMyTreatments();

    }

    /**
     * 获取病例详情
     */
    @GetMapping("/treatments/{id}")
    public Response<?> getTreatmentDetail(@PathVariable Long id) {
        return patientPortalService.getTreatmentDetail(id);
    }

    /**
     * 绑定NIC
     */
    @PostMapping("/bind-nic")
    public Response<?> bindNic(@RequestBody BindNicRequest request) {
        return patientPortalService.bindNic(request);
    }


    /**
     * 查询NIC绑定状态
     */
    @GetMapping("/nic-status")
    public Response<?> getNicStatus() {
        return patientPortalService.getNicStatus();
    }




}
