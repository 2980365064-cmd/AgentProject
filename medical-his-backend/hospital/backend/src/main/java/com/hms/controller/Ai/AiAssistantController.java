package com.hms.controller.Ai;

import com.hms.annotation.RequireRole;
import com.hms.dto.request.AiChatRequest;
import com.hms.dto.request.AiSessionCreateRequest;
import com.hms.service.AiChatService;
import com.hms.util.JwtUtil;
import com.hms.util.Response;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/v1/ai-assistant")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
@RequireRole({"PATIENT", "DOCTOR"})
public class AiAssistantController {

    @Autowired
    private AiChatService aiChatService;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * 发送消息到AI助手（智能问答）
     */
    @PostMapping("/chat")
    public Response<?> sendMessage(HttpServletRequest request, @RequestBody AiChatRequest chatRequest) {
        String token = extractToken(request);
        Integer userId = jwtUtil.getUserIdFromToken(token);
        String userRole = jwtUtil.getRoleFromToken(token);

        return aiChatService.sendMessage(userId, userRole, chatRequest);
    }

    /**
     * 创建新会话
     */
    @PostMapping("/sessions")
    public Response<?> createNewSession(
            HttpServletRequest request,
            @RequestBody(required = false) AiSessionCreateRequest createRequest) {
        String token = extractToken(request);
        Integer userId = jwtUtil.getUserIdFromToken(token);
        String userRole = jwtUtil.getRoleFromToken(token);

        return aiChatService.createNewSession(userId, userRole, createRequest);
    }

    /**
     * 获取用户的会话列表
     */
    @GetMapping("/sessions")
    public Response<?> getSessions(HttpServletRequest request, @RequestParam(required = false) Integer userId) {
        String token = extractToken(request);
        if (userId == null) {
            userId = jwtUtil.getUserIdFromToken(token);
        }
        String userRole = jwtUtil.getRoleFromToken(token);
        return aiChatService.getSessionList(userId, userRole);
    }

    @GetMapping("/sessions/{sessionId}/history")
    public Response<?> getHistory(HttpServletRequest request, @PathVariable String sessionId) {
        String token = extractToken(request);
        Integer userId = jwtUtil.getUserIdFromToken(token);
        String userRole = jwtUtil.getRoleFromToken(token);
        return aiChatService.getSessionHistory(sessionId, userId, userRole);
    }

    /**
     * 删除会话
     */
    @DeleteMapping("/sessions/{sessionId}")
    public Response<?> deleteSession(HttpServletRequest request, @PathVariable String sessionId) {
        String token = extractToken(request);
        Integer userId = jwtUtil.getUserIdFromToken(token);
        String userRole = jwtUtil.getRoleFromToken(token);

        return aiChatService.deleteSession(userId, userRole, sessionId);
    }

    /**
     * 从请求中提取JWT Token
     */
    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        throw new RuntimeException("未找到有效的Token");
    }
}
