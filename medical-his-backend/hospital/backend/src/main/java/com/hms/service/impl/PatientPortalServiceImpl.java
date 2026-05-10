// D:\TOOL\Project\JavaProject\hospital\backend\src\main\java\com\hms\service\impl\PatientPortalServiceImpl.java
package com.hms.service.impl;

import com.hms.dto.request.AppointmentRequest;
import com.hms.dto.request.BindNicRequest;
import com.hms.entity.Appointment;
import com.hms.entity.Discharge;
import com.hms.entity.Doctor;
import com.hms.entity.Patient;
import com.hms.entity.Treatment;
import com.hms.entity.User;
import com.hms.repository.AppointmentRepository;
import com.hms.repository.AuthRepository;
import com.hms.repository.DischargeRepository;
import com.hms.repository.DoctorRepository;
import com.hms.repository.PatientRepository;
import com.hms.repository.TreatmentRepository;
import com.hms.service.AppointmentService;
import com.hms.service.PatientPortalService;
import com.hms.util.Response;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PatientPortalServiceImpl implements PatientPortalService {

    private final AuthRepository authRepository;
    private final PatientRepository patientRepository;
    private final DischargeRepository dischargeRepository;
    private final TreatmentRepository treatmentRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final AppointmentService appointmentService;

    /**
     * 获取当前登录用户
     */
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("用户未登录");
        }
        String email = authentication.getName();
        // ⚠️ 确保这里是从数据库查询，这样能拿到最新的 nic
        return authRepository.findByEmail(email);
    }

    /**
     * 预约标识：
     * - 已绑定 NIC：继续使用 NIC
     * - 未绑定 NIC：使用账号级稳定标识，保证患者可直接预约（无需先入院/绑 NIC）
     */
    private String resolveAppointmentIdentity(User user) {
        if (user.getNic() != null && !user.getNic().isBlank()) {
            return user.getNic().trim();
        }
        if (user.getId() == null) {
            throw new RuntimeException("当前用户身份无效，无法预约");
        }
        return "APPUSER-" + user.getId();
    }

    /**
     * 管理员在未提供 NIC 时，使用患者姓名构造稳定预约标识。
     */
    private String resolveAdminAppointmentIdentity(User user, AppointmentRequest request) {
        if (request.getPatientNic() != null && !request.getPatientNic().isBlank()) {
            return request.getPatientNic().trim();
        }
        if (request.getPatientName() != null && !request.getPatientName().isBlank()) {
            String normalizedName = request.getPatientName().trim().replaceAll("\\s+", "");
            return "ADMINNAME-" + normalizedName;
        }
        return resolveAppointmentIdentity(user);
    }

    @Override
    public Response<?> getAvailableDoctors(String date, String timeSlot) {
        List<Doctor> doctors = doctorRepository.findAll();
        if (doctors.isEmpty()) {
            return new Response<>("success", "暂无医生数据", List.of());
        }

        if (date == null || date.isBlank() || timeSlot == null || timeSlot.isBlank()) {
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Doctor d : doctors) {
                Map<String, Object> row = new HashMap<>();
                row.put("name", d.getName());
                row.put("specialization", d.getSpecialisation());
                row.put("ward", d.getWard());
                row.put("team", d.getTeam());
                row.put("available", null);
                rows.add(row);
            }
            return new Response<>("success", "获取成功（传入 date、timeSlot 可判断该时段是否可约）", rows);
        }

        final LocalDate d;
        try {
            d = LocalDate.parse(date.trim());
        } catch (Exception e) {
            return new Response<>("error", "日期格式无效，请使用 yyyy-MM-dd", null);
        }
        final String slot = timeSlot.trim();

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Doctor doc : doctors) {
            List<Appointment> atSlot = appointmentRepository.findByDoctorAndDateAndTime(doc.getName(), d, slot);
            boolean taken = atSlot.stream().anyMatch(this::isActiveAppointment);
            Map<String, Object> row = new HashMap<>();
            row.put("name", doc.getName());
            row.put("specialization", doc.getSpecialisation());
            row.put("ward", doc.getWard());
            row.put("team", doc.getTeam());
            row.put("available", !taken);
            rows.add(row);
        }
        return new Response<>("success", "获取成功", rows);
    }

    private boolean isActiveAppointment(Appointment a) {
        if (a.getStatus() == null) {
            return true;
        }
        return !"Cancelled".equalsIgnoreCase(a.getStatus().trim());
    }

    @Override
    public Response<?> getMyAppointment() {
        User user = getCurrentUser();
        String identity = resolveAppointmentIdentity(user);
        Optional<Appointment> opt = appointmentRepository.findByNic(identity);
        if (opt.isEmpty()) {
            return new Response<>("success", "暂无预约记录", null);
        }
        return new Response<>("success", "获取成功", opt.get());
    }

    @Override
    public Response<?> bookAppointment(AppointmentRequest request) {
        User user = getCurrentUser();
        boolean isAdmin = user.getRole() != null && "ADMIN".equalsIgnoreCase(user.getRole().trim());

        final String effectiveNic;
        if (isAdmin) {
            effectiveNic = resolveAdminAppointmentIdentity(user, request);
        } else {
            effectiveNic = resolveAppointmentIdentity(user);
        }

        if (request.getDoctorName() == null || request.getDoctorName().isBlank()) {
            return new Response<>("error", "请选择医生", null);
        }
        if (request.getAppointmentDate() == null || request.getAppointmentDate().isBlank()) {
            return new Response<>("error", "请选择预约日期", null);
        }
        if (request.getAppointmentTime() == null || request.getAppointmentTime().isBlank()) {
            return new Response<>("error", "请选择预约时段", null);
        }

        final LocalDate localDate;
        try {
            localDate = LocalDate.parse(request.getAppointmentDate().trim());
        } catch (Exception e) {
            return new Response<>("error", "日期格式无效，请使用 yyyy-MM-dd", null);
        }
        String time = request.getAppointmentTime().trim();
        String doctorName = request.getDoctorName().trim();

        List<Doctor> doctorMatches = doctorRepository.findByName(doctorName);
        if (doctorMatches.isEmpty()) {
            return new Response<>("error", "未找到该姓名的在职医生", null);
        }

        List<Appointment> atSlot = appointmentRepository.findByDoctorAndDateAndTime(doctorName, localDate, time);
        for (Appointment a : atSlot) {
            if (!isActiveAppointment(a)) {
                continue;
            }
            if (!effectiveNic.equals(a.getNic())) {
                return new Response<>("error", "该医生在此时段已被预约，请选择其他时段或医生", null);
            }
        }

        Appointment appt = new Appointment();
        appt.setNic(effectiveNic);
        String patientDisplayName;
        if (request.getPatientName() != null && !request.getPatientName().isBlank()) {
            patientDisplayName = request.getPatientName().trim();
        } else if (user.getName() != null && !user.getName().isBlank()) {
            patientDisplayName = user.getName().trim();
        } else {
            patientDisplayName = "未命名患者";
        }
        appt.setPatient(patientDisplayName);
        appt.setDoctor(doctorName);
        appt.setDate(localDate);
        appt.setTime(time);
        String apptType = request.getAppointmentType();
        appt.setType((apptType == null || apptType.isBlank()) ? "Consultation" : apptType.trim());
        appt.setStatus("Confirmed");

        Appointment saved = appointmentService.saveOrUpdate(appt);
        return new Response<>("success", "预约成功", saved);
    }

    @Override
    public Response<?> cancelMyAppointment() {
        User user = getCurrentUser();
        try {
            appointmentService.cancelByNic(resolveAppointmentIdentity(user));
        } catch (RuntimeException e) {
            return new Response<>("error", e.getMessage(), null);
        }
        return new Response<>("success", "预约已取消", null);
    }

    @Override
    public Response<?> getMyAdmissions() {
        User user = getCurrentUser();
        
        if (user.getNic() == null || user.getNic().isEmpty()) {
            return new Response<>("error", "您尚未绑定证件号(NIC)，请先在'我的病例'中绑定", null);
        }

        String nic = user.getNic();
        
        List<Patient> currentAdmissions = patientRepository.findByNic(nic)
                .map(patient -> List.of(patient))
                .orElse(List.of());
        
        List<Discharge> dischargeHistory = dischargeRepository.findByNic(nic);
        
        Map<String, Object> combinedData = new HashMap<>();
        combinedData.put("currentAdmission", currentAdmissions.isEmpty() ? null : currentAdmissions.get(0));
        combinedData.put("dischargeHistory", dischargeHistory);
        combinedData.put("totalRecords", currentAdmissions.size() + dischargeHistory.size());
        
        return new Response<>("success", "获取住院记录成功", combinedData);
    }

    @Override
    public Response<?> getMyTreatments() {
        User user = getCurrentUser();
        
        if (user.getNic() == null || user.getNic().isEmpty()) {
            return new Response<>("error", "您尚未绑定证件号(NIC)，请先绑定", null);
        }

        // 3. 根据 NIC 查询治疗记录（病例）
        // 假设你的 TreatmentRepository 里有 findByNic 方法
        List<Treatment> treatments = treatmentRepository.findByNic(user.getNic());
        
        return new Response<>("success", "获取病例成功", treatments);
    }

    @Override
    public Response<?> getTreatmentDetail(Long id) {
        // 获取病例详情，并验证是否属于当前用户
        return new Response<>("success", "获取成功", null);
    }

    @Override
    public Response<?> bindNic(BindNicRequest request) {
        User user = getCurrentUser();
        String nicToBind = request.getNic();

        // 1. 验证：这个 NIC 在医院系统(Patient表)里是否存在？
        Optional<Patient> patientOpt = patientRepository.findByNic(nicToBind);
        if (patientOpt.isEmpty()) {
            return new Response<>("error", "绑定失败：该证件号在医院系统中不存在", null);
        }

        Patient patient = patientOpt.get();
        
        // 2. 可选验证：确保这个 Patient 的名字和当前登录用户的名字一致（防止乱绑）
        // if (!patient.getName().equals(user.getName())) {
        //     return new Response<>("error", "绑定失败：证件号姓名与当前用户不符", null);
        // }

        // 3. 更新 User 表的 nic 字段
        user.setNic(nicToBind);
        authRepository.save(user);

        Map<String, Object> data = new HashMap<>();
        data.put("nic", nicToBind);
        data.put("patientName", patient.getName());
        return new Response<>("success", "绑定成功", data);
    }

    @Override
    public Response<?> getNicStatus() {
        User user = getCurrentUser();
        // 每次从数据库获取最新状态
        User freshUser = authRepository.findById(user.getId()).orElse(user);
        
        Map<String, Object> data = new HashMap<>();
        data.put("isBound", freshUser.getNic() != null && !freshUser.getNic().isEmpty());
        data.put("nic", freshUser.getNic());
        return new Response<>("success", "获取成功", data);
    }
}
