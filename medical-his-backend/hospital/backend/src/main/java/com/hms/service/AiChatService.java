package com.hms.service;

import com.hms.dto.AiSessionDTO;
import com.hms.dto.request.AiChatRequest;
import com.hms.dto.request.AiSessionCreateRequest;
import com.hms.dto.response.AiChatResponse;
import com.hms.util.Response;

import java.util.List;

public interface AiChatService {

    /**
     * 发送消息到AI助手
     * @param userId 用户ID
     * @param userRole 用户角色（PATIENT/DOCTOR）
     * @param request 聊天请求
     * @return AI回复
     */
    Response<?> sendMessage(Integer userId, String userRole, AiChatRequest request);

    /**
     * 获取用户的所有会话列表
     * @param userId 用户ID
     * @param userRole 用户角色
     * @return 会话列表
     */
    Response<?> getSessionList(Integer userId, String userRole);

    /**
     * 获取指定会话的历史消息
     * @param userId 用户ID
     * @param userRole 用户角色
     * @param sessionId 会话ID
     * @return 历史消息列表
     */
    // 建议统一使用这个签名
    Response<?> getSessionHistory(String sessionId, Integer userId, String userRole);

    /**
     * 删除指定会话
     * @param userId 用户ID
     * @param userRole 用户角色
     * @param sessionId 会话ID
     * @return 删除结果
     */
    Response<?> deleteSession(Integer userId, String userRole, String sessionId);

    /**
     * 创建新会话
     * @param userId 用户ID
     * @param userRole 用户角色
     * @param createRequest 可选：自定义标题等（可为 null）
     * @return 新会话ID
     */
    Response<?> createNewSession(Integer userId, String userRole, AiSessionCreateRequest createRequest);

    /**
     * 流式发送消息到AI助手（支持打字机效果）
     * @param userId 用户ID
     * @param userRole 用户角色
     * @param request 聊天请求
     * @param chunkCallback 每收到一个数据块的回调函数
     * @return 最终的完整响应
     */
    Response<?> sendMessageStream(
        Integer userId, 
        String userRole, 
        AiChatRequest request,
        java.util.function.Consumer<String> chunkCallback
    );

   

    Response<?> searchD(String name);

    Response<?> searchP(String name);


}
