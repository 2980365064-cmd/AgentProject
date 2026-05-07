import { authFetch, API_BASE_URL } from "./apiClient";
import { aiChatWS } from "./aiChatWebSocket";

const AI_ASSISTANT_BASE_URL = `${API_BASE_URL}/api/v1/ai-assistant`;

console.log('🤖 AI Assistant Service - API Base URL:', AI_ASSISTANT_BASE_URL);

/**
 * 统一的响应解析函数
 */
async function parseApiResponse(response) {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const result = await response.json();
  console.log('📦 后端响应:', result);
  
  // ✅ 兼容 FastAPI 格式
  if (result.code === 200 || result.code === 0) {
    return result.data;
  }
  
  // ✅ 兼容 Java Spring Boot 格式
  if (result.status === "success") {
    return result.data;
  }
  
  // 兼容旧格式
  return result;
}

export const aiAssistantService = {
  /**
   * 获取当前用户的所有会话列表
   */
  getConversations: async () => {
    console.log('📋 获取会话列表');
    const response = await authFetch(`${AI_ASSISTANT_BASE_URL}/sessions`);
    
    const result = await parseApiResponse(response);
    
    let sessions;
    if (Array.isArray(result)) {
      sessions = result;
    } else if (result && typeof result === 'object' && Array.isArray(result.sessions)) {
      sessions = result.sessions;
    } else {
      console.warn('⚠️ 会话数据格式异常，返回空数组', result);
      sessions = [];
    }
    
    console.log('✅ 解析到会话数量:', sessions.length);
    return sessions;
  },

  /**
   * 创建新会话
   * POST /api/v1/ai-assistant/sessions
   * @param {string} title - 会话标题（可选，默认「新对话」）
   * @returns {Promise<object>} data 中含 id / session_id（由网关分配）
   */
  createConversation: async (title = '新对话') => {
    const t = (title && String(title).trim()) || '新对话';
    console.log('➕ 创建新会话', { title: t });
    const response = await authFetch(`${AI_ASSISTANT_BASE_URL}/sessions`, {
      method: "POST",
      body: JSON.stringify({
        user_input: t,
      }),
    });

    return await parseApiResponse(response);
  },

  /**
   * 删除指定会话
   */
  deleteConversation: async (id) => {
    console.log('🗑️ 删除会话', id);
    const response = await authFetch(`${AI_ASSISTANT_BASE_URL}/sessions/${id}`, {
      method: "DELETE",
    });
    
    return await parseApiResponse(response);
  },

  /**
   * 获取指定会话的历史消息
   */
  getMessages: async (id) => {
    if (!id || id === 'undefined' || id === 'null') {
      console.error('❌ 无效的会话ID:', id);
      throw new Error('会话ID无效，请先创建或选择会话');
    }
    
    console.log('💬 获取会话历史消息，会话ID:', id);
    const response = await authFetch(`${AI_ASSISTANT_BASE_URL}/sessions/${id}/history`);
    
    const result = await parseApiResponse(response);

    let messages;
    if (Array.isArray(result)) {
      messages = result;
    } else if (result && typeof result === 'object') {
      messages = result.messages || result.history || [];
    } else {
      messages = [];
    }
    if (!Array.isArray(messages)) {
      messages = [];
    }

    console.log('✅ 加载到消息数量:', messages.length);

    return messages.map((m, idx) => ({
      ...m,
      id: m.id ?? `${m.role ?? 'msg'}-${idx}-${m.timestamp ?? idx}`,
    }));
  },

  /**
   * 通过 WebSocket 发送消息
   */
  sendMessageViaWS: async (message, sessionId = null) => {
    console.log('📤 通过 WebSocket 发送消息');
    await aiChatWS.sendMessage(message, sessionId);
  },

  /**
   * 注册 WebSocket 消息监听器
   */
  onWSMessage: (type, handler) => {
    return aiChatWS.on(type, handler);
  },

  /**
   * 连接 WebSocket
   */
  connectWS: () => {
    return aiChatWS.connect();
  },

  /**
   * 强制重连 WebSocket（登出/登录时调用）
   */
  reconnectWS: async () => {
    console.log('🔄 强制重连 WebSocket...');
    // 先断开现有连接
    aiChatWS.disconnect();
    // 等待一小段时间确保连接完全关闭
    await new Promise(resolve => setTimeout(resolve, 100));
    // 重新连接
    return aiChatWS.connect();
  },

  /**
   * 断开 WebSocket
   */
  disconnectWS: () => {
    console.log('🔌 断开 WebSocket 连接...');
    aiChatWS.disconnect();
  },
  
  /**
   * 获取连接状态
   */
  getWSState: () => {
    return {
      state: aiChatWS.getStatus(),
      readyState: aiChatWS.ws ? aiChatWS.ws.readyState : WebSocket.CLOSED
    };
  },
};
