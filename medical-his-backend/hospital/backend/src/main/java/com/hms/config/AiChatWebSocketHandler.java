package com.hms.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.service.AiChatService;
import com.hms.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.HashMap;
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
        
        // ✅ 从 session attributes 中获取用户信息（由握手拦截器设置）
        Integer userId = (Integer) session.getAttributes().get("userId");
        String userRole = (String) session.getAttributes().get("userRole");
        String username = (String) session.getAttributes().get("username");
        
        log.info("╔════════════════════════════════════════╗");
        log.info("║   WebSocket 连接建立成功              ║");
        log.info("╠════════════════════════════════════════╣");
        log.info("║ Session ID: {}", sessionId);
        log.info("║ 用户名: {}", username);
        log.info("║ 用户ID: {}", userId);
        log.info("║ 用户角色: {}", userRole);
        log.info("║ Attributes 全部内容: {}", session.getAttributes());
        log.info("╚════════════════════════════════════════╝");

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
        String sessionId = session.getId();
        
        // ✅ 从 session attributes 中获取真实的用户信息（由握手拦截器设置）
        Integer userId = (Integer) session.getAttributes().get("userId");
        String userRole = (String) session.getAttributes().get("userRole");
        String username = (String) session.getAttributes().get("username");
        
        log.info("╔════════════════════════════════════════╗");
        log.info("║   收到聊天消息                        ║");
        log.info("╠════════════════════════════════════════╣");
        log.info("║ Session ID: {}", sessionId);
        log.info("║ 从 JWT Token 解析的用户信息:");
        log.info("║   - 用户名: {}", username);
        log.info("║   - 用户ID (从 attributes 获取): {}", userId);
        log.info("║   - 用户角色 (从 attributes 获取): {}", userRole);
        log.info("║ 前端传递的消息内容:");
        log.info("║   - message: {}", jsonNode.path("message").asText(""));
        log.info("║   - sessionId: {}", jsonNode.path("sessionId").asText(""));
        log.info("║   - userId (忽略): {}", jsonNode.path("userId").asText(""));
        log.info("║   - userRole (忽略): {}", jsonNode.path("userRole").asText(""));
        log.info("║ Attributes 全部内容: {}", session.getAttributes());
        log.info("╚════════════════════════════════════════╝");
        
        if (userId == null || userRole == null) {
            try {
                sendMessage(session, Map.of(
                    "type", "error",
                    "message", "会话未认证，请重新连接"
                ));
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("未认证的会话"));
            } catch (Exception e) {
                log.error("发送错误消息失败", e);
            }
            return;
        }
        
        final String message = jsonNode.path("message").asText("");
        String sid = jsonNode.path("sessionId").asText("").trim();
        
        if (sid.isEmpty() || "null".equalsIgnoreCase(sid) || "undefined".equalsIgnoreCase(sid)) {
            sid = "";
        }
        final String finalSessionId = sid.isEmpty() ? null : sid;

        log.info("→ 调用 AI 服务 - 用户ID: {}, 角色: {}, 会话: {}", userId, userRole, finalSessionId);

        // ✅ 异步处理聊天消息
        new Thread(() -> {
            try {
                if (message.trim().isEmpty()) {
                    sendMessage(session, Map.of(
                        "type", "error",
                        "message", "消息内容不能为空"
                    ));
                    return;
                }
                if (finalSessionId == null) {
                    sendMessage(session, Map.of(
                        "type", "error",
                        "message", "请先创建或选择一个会话后再发送"
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
                request.setSessionId(finalSessionId);
                Object jwtAttr = session.getAttributes().get("rawJwt");
                if (jwtAttr instanceof String raw && !raw.isBlank()) {
                    request.setBearerToken(raw);
                }

                log.info("✓ 准备调用 aiChatService.sendMessageStream(userId={}, userRole={})", userId, userRole);

                var response = aiChatService.sendMessageStream(
                    userId,
                    userRole,
                    request,
                    chunk -> {
                        if (chunk == null || chunk.isEmpty() || !session.isOpen()) {
                            return;
                        }
                        try {
                            Map<String, Object> chunkMsg = new HashMap<>();
                            chunkMsg.put("type", "chat_response");
                            chunkMsg.put("chunk", chunk);
                            chunkMsg.put("isChunk", true);
                            chunkMsg.put("streamType", "chunk");
                            chunkMsg.put("sessionId", finalSessionId != null ? finalSessionId : "");
                            chunkMsg.put("timestamp", System.currentTimeMillis());
                            chunkMsg.put("isComplete", false);
                            chunkMsg.put("done", false);
                            sendMessage(session, chunkMsg);
                        } catch (Exception e) {
                            log.error("推送流式片段失败", e);
                        }
                    }
                );

                // 3. 发送最终完成消息（与前端约定 isComplete/done 结束打字状态）
                if ("success".equals(response.getStatus())) {
                    var data = (com.hms.dto.response.AiChatResponse) response.getData();
                    String reply = data.getAiMessage() != null ? data.getAiMessage() : "";
                    String outSid = data.getSessionId() != null ? data.getSessionId() : finalSessionId;

                    Map<String, Object> doneMsg = new HashMap<>();
                    doneMsg.put("type", "chat_response");
                    doneMsg.put("aiMessage", reply);
                    doneMsg.put("sessionId", outSid != null ? outSid : "");
                    doneMsg.put("timestamp", data.getTimestamp());
                    doneMsg.put("isComplete", true);
                    doneMsg.put("done", true);
                    sendMessage(session, doneMsg);

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
