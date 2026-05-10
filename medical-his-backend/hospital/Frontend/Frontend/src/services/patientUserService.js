// D:\TOOL\Project\JavaProject\hospital\Frontend\Frontend\src\services\patientUserService.js
import { requestJson, API_BASE_URL } from "./apiClient";

const PATIENT_BASE_URL = `${API_BASE_URL}/api/v1/patient`;

export const patientUserService = {
    /**
     * 绑定患者证件号（NIC）
     */
    bindNic: async (nic) => {
        return requestJson(`${PATIENT_BASE_URL}/bind-nic`, "绑定证件号", {
            method: "POST",
            body: JSON.stringify({ nic }),
        });
    },

    /**
     * 查询NIC绑定状态
     */
    getNicStatus: async () => {
        return requestJson(`${PATIENT_BASE_URL}/nic-status`, "查询绑定状态");
    },

    /**
     * 查看我的病例（诊疗记录）
     */
    getMyTreatments: async () => {
        return requestJson(`${PATIENT_BASE_URL}/treatments`, "获取病例列表");
    },

    /**
     * 病例详情
     */
    getTreatmentDetail: async (id) => {
        return requestJson(`${PATIENT_BASE_URL}/treatments/${id}`, "获取病例详情");
    },

    /**
     * 查看住院记录
     */
    getAdmissions: async () => {
        return requestJson(`${PATIENT_BASE_URL}/admissions`, "获取住院记录");
    },

    /**
     * 查看空闲医生
     */
    getAvailableDoctors: async () => {
        return requestJson(`${PATIENT_BASE_URL}/doctors/available`, "获取医生列表");
    },
};
