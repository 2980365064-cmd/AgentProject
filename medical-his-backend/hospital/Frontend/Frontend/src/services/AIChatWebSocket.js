// src/services/aiChatWebSocket.js

import { getStoredUser } from './apiClient';

const WS_URL = 'ws://localhost:8081/ws/ai-chat';

class AIChatWebSocket {
  constructor() {
    this.ws = null;
    this.isConnecting = false;
    this.connectionPromise = null;
    this.messageHandlers = new Map();
    this.userId = null;
    this.userRole = null;
  }

  /**
   * 获取 JWT Token
   */
  getToken() {
    try {
      const user = getStoredUser();
      
      if (!user) {
        console.error('❌ localStorage 中未找到用户数据');
        console.log('   请确认是否已登录');
        return null;
      }
      
      // 支持多种 token 字段名
      const token = user.token ?? user.accessToken ?? user.jwt ?? user.access_token;
      
      if (!token) {
        console.error('❌ 用户数据中未找到 token 字段');
        console.error('   可用的字段:', Object.keys(user));
        console.error('   这可能意味着后端登录接口未返回 token');
        return null;
      }
      
      // ✅ 详细记录 token 对应的用户信息
      const userId = user.id ?? user.userId;
      const userRole = user.role ?? user.userRole;
      const userEmail = user.email ?? user.mail;
      
      console.log('🔑 Token 信息:');
      console.log('   - 长度:', token.length);
      console.log('   - 用户ID:', userId);
      console.log('   - 用户角色:', userRole);
      console.log('   - 用户邮箱:', userEmail);
      console.log('   - Token 前缀:', token.substring(0, 30) + '...');
      
      return token;
    } catch (error) {
      console.error('❌ 获取 Token 失败:', error);
      return null;
    }
  }

  /**
   * 构建带 Token 的 WebSocket URL
   */
  buildWebSocketUrl() {
    const token = this.getToken();
    
    if (!token) {
      console.warn('⚠️ 未找到 JWT Token，将以无认证方式连接');
      return WS_URL;
    }
    
    // 将 token 作为查询参数添加到 URL
    const separator = WS_URL.includes('?') ? '&' : '?';
    const wsUrlWithToken = `${WS_URL}${separator}token=${encodeURIComponent(token)}`;
    
    console.log('🔗 WebSocket URL 已构建（含 Token）');
    console.log('   URL 长度:', wsUrlWithToken.length);
    
    return wsUrlWithToken;
  }

  /**
   * 初始化用户信息
   */
  initUserInfo() {
    try {
      const userData = localStorage.getItem("userData");
      if (userData) {
        const user = JSON.parse(userData);
        const oldUserId = this.userId;
        const oldUserRole = this.userRole;
        
        this.userId = user.id ?? user.userId;
        this.userRole = user.role ?? user.userRole;
        
        // ✅ 记录用户信息变化
        if (oldUserId !== this.userId || oldUserRole !== this.userRole) {
          console.log('🔄 用户信息已更新:', {
            old: { userId: oldUserId, userRole: oldUserRole },
            new: { userId: this.userId, userRole: this.userRole }
          });
        }
        
        console.log('✅ 当前用户信息:', {
          userId: this.userId,
          userRole: this.userRole,
          email: user.email ?? user.mail
        });
      } else {
        console.warn('⚠️ localStorage 中未找到用户数据');
        this.userId = null;
        this.userRole = null;
      }
    } catch (error) {
      console.error('❌ 获取用户信息失败:', error);
      this.userId = null;
      this.userRole = null;
    }
  }

  /**
   * 连接 WebSocket
   * @returns {Promise<WebSocket>}
   */
  connect() {
    // 1. 总是断开旧连接，确保使用最新用户信息和 token
    if (this.ws) {
      console.log('🔌 断开旧连接以确保使用最新用户信息和 Token');
      console.log('   旧连接状态:', this.ws.readyState);
      this.ws.close();
      this.ws = null;
    }

    // 2. 初始化用户信息（从 localStorage 读取最新数据）
    console.log('👤 初始化最新用户信息...');
    this.initUserInfo();
    
    // ✅ 验证用户信息是否完整
    if (!this.userId || !this.userRole) {
      console.error('❌ 用户信息不完整，无法建立连接');
      console.error('   userId:', this.userId);
      console.error('   userRole:', this.userRole);
      return Promise.reject(new Error('用户信息缺失，请重新登录'));
    }

    console.log('👤 准备连接的用户信息:', { 
      userId: this.userId, 
      userRole: this.userRole 
    });

    // 3. 创建新连接（带 Token）
    this.isConnecting = true;
    const wsUrl = this.buildWebSocketUrl();
    
    this.connectionPromise = new Promise((resolve, reject) => {
      console.log('🔌 准备连接 WebSocket');
      console.log('   URL 长度:', wsUrl.length);
      console.log('   用户信息:', { userId: this.userId, userRole: this.userRole });
      
      // ✅ 检查是否有 token
      const token = this.getToken();
      if (!token) {
        console.error('❌ 未找到 JWT Token，请先登录');
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(new Error('未登录，请先登录'));
        return;
      }
      
      console.log('🔑 Token 已获取');

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (error) {
        console.error('❌ 创建 WebSocket 失败:', error);
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(error);
        return;
      }

      // 设置连接超时（5秒）
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.error('⏰ 连接超时（5秒）');
          console.error('   当前状态:', this.ws?.readyState);
          this.ws.close();
          this.isConnecting = false;
          this.connectionPromise = null;
          reject(new Error('WebSocket 连接超时，请检查：1)后端服务是否启动 2)端口是否正确 3)网络是否正常'));
        }
      }, 5000);

      // 连接建立
      this.ws.onopen = () => {
        console.log('📡 WebSocket 连接已建立');
        console.log('   连接状态:', this.ws.readyState);
        console.log('   用户信息:', { userId: this.userId, userRole: this.userRole });
      };

      // 接收消息
      this.ws.onmessage = (event) => {
        try {
          console.log('📨 收到原始消息:', event.data);
          const data = JSON.parse(event.data);
          console.log('📨 解析后的消息:', data);

          // ✅ 只有收到 connected 类型才认为连接成功
          if (data.type === 'connected') {
            clearTimeout(connectionTimeout);
            this.isConnecting = false;
            console.log('✅ 连接成功:', data.message);
            console.log('   会话 ID:', data.sessionId);
            
            // ✅ 验证后端返回的用户信息是否与前端一致
            const backendUserId = data.userId;
            const backendUserRole = data.userRole;
            
            if (backendUserId && backendUserId !== this.userId) {
              console.error('⚠️ 警告：后端返回的用户ID与前端不一致！');
              console.error('   前端发送:', this.userId);
              console.error('   后端返回:', backendUserId);
            }
            
            if (backendUserRole && backendUserRole !== this.userRole) {
              console.error('⚠️ 警告：后端返回的用户角色与前端不一致！');
              console.error('   前端发送:', this.userRole);
              console.error('   后端返回:', backendUserRole);
              console.error('   这可能意味着 Token 与当前登录用户不匹配！');
            }

            // 保存 sessionId 到 localStorage
            if (data.sessionId) {
              localStorage.setItem('chatSessionId', data.sessionId);
            }

            resolve(this.ws);
          } else {
            // 其他消息类型，分发给处理器
            this.notifyHandlers(data);
          }
        } catch (error) {
          console.error('❌ 解析消息失败:', error);
          console.error('   原始数据:', event.data);
        }
      };

      // 连接错误
      this.ws.onerror = (error) => {
        console.error('❌ onerror 触发');
        console.error('   错误对象:', error);
        console.error('   WebSocket 状态:', this.ws?.readyState);
        console.error('   WebSocket URL:', this.ws?.url);
        
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(new Error('WebSocket 连接失败，请检查后端服务和网络连接'));
      };

      // 连接关闭
      this.ws.onclose = (event) => {
        console.log('🔌 onclose 触发');
        console.log('  - Code:', event.code);
        console.log('  - Reason:', event.reason || '无');
        console.log('  - WasClean:', event.wasClean);

        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        this.connectionPromise = null;

        // 只有当前连接是自己时才清空
        if (this.ws === event.target) {
          this.ws = null;
        }

        // 区分正常关闭和异常关闭
        if (event.code === 1000 || event.code === 1001) {
          console.log('ℹ️ 连接正常关闭');
        } else {
          console.error('⚠️ 连接异常关闭，code:', event.code);
          
          // 提供具体的错误说明
          if (event.code === 1006) {
            console.error('   可能原因：1)后端服务未启动 2)网络中断 3)防火墙阻止');
          } else if (event.code === 1008) {
            console.error('   可能原因：认证失败或 Token 无效');
          } else if (event.code === 1011) {
            console.error('   可能原因：服务器内部错误');
          }
        }
      };
    });

    return this.connectionPromise;
  }

  /**
   * 发送聊天消息
   */
  sendMessage(message, sessionId = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // 确保有活跃连接
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          await this.connect();
        }

        // ✅ 每次发送消息前都重新读取最新的用户信息
        // 这样可以确保用户切换或重新登录后使用正确的身份
        this.initUserInfo();

        // ✅ 验证用户信息是否完整
        if (!this.userId || !this.userRole) {
          console.error('❌ 用户信息不完整，无法发送消息');
          console.error('   userId:', this.userId);
          console.error('   userRole:', this.userRole);
          reject(new Error('用户信息缺失，请重新登录'));
          return;
        }

        const messageData = {
          type: 'chat',
          userId: this.userId,
          userRole: this.userRole,
          message: message,
          sessionId: sessionId
        };

        console.log('📤 发送消息:', messageData);
        this.ws.send(JSON.stringify(messageData));
        resolve();
      } catch (error) {
        console.error('❌ 发送消息失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 注册消息处理器
   */
  on(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type).push(handler);

    // 返回取消注册函数
    return () => {
      const handlers = this.messageHandlers.get(type);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * 通知所有消息处理器
   */
  notifyHandlers(data) {
    const { type } = data;
    const handlers = this.messageHandlers.get(type);

    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('❌ 消息处理器错误:', error);
        }
      });
    }
  }

  /**
   * 断开连接并清理所有状态
   */
  disconnect() {
    console.log('🔌 主动断开 WebSocket 连接...');
    
    // 清除所有消息处理器
    this.messageHandlers.clear();
    console.log('🗑️ 已清除所有消息处理器');
    
    // 关闭 WebSocket 连接
    if (this.ws) {
      try {
        // 使用正常关闭码 1000
        this.ws.close(1000, '用户主动登出');
        console.log('✅ WebSocket 连接已关闭');
      } catch (error) {
        console.error('❌ 关闭 WebSocket 时出错:', error);
      }
      this.ws = null;
    }
    
    // 重置连接状态
    this.isConnecting = false;
    this.connectionPromise = null;
    
    // 重置用户信息（防止身份混淆）
    this.userId = null;
    this.userRole = null;
    console.log('🗑️ 已清除本地用户信息缓存');
    
    console.log('✅ WebSocket 完全断开并清理完成');
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'disconnected';
    }
  }
}

// 导出单例
export const aiChatWS = new AIChatWebSocket();
