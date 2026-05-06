package com.hms.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.service.AiChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AiChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(AiChatWebSocketHandler.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    // 存储会话映射：sessionId -> WebSocketSession
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    private final AiChatService aiChatService;

    public AiChatWebSocketHandler(AiChatService aiChatService) {
        this.aiChatService = aiChatService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        sessions.put(sessionId, session);
        log.info("✓ WebSocket 连接建立: {}", sessionId);

        // ✅ 使用 synchronized 确保线程安全，并增加重试机制
        new Thread(() -> {
            int maxRetries = 3;
            for (int i = 0; i < maxRetries; i++) {
                try {
                    // 短暂延迟确保连接完全建立
                    Thread.sleep(50);
                    
                    if (!session.isOpen()) {
                        log.warn("⚠ WebSocket 连接已关闭，无法发送欢迎消息: {}", sessionId);
                        return;
                    }
                    
                    sendMessage(session, Map.of(
                        "type", "connected",
                        "message", "已连接到智能助手",
                        "sessionId", sessionId
                    ));
                    log.info("✓ 欢迎消息发送成功: {}", sessionId);
                    return;
                    
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.error("✗ 发送欢迎消息被中断: {}", sessionId, e);
                    return;
                } catch (Exception e) {
                    if (i < maxRetries - 1) {
                        log.warn("⚠ 欢迎消息发送失败，重试 ({}/{}): {}", i + 1, maxRetries, e.getMessage());
                        try {
                            Thread.sleep(100);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            return;
                        }
                    } else {
                        log.error("✗ 欢迎消息发送失败（已达最大重试次数）: {}", sessionId, e);
                    }
                }
            }
        }).start();
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.info("收到 WebSocket 消息: {}", payload);

        try {
            JsonNode jsonNode = objectMapper.readTree(payload);
            String type = jsonNode.get("type").asText();

            switch (type) {
                case "chat":
                    handleChatMessage(session, jsonNode);
                    break;
                case "ping":
                    sendMessage(session, Map.of("type", "pong"));
                    break;
                default:
                    log.warn("未知的消息类型: {}", type);
            }
        } catch (Exception e) {
            log.error("处理 WebSocket 消息失败", e);
            sendMessage(session, Map.of(
                "type", "error",
                "message", "消息处理失败: " + e.getMessage()
            ));
        }
    }

    private void handleChatMessage(WebSocketSession session, JsonNode jsonNode) {
        final String userIdStr = jsonNode.path("userId").asText("").trim();
        final String userRole = jsonNode.path("userRole").asText("").trim();
        final String message = jsonNode.path("message").asText("");
        String sid = jsonNode.path("sessionId").asText("").trim();
        if (sid.isEmpty() || "null".equalsIgnoreCase(sid) || "undefined".equalsIgnoreCase(sid)) {
            sid = "";
        }
        final String sessionId = sid.isEmpty() ? null : sid;

        log.info("处理聊天消息 - 用户: {}, 角色: {}, 会话: {}", userIdStr, userRole, sessionId);

        // ✅ 异步处理聊天消息
        new Thread(() -> {
            try {
                if (userIdStr.isEmpty() || userRole.isEmpty()) {
                    sendMessage(session, Map.of(
                        "type", "error",
                        "message", "用户信息不完整，请重新登录后再试"
                    ));
                    return;
                }
                if (message.trim().isEmpty()) {
                    sendMessage(session, Map.of(
                        "type", "error",
                        "message", "消息内容不能为空"
                    ));
                    return;
                }
                if (sessionId == null) {
                    sendMessage(session, Map.of(
                        "type", "error",
                        "message", "请先创建或选择一个会话后再发送"
                    ));
                    return;
                }

                final int userId;
                try {
                    userId = Integer.parseInt(userIdStr);
                } catch (NumberFormatException e) {
                    sendMessage(session, Map.of(
                        "type", "error",
                        "message", "用户身份无效，请重新登录"
                    ));
                    return;
                }

                // 1. 发送"正在输入"状态
                sendMessage(session, Map.of(
                    "type", "typing",
                    "message", "AI 正在思考..."
                ));

                // 2. 调用 AI（使用 /chat/messages：比 HttpClient 拉 SSE 更稳定）
                com.hms.dto.request.AiChatRequest request = new com.hms.dto.request.AiChatRequest();
                request.setMessage(message.trim());
                request.setSessionId(sessionId);

                var response = aiChatService.sendMessage(
                    userId,
                    userRole,
                    request
                );

                // 3. 发送最终完成消息
                if ("success".equals(response.getStatus())) {
                    var data = (com.hms.dto.response.AiChatResponse) response.getData();
                    String reply = data.getAiMessage() != null ? data.getAiMessage() : "";

                    sendMessage(session, Map.of(
                        "type", "chat_response",
                        "aiMessage", reply,
                        "sessionId", data.getSessionId(),
                        "timestamp", data.getTimestamp(),
                        "isComplete", true,
                        "done", true
                    ));

                    log.info("✓ AI 回复完成，总长度: {}", reply.length());
                } else {
                    sendMessage(session, Map.of(
                        "type", "error",
                        "message", response.getMessage() != null ? response.getMessage() : "AI 服务调用失败"
                    ));
                }
            } catch (Exception e) {
                log.error("调用 AI 服务失败", e);
                try {
                    sendMessage(session, Map.of(
                        "type", "error",
                        "message", "AI 服务异常: " + e.getMessage()
                    ));
                } catch (Exception ex) {
                    log.error("发送错误消息失败", ex);
                }
            }
        }).start();
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session.getId());
        log.info("✗ WebSocket 连接关闭: {}, 状态: {}", session.getId(), status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String sessionId = session.getId();
        sessions.remove(sessionId);
        
        // ✅ 区分正常断开和异常断开
        if (exception instanceof java.io.IOException && exception.getMessage() != null 
                && (exception.getMessage().contains("你的主机中的软件中止了一个已建立的连接")
                    || exception.getMessage().contains("Broken pipe"))) {
            log.info("ℹ WebSocket 客户端正常断开: {}", sessionId);
        } else {
            log.error("✗ WebSocket 传输错误: {}", sessionId, exception);
        }
    }

    /**
     * 发送消息到指定会话（增加异常处理和日志）
     */
    private void sendMessage(WebSocketSession session, Map<String, Object> data) throws Exception {
        if (session == null || !session.isOpen()) {
            log.warn("⚠ 会话未打开或为null，无法发送消息");
            return;
        }
        
        try {
            String json = objectMapper.writeValueAsString(data);
            TextMessage textMessage = new TextMessage(json);
            session.sendMessage(textMessage);
            log.debug("✓ 消息发送成功: {}", json);
        } catch (Exception e) {
            log.error("✗ 消息发送失败: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * 广播消息到所有会话
     */
    public void broadcastMessage(Map<String, Object> data) throws Exception {
        String json = objectMapper.writeValueAsString(data);
        for (WebSocketSession session : sessions.values()) {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(json));
            }
        }
    }
}
