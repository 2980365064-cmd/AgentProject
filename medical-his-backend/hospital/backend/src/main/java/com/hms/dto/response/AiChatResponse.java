package com.hms.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatResponse {
    private String aiMessage;      // AI回复的消息
    private String sessionId;      // 会话ID
    private Long timestamp;        // 时间戳
}
