import { useState, useEffect, useRef, useCallback } from 'react';
import { aiAssistantService } from '../services/aiAssistantService.js';
import { toast } from 'react-toastify';

const AIAssistantPage = () => {
  const [conversations, setConversations] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const titleInputRef = useRef(null);
  const currentSessionIdRef = useRef(null);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // ✅ 页面加载时连接 WebSocket
  useEffect(() => {
    console.log('🔌 AIAssistantPage: 初始化连接...');

    let isMounted = true;

    const initConnection = async () => {
      try {
        await aiAssistantService.connectWS();

        if (isMounted) {
          setIsConnected(true);
          console.log('✅ WebSocket 连接成功');
          toast.success('✓ 已连接到智能助手', { autoClose: 2000 });
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('❌ WebSocket 连接失败:', error);
        toast.error('✗ 连接服务器失败，请刷新页面重试', { autoClose: false });
      }
    };

    initConnection();

    return () => {
      console.log('🧹 AIAssistantPage 卸载');
      isMounted = false;
      // 不断开连接，让其他页面可以继续使用
    };
  }, []);

  // ✅ 注册消息监听器
  useEffect(() => {
    console.log('🔌 注册 WebSocket 监听器...');

    // 监听 AI 回复（支持流式和非流式两种模式）
    const unsubscribeResponse = aiAssistantService.onWSMessage('chat_response', (data) => {
      console.log('💬 处理 AI 回复:', data);

      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];

        // 判断是否为流式响应
        const isStreamChunk = data.isChunk || data.streamType === 'chunk' || data.type === 'stream_chunk';
        const isNewMessage = !lastMsg || lastMsg.role !== 'assistant' || !lastMsg.isTyping;

        if (isNewMessage) {
          // 创建新的 AI 消息
          return [...prev, {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: data.aiMessage || data.content || data.chunk || '',
            isTyping: !data.isComplete && !data.done,
            timestamp: new Date(data.timestamp || Date.now()).toISOString(),
          }];
        } else {
          // 更新现有的 AI 消息
          return prev.map(msg => {
            if (msg.id === lastMsg.id) {
              let newContent;

              if (isStreamChunk) {
                // ✅ 流式模式：追加新片段
                const chunk = data.chunk || data.content || data.aiMessage || '';
                newContent = msg.content + chunk;
              } else {
                // ❌ 非流式模式：直接替换（原有逻辑）
                newContent = data.aiMessage || data.content || msg.content;
              }

              return {
                ...msg,
                content: newContent,
                isTyping: !data.isComplete && !data.done && !(data.endOfStream),
                timestamp: new Date(data.timestamp || Date.now()).toISOString()
              };
            }
            return msg;
          });
        }
      });

      setIsLoading(false);

      if (data.sessionId && data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId);
      }
    });

    // ✅ 新增：监听专门的流式消息类型（如果后端使用）
    const unsubscribeStream = aiAssistantService.onWSMessage('stream_chunk', (data) => {
      console.log('🌊 收到流式片段:', data);

      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];

        if (!lastMsg || lastMsg.role !== 'assistant') {
          // 如果没有正在接收的消息，创建新的
          return [...prev, {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: data.chunk || data.content || '',
            isTyping: true,
            timestamp: new Date(data.timestamp || Date.now()).toISOString(),
          }];
        } else {
          // ✅ 追加到现有消息
          return prev.map(msg => {
            if (msg.id === lastMsg.id) {
              return {
                ...msg,
                content: msg.content + (data.chunk || data.content || ''),
                isTyping: !data.isComplete && !data.done,
              };
            }
            return msg;
          });
        }
      });

      setIsLoading(false);
    });

    // 监听 typing 状态
    const unsubscribeTyping = aiAssistantService.onWSMessage('typing', (data) => {
      console.log('⌨️ AI 正在输入:', data.message);
    });

    // 监听错误
    const unsubscribeError = aiAssistantService.onWSMessage('error', (data) => {
      console.error('❌ AI 错误:', data.message);
      toast.error(data.message);
      setIsLoading(false);
      setMessages(prev => prev.filter(msg => !msg.isTyping));
    });

    return () => {
      console.log('🔌 清理 WebSocket 监听器...');
      unsubscribeResponse();
      unsubscribeStream();
      unsubscribeTyping();
      unsubscribeError();
    };
  }, [currentSessionId]);

  const sessionRowId = (s) => s.id || s.sessionId || s.session_id;

  // 加载指定会话的历史消息
  const loadMessages = useCallback(async (sessionId) => {
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      return;
    }

    try {
      console.log('📥 加载会话消息:', sessionId);
      const messageList = await aiAssistantService.getMessages(sessionId);
      setMessages(messageList);
    } catch (error) {
      console.error('❌ 加载消息失败:', error);
      toast.error(error.message || '加载消息失败');
    }
  }, []);

  // 加载会话列表。deletedWasSelected：刚删掉了当前正在看的会话时传 true，会改选剩余列表中的第一个
  const loadConversations = useCallback(async (deletedWasSelected = false, selectSessionId = null) => {
    try {
      console.log('📋 开始加载会话列表...');
      const sessionList = await aiAssistantService.getConversations();

      const validSessions = sessionList.map(session => ({
        ...session,
        id: sessionRowId(session),
      }));

      setConversations(validSessions);

      if (validSessions.length === 0) {
        setCurrentSessionId(null);
        setMessages([]);
        return;
      }

      const prevId = currentSessionIdRef.current;
      let nextId = null;

      if (selectSessionId && validSessions.some((s) => sessionRowId(s) === selectSessionId)) {
        nextId = selectSessionId;
      } else if (deletedWasSelected) {
        nextId = sessionRowId(validSessions[0]);
      } else if (prevId && validSessions.some((s) => sessionRowId(s) === prevId)) {
        nextId = prevId;
      } else {
        nextId = sessionRowId(validSessions[0]);
      }

      setCurrentSessionId(nextId);
      if (nextId !== prevId || deletedWasSelected) {
        await loadMessages(nextId);
      }
    } catch (error) {
      console.error('❌ 加载会话列表失败:', error);
      toast.error(error.message || '加载会话列表失败');
    } finally {
      setIsInitializing(false);
    }
  }, [loadMessages]);

  // 初始加载会话列表
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputMessage]);

  // 打开创建会话对话框
  const handleOpenCreateModal = () => {
    setNewSessionTitle('');
    setShowCreateModal(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
  };

  // 关闭创建会话对话框
  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewSessionTitle('');
  };

  // 创建新会话
  const handleCreateNewConversation = async () => {
    try {
      const title = newSessionTitle.trim() || '新对话';

      const result = await aiAssistantService.createConversation(title);
      const serverId = result?.id ?? result?.sessionId ?? result?.session_id;
      if (!serverId) {
        throw new Error('服务器未返回会话 ID');
      }

      await loadConversations(false, serverId);

      setMessages([]);
      setInputMessage('');
      handleCloseCreateModal();

      toast.success(`会话「${title}」已创建`);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('❌ 创建会话失败:', error);
      toast.error(error.message || '创建会话失败');
    }
  };

  // 处理创建对话框的回车键
  const handleCreateModalKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateNewConversation();
    } else if (e.key === 'Escape') {
      handleCloseCreateModal();
    }
  };

  // 删除会话
  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation();

    try {
      console.log('🗑️ 开始删除会话:', id);

      const deletedWasSelected = id === currentSessionIdRef.current;

      await aiAssistantService.deleteConversation(id);

      await loadConversations(deletedWasSelected);

      toast.success('会话已删除');
    } catch (error) {
      console.error('❌ 删除会话失败:', error);
      toast.error(error.message || '删除会话失败');
    }
  };

  // 选择会话
  const handleSelectConversation = async (id) => {
    console.log('🔄 点击选择会话:', id);
    console.log('   当前选中:', currentSessionId);

    if (id === currentSessionId) {
      console.log('ℹ️ 已经是当前会话，无需切换');
      return;
    }

    console.log('✅ 切换到会话:', id);
    setCurrentSessionId(id);
    await loadMessages(id);
  };

  // 发送消息
  const handleSendMessage = async () => {
    console.log('📤 尝试发送消息');

    if (!inputMessage.trim()) {
      return;
    }

    if (isLoading) {
      return;
    }

    if (!currentSessionId) {
      toast.warning('请先创建或选择一个会话');
      return;
    }

    const sessionId = currentSessionId;
    const messageToSend = inputMessage.trim();

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    const assistantMessageId = `assistant_${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isTyping: true,
      timestamp: new Date().toISOString(),
    }]);

    try {
      console.log('📤 通过 WebSocket 发送消息');
      await aiAssistantService.sendMessageViaWS(messageToSend, sessionId);
      console.log('✅ 消息已发送，等待 AI 回复...');
    } catch (error) {
      console.error('❌ 发送消息失败:', error);
      toast.error(error.message || '发送消息失败');
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
      setIsLoading(false);
    }
  };

  // 处理回车发送
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 格式化日期
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 提取会话标题
  const getConversationTitle = (conv) => {
    if (conv.title) {
      return conv.title;
    }
    return '新对话';
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', background: '#f8fafc', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      {/* 左侧会话历史 */}
      <div style={{ width: 280, background: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        {/* 新建会话按钮 */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
          <button
            onClick={handleOpenCreateModal}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            新建对话
          </button>
        </div>

        {/* 会话列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {isInitializing ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <p style={{ fontSize: 13 }}>加载中...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <p style={{ fontSize: 13, margin: 0 }}>暂无对话记录</p>
              <p style={{ fontSize: 12, margin: '4px 0 0 0' }}>点击上方按钮开始新对话</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => {
                  console.log('👆 点击会话卡片:', conv.id);
                  handleSelectConversation(conv.id);
                }}
                style={{
                  padding: '12px',
                  marginBottom: 4,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: currentSessionId === conv.id ? '#eff6ff' : 'transparent',
                  borderLeft: currentSessionId === conv.id ? '3px solid #3b82f6' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (currentSessionId !== conv.id) {
                    e.currentTarget.style.background = '#f1f5f9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentSessionId !== conv.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ fontSize: 13, color: '#1e293b', fontWeight: currentSessionId === conv.id ? 600 : 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getConversationTitle(conv)}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{formatDate(conv.createdAt || conv.lastUpdatedAt || conv.updatedAt)}</span>
                  <button
                    onClick={(e) => {
                      console.log('🗑️ 点击删除按钮:', conv.id);
                      handleDeleteConversation(conv.id, e);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      color: '#94a3b8',
                      fontSize: '16px',
                      lineHeight: 1,
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#ef4444';
                      e.currentTarget.style.background = '#fee2e2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#94a3b8';
                      e.currentTarget.style.background = 'none';
                    }}
                    title="删除对话"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧聊天区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
        {/* 聊天头部 */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>
              智能问答助手
            </h2>
            {/* 连接状态指示器 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isConnected ? '#10b981' : '#ef4444',
                display: 'inline-block'
              }}></span>
              <span style={{ fontSize: '12px', color: isConnected ? '#10b981' : '#ef4444' }}>
                {isConnected ? '已连接' : '未连接'}
              </span>
            </div>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>
            {currentSessionId ? '已选择会话，可以开始对话' : '请先创建或选择一个会话'}
          </p>
        </div>

        {/* 消息列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
          {!currentSessionId ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <p style={{ fontSize: 16, margin: 0 }}>请先创建或选择会话</p>
              <p style={{ fontSize: 13, margin: '8px 0 0 0' }}>点击左侧"新建对话"按钮创建新会话</p>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <p style={{ fontSize: 16, margin: 0 }}>开始新的对话</p>
              <p style={{ fontSize: 13, margin: '8px 0 0 0' }}>输入您的问题，我将竭诚为您服务</p>
            </div>
          ) : (
            <div>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 16,
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                      : '#ffffff',
                    color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}>
                    {msg.isTyping ? (
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <span style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%', animation: 'pulse 1.4s infinite' }}></span>
                        <span style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%', animation: 'pulse 1.4s infinite 0.2s' }}></span>
                        <span style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%', animation: 'pulse 1.4s infinite 0.4s' }}></span>
                      </span>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginTop: 4 }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? (currentSessionId ? "输入您的问题...（Enter 发送）" : "请先创建或选择会话") : "正在连接服务器..."}
              disabled={!isConnected || isLoading || !currentSessionId}
              rows={1}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                fontSize: 14,
                resize: 'none',
                outline: 'none',
                minHeight: 44,
                maxHeight: 120,
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || !currentSessionId || !isConnected}
              style={{
                padding: '12px 24px',
                background: (!inputMessage.trim() || isLoading || !currentSessionId || !isConnected)
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                cursor: (!inputMessage.trim() || isLoading || !currentSessionId || !isConnected) ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {isLoading ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      </div>

      {/* 创建会话对话框 */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={handleCloseCreateModal}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              width: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>创建新会话</h3>
            <input
              ref={titleInputRef}
              type="text"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              onKeyPress={handleCreateModalKeyPress}
              placeholder="请输入会话名称（可选）"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 14,
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseCreateModal}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #cbd5e1',
                  background: 'white',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreateNewConversation}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.4; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AIAssistantPage;
