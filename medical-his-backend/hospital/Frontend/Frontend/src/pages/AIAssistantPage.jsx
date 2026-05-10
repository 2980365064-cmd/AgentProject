import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {aiAssistantService} from '../services/aiAssistantService.js';
import {toast} from 'react-toastify';
import {getAiAssistantDisplayName, isPatientRole} from '../../constants';

const AIAssistantPage = ({ userRole }) => {
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

  const assistantName = useMemo(() => getAiAssistantDisplayName(userRole), [userRole]);
  const patientSide = useMemo(() => isPatientRole(userRole), [userRole]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const sessionRowId = (s) => s.id || s.sessionId || s.session_id;

  // ✅ 加载指定会话的历史消息（移到前面，避免引用问题）
  const loadMessages = useCallback(async (sessionId) => {
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      console.log('⚠️ 无效的会话ID，跳过加载消息');
      setMessages([]);
      return;
    }

    try {
      console.log('📥 加载会话消息:', sessionId);
      const messageList = await aiAssistantService.getMessages(sessionId);
      console.log('✅ 加载到消息数量:', messageList.length);
      setMessages(messageList);
    } catch (error) {
      console.error('❌ 加载消息失败:', error);
      toast.error(error.message || '加载消息失败');
      setMessages([]);
    }
  }, []);

  // ✅ 加载会话列表（移到前面，避免引用问题）
  const loadConversations = useCallback(async (deletedWasSelected = false, selectSessionId = null) => {
    try {
      console.log('📋 开始加载会话列表...');
      const sessionList = await aiAssistantService.getConversations();

      const validSessions = sessionList.map(session => ({
        ...session,
        id: sessionRowId(session),
      }));

      console.log('✅ 加载到会话数量:', validSessions.length);
      setConversations(validSessions);

      if (validSessions.length === 0) {
        console.log('ℹ️ 没有会话，清空当前会话和消息');
        setCurrentSessionId(null);
        setMessages([]);
        return;
      }

      const prevId = currentSessionIdRef.current;
      let nextId = null;

      // ✅ 优先选择指定的会话
      if (selectSessionId && validSessions.some((s) => sessionRowId(s) === selectSessionId)) {
        console.log('🎯 选择指定的会话:', selectSessionId);
        nextId = selectSessionId;
      } 
      // ✅ 如果之前有选中的会话，且该会话仍存在，则继续选中它
      else if (prevId && validSessions.some((s) => sessionRowId(s) === prevId)) {
        console.log('🔄 保持之前的会话:', prevId);
        nextId = prevId;
      } 
      // ✅ 如果是删除操作导致重新加载，选择第一个会话
      else if (deletedWasSelected) {
        console.log('🗑️ 之前选中的会话被删除，选择第一个会话');
        nextId = sessionRowId(validSessions[0]);
      } 
      // ✅ 否则选择第一个会话
      else {
        console.log('🆕 默认选择第一个会话:', sessionRowId(validSessions[0]));
        nextId = sessionRowId(validSessions[0]);
      }

      console.log('📌 最终选中的会话ID:', nextId);
      setCurrentSessionId(nextId);
      
      // ✅ 始终加载选中会话的消息（无论是否切换）
      if (nextId) {
        console.log('📥 开始加载会话消息...');
        await loadMessages(nextId);
      }
    } catch (error) {
      console.error('❌ 加载会话列表失败:', error);
      toast.error(error.message || '加载会话列表失败');
    } finally {
      setIsInitializing(false);
    }
  }, [loadMessages]);

  // ✅ 页面加载时连接 WebSocket
  useEffect(() => {
    console.log('🔌 AIAssistantPage: 初始化连接...');
    console.log('   当前用户角色:', userRole);

    let isMounted = true;

    const initConnection = async () => {
      try {
        // ✅ 强制重连以确保使用当前页面传入的用户角色
        console.log('🔄 强制重连 WebSocket 以使用最新用户信息...');
        await aiAssistantService.reconnectWS();

        if (isMounted) {
          setIsConnected(true);
          console.log('✅ WebSocket 连接成功');
          
          // ✅ WebSocket 连接成功后，重新加载会话列表以确保显示正确的数据
          console.log('🔄 WebSocket 连接成功，重新加载会话列表...');
          await loadConversations();
          
          toast.success(`✓ 已连接到${assistantName}`, { autoClose: 2000 });
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('❌ WebSocket 连接失败:', error);
        console.error('   错误信息:', error.message);
        console.error('   错误堆栈:', error.stack);
        
        // 提供更详细的错误提示
        let errorMessage = '✗ 连接服务器失败';
        
        if (error.message.includes('未登录')) {
          errorMessage = '✗ 请先登录后再使用 AI 助手';
        } else if (error.message.includes('超时')) {
          errorMessage = '✗ 连接超时，请检查后端服务是否启动（端口 8081）';
        } else if (error.message.includes('连接失败')) {
          errorMessage = '✗ 连接失败，请检查：1)后端服务是否启动 2)网络是否正常';
        } else {
          errorMessage = `✗ 连接失败：${error.message}`;
        }
        
        toast.error(errorMessage, { 
          autoClose: false,
          onClick: () => {
            console.log('🔄 尝试重新连接...');
            window.location.reload();
          }
        });
      }
    };

    initConnection();

    return () => {
      console.log('🧹 AIAssistantPage 卸载');
      isMounted = false;
      // 不断开连接，让其他页面可以继续使用
    };
  }, [assistantName, userRole, loadConversations]);

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

  // 初始加载会话列表（保留，但 loadConversations 已经在 WebSocket 连接时调用了）
  useEffect(() => {
    // ✅ 只在组件首次挂载时加载，WebSocket 连接后会再次加载
    if (!isConnected) {
      loadConversations();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 发送后输入框会因 disabled 失焦；恢复可输入时自动回焦
  useEffect(() => {
    if (!isConnected || !currentSessionId || isLoading) {
      return;
    }
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [isConnected, currentSessionId, isLoading]);

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
              {assistantName}
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
            {patientSide
              ? (currentSessionId ? '已选择会话，可咨询健康与就医相关问题（请以医生诊断为准）' : '请先创建或选择一个会话')
              : (currentSessionId ? '已选择会话，可进行院内业务与患者信息类对话' : '请先创建或选择一个会话')}
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
              <p style={{ fontSize: 13, margin: '8px 0 0 0' }}>
                {patientSide
                  ? '描述症状或健康疑问，健康小助手将提供科普与就医参考'
                  : '描述业务或患者查询需求，管理小助手将调用医护端工具协助处理'}
              </p>
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
                    {msg.isTyping && !msg.content ? (
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <span style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%', animation: 'pulse 1.4s infinite' }}></span>
                        <span style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%', animation: 'pulse 1.4s infinite 0.2s' }}></span>
                        <span style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%', animation: 'pulse 1.4s infinite 0.4s' }}></span>
                      </span>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                        {msg.isTyping ? (
                          <span
                            className="ai-stream-caret"
                            style={{
                              display: 'inline-block',
                              width: 2,
                              height: '1em',
                              marginLeft: 3,
                              verticalAlign: 'text-bottom',
                              background: '#3b82f6',
                            }}
                            aria-hidden
                          />
                        ) : null}
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

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.4; }
          40% { opacity: 1; }
        }
        @keyframes ai-stream-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .ai-stream-caret {
          animation: ai-stream-blink 1s step-end infinite;
        }
      `}</style>
    </div>
  );
};

export default AIAssistantPage;
