import { requestJson, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/appointments`;

export const appointmentService = {
  getAll: async () => requestJson(BASE_URL, "获取预约列表"),

  save: async (data) => {
    return requestJson(BASE_URL, "保存预约", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  cancel: async (nic) => {
    return requestJson(`${BASE_URL}/${nic}/cancel`, "取消预约", {
      method: "PATCH",
    });
  },
};
