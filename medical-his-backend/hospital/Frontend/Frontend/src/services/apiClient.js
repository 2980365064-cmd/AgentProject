/** localStorage key — 与登录页保持一致 */
export const USER_DATA_KEY = "userData";

/** API基础URL配置 - 新版本 */
export const API_BASE_URL = "http://localhost:8081";
export const AUTH_BASE_URL = `${API_BASE_URL}/api/v1/auth`;
export const ADMIN_BASE_URL = `${API_BASE_URL}/api/v1/admin`;

/**
 * 读取当前登录/注册后保存的用户信息
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 写入用户信息（登录或注册成功后由后端返回的 data）
 */
export function setStoredUser(data) {
  if (data == null || typeof data !== "object") return;
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
}

/**
 * 清除用户会话（登出或token过期时调用）
 */
export function clearStoredUser() {
  localStorage.removeItem(USER_DATA_KEY);
  // 触发storage事件，通知其他标签页
  window.dispatchEvent(new Event('storage'));
}

/**
 * 完整的登出流程：清除存储 + 关闭 WebSocket 连接
 */
export async function logout() {
  console.log('🚪 开始执行登出流程...');
  
  try {
    // 1️⃣ 关闭 WebSocket 连接（如果存在）
    const { aiChatWS } = await import('./aiChatWebSocket');
    if (aiChatWS) {
      console.log('🔌 关闭 WebSocket 连接...');
      aiChatWS.disconnect();
      console.log('✅ WebSocket 连接已关闭');
    }
    
    // ⚠️ 不清除 chatSessionId，因为会话历史是服务器端存储的，与用户账号绑定
    // localStorage.removeItem('chatSessionId');
    console.log('ℹ️ 保留 chatSessionId（会话历史与用户账号绑定）');
    
    // 2️⃣ 清除用户数据
    clearStoredUser();
    console.log('🗑️ 已清除用户数据');
    
    console.log('✅ 登出流程完成');
  } catch (error) {
    console.error('❌ 登出流程出错:', error);
    // 即使出错也要确保清除用户数据
    clearStoredUser();
  }
}

/**
 * 根据登录/注册接口的统一响应结构，把用户信息写入 localStorage。
 * 支持：{ status, data: { ... } } 或 { status, token, mail, role, ... }
 */
export function persistSessionFromAuthResponse(response) {
  if (!response || response.status !== "success") return;

  if (response.data != null && typeof response.data === "object") {
    setStoredUser(response.data);
    return;
  }

  const rest = { ...response };
  delete rest.status;
  delete rest.message;
  const hasAuthShape =
    rest.token ||
    rest.accessToken ||
    rest.jwt ||
    rest.access_token ||
    rest.mail ||
    rest.email ||
    rest.role != null;

  if (hasAuthShape && Object.keys(rest).length > 0) {
    setStoredUser(rest);
  }
}

/**
 * 供受保护接口使用的请求头
 * 支持JWT Token和Session/Cookie两种认证方式
 */
export function getAuthHeaders() {
  const headers = {};
  const user = getStoredUser();
  
  if (!user) {
    console.warn('⚠️ 未找到用户数据，请先登录');
    return headers;
  }

  // 如果有token则添加（JWT认证模式）
  const token = user.token ?? user.accessToken ?? user.jwt ?? user.access_token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 添加用户标识信息（用于后端日志记录和审计）
  const mail = user.mail ?? user.email;
  if (mail && /^[\x00-\x7F]*$/.test(mail)) {
    headers["X-User-Email"] = mail;
  }

  const id = user.id ?? user.userId;
  if (id != null && id !== "") {
    headers["X-User-Id"] = String(id);
  }

  return headers;
}

/**
 * 增强的错误处理函数
 */
export async function handleApiResponse(response, operationName = "操作") {
  if (!response.ok) {
    let errorMessage = `${operationName}失败（HTTP ${response.status}）`;
    
    try {
      const errorData = await response.json();
      console.error('❌ 服务器错误详情:', errorData);
      
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.errors) {
        errorMessage = Array.isArray(errorData.errors) 
          ? errorData.errors.join(', ') 
          : JSON.stringify(errorData.errors);
      }
    } catch (e) {
      console.error('❌ 无法解析错误响应');
    }
    
    console.error(`🚫 API错误 [${response.status}]:`, {
      url: response.url,
      status: response.status,
      message: errorMessage
    });
    
    // ✅ 处理401未授权 - 自动跳转到登录页
    if (response.status === 401) {
      errorMessage = '认证失败，请重新登录';
      // 清除本地存储
      clearStoredUser();
      // 延迟跳转，让用户看到提示
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    } 
    // ✅ 处理403禁止访问 - 权限不足
    else if (response.status === 403) {
      errorMessage = '没有权限执行此操作，请联系管理员';
    } 
    else if (response.status === 404) {
      errorMessage = '请求的资源不存在';
    } 
    else if (response.status === 500) {
      errorMessage = '服务器内部错误';
    } 
    else if (response.status === 0) {
      errorMessage = '网络连接失败，请检查后端服务是否启动';
    }
    
    throw new Error(errorMessage);
  }
  
  // ✅ 处理空响应（204 No Content 或 Content-Length 为 0）
  const contentLength = response.headers.get('Content-Length');
  const contentType = response.headers.get('Content-Type');
  
  if (response.status === 204 || contentLength === '0' || !contentType) {
    console.log('✅ API成功（空响应）:', response.url, `Status: ${response.status}`);
    return null;
  }
  
  // ✅ 检查是否是JSON响应
  if (contentType && !contentType.includes('application/json')) {
    console.warn('⚠️ 非JSON响应:', contentType);
    // 尝试读取文本内容
    const text = await response.text();
    console.log('响应内容:', text);
    // 如果是空字符串，返回null
    if (!text || text.trim() === '') {
      return null;
    }
    // 否则尝试解析为JSON
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('⚠️ 无法解析为JSON，返回原始文本');
      return { message: text };
    }
  }
  
  // ✅ 正常解析JSON响应
  try {
    const data = await response.json();
    console.log('✅ API成功:', response.url, data);
    return data;
  } catch (e) {
    console.error('❌ JSON解析失败:', e);
    console.error('响应状态:', response.status);
    console.error('响应头:', Object.fromEntries(response.headers.entries()));
    
    // 尝试读取原始文本
    const text = await response.text();
    console.error('响应内容（前200字符）:', text.substring(0, 200));
    
    throw new Error(`${operationName}失败：返回的数据格式不正确（非JSON格式）`);
  }
}

/**
 * 统一的认证请求方法，支持JWT和Session两种认证方式
 * 自动携带Cookie（Session认证必需）
 */
export async function authFetch(input, init = {}) {
  const merged = { ...init };
  const baseHeaders = new Headers(init.headers || {});
  const auth = getAuthHeaders();
  
  // 添加认证头
  Object.entries(auth).forEach(([key, value]) => {
    if (value != null && value !== "") {
      baseHeaders.set(key, String(value));
    }
  });
  
  // 设置Content-Type
  if (
    init.body != null &&
    !(init.body instanceof FormData) &&
    !baseHeaders.has("Content-Type")
  ) {
    baseHeaders.set("Content-Type", "application/json");
  }
  
  merged.headers = baseHeaders;
  
  // 关键：允许携带Cookie（Session/Cookie认证必需）
  if (!merged.credentials) {
    merged.credentials = 'include';
  }
  
  console.log('🌐 请求:', init.method || 'GET', input);
  
  try {
    const response = await fetch(input, merged);
    return response;
  } catch (error) {
    console.error('💥 网络请求失败:', error.message);
    
    if (error.message.includes('Failed to fetch')) {
      throw new Error('网络连接失败，请检查：1)后端服务是否启动 2)端口是否正确 3)是否存在CORS问题');
    }
    
    throw error;
  }
}
