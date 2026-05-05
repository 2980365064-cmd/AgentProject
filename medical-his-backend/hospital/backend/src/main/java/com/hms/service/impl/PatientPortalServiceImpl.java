// D:\TOOL\Project\JavaProject\hospital\backend\src\main\java\com\hms\service\impl\PatientPortalServiceImpl.java
package com.hms.service.impl;

import com.hms.dto.request.BindNicRequest;
import com.hms.entity.Treatment;
import com.hms.entity.User;
import com.hms.entity.Patient;
import com.hms.entity.Discharge;
import com.hms.repository.AuthRepository;
import com.hms.repository.PatientRepository;
import com.hms.repository.TreatmentRepository;
import com.hms.repository.DischargeRepository;
import com.hms.repository.DoctorRepository;
import com.hms.repository.AppointmentRepository;
import com.hms.service.PatientPortalService;
import com.hms.util.JwtUtil;
import com.hms.util.Response;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

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

    @Override
    public Response<?> getAvailableDoctors(String date, String timeSlot) {
        // TODO: 实现查询空闲医生的逻辑
        // 可以根据预约表查询哪些医生在指定时间段没有被预约
        return new Response<>("success", "获取成功", List.of());
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
