// D:\TOOL\Project\JavaProject\hospital\Frontend\Frontend\src\services\patientUserService.js
import { authFetch, handleApiResponse, API_BASE_URL } from "./apiClient";

const PATIENT_BASE_URL = `${API_BASE_URL}/api/v1/patient`;

export const patientUserService = {
    /**
     * 绑定患者证件号（NIC）
     */
    bindNic: async (nic) => {
        console.log('🔗 调用绑定NIC API', nic);
        const response = await authFetch(`${PATIENT_BASE_URL}/bind-nic`, {
            method: "POST",
            body: JSON.stringify({ nic }),
        });
        return await handleApiResponse(response, "绑定证件号");
    },

    /**
     * 查询NIC绑定状态
     */
    getNicStatus: async () => {
        console.log('📋 查询NIC绑定状态');
        const response = await authFetch(`${PATIENT_BASE_URL}/nic-status`);
        return await handleApiResponse(response, "查询绑定状态");
    },

    /**
     * 查看我的病例（诊疗记录）
     */
    getMyTreatments: async () => {
        console.log('💊 获取我的病例列表');
        const response = await authFetch(`${PATIENT_BASE_URL}/treatments`);
        return await handleApiResponse(response, "获取病例列表");
    },

    /**
     * 病例详情
     */
    getTreatmentDetail: async (id) => {
        console.log('💊 获取病例详情', id);
        const response = await authFetch(`${PATIENT_BASE_URL}/treatments/${id}`);
        return await handleApiResponse(response, "获取病例详情");
    },

    /**
     * 查看住院记录
     */
    getAdmissions: async () => {
        console.log('🏥 获取住院记录');
        const response = await authFetch(`${PATIENT_BASE_URL}/admissions`);
        return await handleApiResponse(response, "获取住院记录");
    },

    /**
     * 查看空闲医生
     */
    getAvailableDoctors: async () => {
        console.log('👨‍⚕️ 获取空闲医生列表');
        const response = await authFetch(`${PATIENT_BASE_URL}/doctors/available`);
        return await handleApiResponse(response, "获取医生列表");
    },
};
