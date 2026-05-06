package com.hms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiMessageDTO {
    private String role;      // 角色: "user" 或 "assistant"
    private String content;   // 消息内容
    private Long timestamp;   // 时间戳
}
