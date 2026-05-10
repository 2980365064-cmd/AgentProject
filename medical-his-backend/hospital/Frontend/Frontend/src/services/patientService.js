import { createCrudService, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/patients`;

export const patientService = createCrudService({
  baseUrl: BASE_URL,
  getAllMessage: "获取患者列表",
  createMessage: "办理入院",
  updateMessage: "更新患者信息",
  deleteMessage: "删除患者",
});
