import { authFetch, handleApiResponse, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/doctors`;

console.log('👨‍⚕️ DoctorService - API Base URL:', ADMIN_BASE_URL);
console.log('👨‍⚕️ DoctorService - Full URL:', BASE_URL);

export const doctorService = {
  getAll: async () => {
    console.log('👨‍⚕️ 调用获取医生列表API, URL:', BASE_URL);
    const response = await authFetch(BASE_URL);
    return await handleApiResponse(response, "获取医生列表");
  },

  create: async (data) => {
    console.log('➕ 调用创建医生API', BASE_URL, data);
    const response = await authFetch(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return await handleApiResponse(response, "新增医生");
  },

  update: async (mobile, data) => {
    const url = `${BASE_URL}/${mobile}`;
    console.log('✏️ 调用更新医生API', url, data);
    const response = await authFetch(url, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return await handleApiResponse(response, "更新医生信息");
  },

  delete: async (mobile) => {
    const url = `${BASE_URL}/${mobile}`;
    console.log('🗑️ 调用删除医生API', url);
    const response = await authFetch(url, {
      method: "DELETE",
    });
    return await handleApiResponse(response, "删除医生");
  },
};
