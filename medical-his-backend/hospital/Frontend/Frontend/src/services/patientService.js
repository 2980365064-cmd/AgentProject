import { authFetch, handleApiResponse, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/patients`;

console.log('📋 PatientService - API Base URL:', ADMIN_BASE_URL);
console.log('📋 PatientService - Full URL:', BASE_URL);

export const patientService = {
  getAll: async () => {
    console.log('📋 调用获取患者列表API, URL:', BASE_URL);
    const response = await authFetch(BASE_URL);
    return await handleApiResponse(response, "获取患者列表");
  },

  create: async (data) => {
    console.log('➕ 调用创建患者API', BASE_URL, data);
    const response = await authFetch(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return await handleApiResponse(response, "办理入院");
  },

  update: async (nic, data) => {
    const url = `${BASE_URL}/${nic}`;
    console.log('✏️ 调用更新患者API', url, data);
    const response = await authFetch(url, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return await handleApiResponse(response, "更新患者信息");
  },

  delete: async (nic) => {
    const url = `${BASE_URL}/${nic}`;
    console.log('🗑️ 调用删除患者API', url);
    const response = await authFetch(url, {
      method: "DELETE",
    });
    return await handleApiResponse(response, "删除患者");
  },
};
