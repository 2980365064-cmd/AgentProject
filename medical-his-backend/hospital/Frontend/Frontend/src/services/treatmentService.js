import { authFetch, handleApiResponse, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/treatments`;

console.log('💊 TreatmentService - API Base URL:', ADMIN_BASE_URL);
console.log('💊 TreatmentService - Full URL:', BASE_URL);

export const treatmentService = {
  getAll: async () => {
    console.log('💊 调用获取诊疗记录API, URL:', BASE_URL);
    const response = await authFetch(BASE_URL);
    return await handleApiResponse(response, "获取诊疗记录");
  },

  create: async (treatmentData) => {
    console.log('➕ 调用创建诊疗记录API', BASE_URL, treatmentData);
    const response = await authFetch(BASE_URL, {
      method: "POST",
      body: JSON.stringify(treatmentData),
    });
    return await handleApiResponse(response, "保存诊疗记录");
  },

  update: async (id, treatmentData) => {
    const url = `${BASE_URL}/${id}`;
    console.log('✏️ 调用更新诊疗记录API', url, treatmentData);
    const response = await authFetch(url, {
      method: "PUT",
      body: JSON.stringify(treatmentData),
    });
    return await handleApiResponse(response, "更新诊疗记录");
  },

  delete: async (id) => {
    const url = `${BASE_URL}/${id}`;
    console.log('🗑️ 调用删除诊疗记录API', url);
    const response = await authFetch(url, {
      method: "DELETE",
    });
    return await handleApiResponse(response, "删除诊疗记录");
  },
};
