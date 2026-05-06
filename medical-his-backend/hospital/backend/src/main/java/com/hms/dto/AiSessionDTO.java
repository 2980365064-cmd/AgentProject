package com.hms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSessionDTO {
    private String id;           // 对应 Python 的 session_id
    private String title;        // 会话标题
    private Long createdAt;      // 创建时间戳
    private Long lastUpdatedAt;  // 最后更新时间戳
    private Integer messageCount;// 消息数量
}
