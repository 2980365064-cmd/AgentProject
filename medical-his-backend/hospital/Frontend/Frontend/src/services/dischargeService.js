import { authFetch, handleApiResponse, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/discharges`;

console.log('📄 DischargeService - API Base URL:', ADMIN_BASE_URL);
console.log('📄 DischargeService - Full URL:', BASE_URL);

export const dischargeService = {
  getHistory: async () => {
    console.log('📄 调用获取出院记录API, URL:', BASE_URL);
    const response = await authFetch(BASE_URL);
    return await handleApiResponse(response, "获取出院记录");
  },

  submitDischarge: async (data) => {
    console.log('✅ 调用办理出院API', BASE_URL, data);
    const response = await authFetch(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return await handleApiResponse(response, "办理出院");
  },
};
