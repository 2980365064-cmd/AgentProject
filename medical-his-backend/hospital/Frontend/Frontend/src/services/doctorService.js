import { createCrudService, ADMIN_BASE_URL } from "./apiClient";

const BASE_URL = `${ADMIN_BASE_URL}/doctors`;

export const doctorService = createCrudService({
  baseUrl: BASE_URL,
  getAllMessage: "获取医生列表",
  createMessage: "新增医生",
  updateMessage: "更新医生信息",
  deleteMessage: "删除医生",
});
