import { authFetch, handleApiResponse, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/wards`;

console.log('🏥 WardService - API Base URL:', ADMIN_BASE_URL);
console.log('🏥 WardService - Full URL:', BASE_URL);

export const wardService = {
  getAll: async () => {
    console.log('🏥 调用获取病区列表API, URL:', BASE_URL);
    const response = await authFetch(BASE_URL);
    return await handleApiResponse(response, "获取病区列表");
  },

  create: async (wardData) => {
    console.log('➕ 调用创建病区API', BASE_URL, wardData);
    const response = await authFetch(BASE_URL, {
      method: "POST",
      body: JSON.stringify(wardData),
    });
    return await handleApiResponse(response, "新增病区");
  },

  update: async (id, wardData) => {
    const url = `${BASE_URL}/${id}`;
    console.log('✏️ 调用更新病区API', url, wardData);
    const response = await authFetch(url, {
      method: "PUT",
      body: JSON.stringify(wardData),
    });
    return await handleApiResponse(response, "更新病区");
  },

  delete: async (id) => {
    const url = `${BASE_URL}/${id}`;
    console.log('🗑️ 调用删除病区API', url);
    const response = await authFetch(url, {
      method: "DELETE",
    });
    return await handleApiResponse(response, "删除病区");
  },
};
