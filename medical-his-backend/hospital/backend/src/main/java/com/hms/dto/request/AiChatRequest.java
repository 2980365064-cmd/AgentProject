package com.hms.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatRequest {
    private String message;        // 用户发送的消息
    private String sessionId;      // 会话ID（可选，新建时为null）
    /** WebSocket 等场景下透传给 Python，工具回调 Java 接口时带回 Authorization */
    private String bearerToken;
}
