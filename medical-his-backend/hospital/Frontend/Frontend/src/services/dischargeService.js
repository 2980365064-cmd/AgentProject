import { requestJson, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/discharges`;

export const dischargeService = {
  getHistory: async () => requestJson(BASE_URL, "获取出院记录"),

  submitDischarge: async (data) => {
    return requestJson(BASE_URL, "办理出院", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
