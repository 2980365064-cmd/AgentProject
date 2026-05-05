// D:\TOOL\Project\JavaProject\hospital\Frontend\Frontend\src\utils\permissionCheck.js

import { getStoredUser } from "../services/apiClient";
import { isPatientRole } from "../../constants";

/**
 * 检查当前用户是否为患者角色
 */
export function checkIsPatient() {
  const user = getStoredUser();
  if (!user) {
    return false;
  }
  return isPatientRole(user.role ?? user.userRole);
}

/**
 * 检查当前用户是否为管理员/医生角色
 */
export function checkIsAdminOrDoctor() {
  const user = getStoredUser();
  if (!user) {
    return false;
  }
  const role = (user.role ?? user.userRole ?? "").toUpperCase();
  return role === "ADMIN" || role === "DOCTOR";
}

/**
 * 患者页面权限守卫
 * 如果不是患者角色，抛出错误
 */
export function requirePatientRole() {
  const user = getStoredUser();

  if (!user) {
    throw new Error("请先登录");
  }

  if (!isPatientRole(user.role ?? user.userRole)) {
    throw new Error("此页面仅对患者开放");
  }
}

/**
 * 管理员页面权限守卫
 * 如果不是管理员或医生角色，抛出错误
 */
export function requireAdminRole() {
  const user = getStoredUser();

  if (!user) {
    throw new Error("请先登录");
  }

  const role = (user.role ?? user.userRole ?? "").toUpperCase();
  if (role !== "ADMIN" && role !== "DOCTOR") {
    throw new Error("此页面仅对管理员或医生开放");
  }
}
