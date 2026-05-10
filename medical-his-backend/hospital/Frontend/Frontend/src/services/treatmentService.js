import { createCrudService, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/treatments`;

export const treatmentService = createCrudService({
  baseUrl: BASE_URL,
  getAllMessage: "获取诊疗记录",
  createMessage: "保存诊疗记录",
  updateMessage: "更新诊疗记录",
  deleteMessage: "删除诊疗记录",
});
