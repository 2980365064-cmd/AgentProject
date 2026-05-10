import { createCrudService, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/wards`;

export const wardService = createCrudService({
  baseUrl: BASE_URL,
  getAllMessage: "获取病区列表",
  createMessage: "新增病区",
  updateMessage: "更新病区",
  deleteMessage: "删除病区",
});
