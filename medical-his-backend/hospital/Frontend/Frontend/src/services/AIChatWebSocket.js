// src/services/aiChatWebSocket.js

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
   * 初始化用户信息
   */
  initUserInfo() {
    try {
      const userData = localStorage.getItem("userData");
      if (userData) {
        const user = JSON.parse(userData);
        this.userId = user.id ?? user.userId;
        this.userRole = user.role ?? user.userRole;
      }
    } catch (error) {
      console.error('❌ 获取用户信息失败:', error);
    }
  }

  /**
   * 连接 WebSocket
   * @returns {Promise<WebSocket>}
   */
  connect() {
    // 1. 如果已有活跃连接，直接返回
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('✅ 使用现有 WebSocket 连接');
      return Promise.resolve(this.ws);
    }

    // 2. 如果正在连接中，返回现有的 Promise
    if (this.isConnecting && this.connectionPromise) {
      console.log('⏳ 正在连接中，等待完成...');
      return this.connectionPromise;
    }

    // 3. 清理旧连接
    if (this.ws) {
      console.log('🔌 清理旧连接');
      this.ws.close();
      this.ws = null;
    }

    // 4. 初始化用户信息
    this.initUserInfo();

    // 5. 创建新连接
    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      console.log('🔌 准备连接 WebSocket:', WS_URL);

      this.ws = new WebSocket(WS_URL);

      // 设置连接超时（5秒）
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.error('⏰ 连接超时');
          this.ws.close();
          this.isConnecting = false;
          this.connectionPromise = null;
          reject(new Error('WebSocket 连接超时'));
        }
      }, 5000);

      // 连接建立
      this.ws.onopen = () => {
        console.log('📡 onopen 触发，等待欢迎消息...');
      };

      // 接收消息
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 收到消息:', data);

          // ✅ 只有收到 connected 类型才认为连接成功
          if (data.type === 'connected') {
            clearTimeout(connectionTimeout);
            this.isConnecting = false;
            console.log('✅ 连接成功:', data.message);
            console.log('💾 会话 ID:', data.sessionId);

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
        }
      };

      // 连接错误
      this.ws.onerror = (error) => {
        console.error('❌ onerror 触发:', error);
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(new Error('WebSocket 连接失败'));
      };

      // 连接关闭
      this.ws.onclose = (event) => {
        console.log('🔌 onclose 触发');
        console.log('  - Code:', event.code);
        console.log('  - Reason:', event.reason || '无');

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

        if (!this.userId || !this.userRole) {
          this.initUserInfo();
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
   * 断开连接
   */
  disconnect() {
    if (this.ws) {
      console.log('🔌 主动断开连接');
      this.ws.close(1000, '用户主动断开');
      this.ws = null;
    }
    this.isConnecting = false;
    this.connectionPromise = null;
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
