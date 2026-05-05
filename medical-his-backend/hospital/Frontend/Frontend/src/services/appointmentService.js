import { authFetch, handleApiResponse, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/appointments`;

console.log('📅 AppointmentService - API Base URL:', ADMIN_BASE_URL);
console.log('📅 AppointmentService - Full URL:', BASE_URL);

export const appointmentService = {
  getAll: async () => {
    console.log('📅 调用获取预约列表API, URL:', BASE_URL);
    const res = await authFetch(BASE_URL);
    return await handleApiResponse(res, "获取预约列表");
  },

  save: async (data) => {
    console.log('💾 调用保存预约API', BASE_URL, data);
    const res = await authFetch(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return await handleApiResponse(res, "保存预约");
  },

  cancel: async (nic) => {
    const url = `${BASE_URL}/${nic}/cancel`;
    console.log('❌ 调用取消预约API', url);
    const res = await authFetch(url, {
      method: "PATCH",
    });
    return await handleApiResponse(res, "取消预约");
  },
};
