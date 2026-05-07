package com.hms.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Component
public class RoleInterceptor implements HandlerInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(RoleInterceptor.class);

    // 公开接口集合（与SecurityConfig保持一致）
    private static final Set<String> PUBLIC_PATHS = Set.of(
        "/api/v1/ai-assistant/allDoctors",
        "/api/v1/ai-assistant/searchDoctor",
        "/api/v1/ai-assistant/searchPatient"
    );

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        
        // OPTIONS请求直接放行
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }

        String uri = request.getRequestURI();
        String method = request.getMethod();

        // ✅ 第一步：公开接口直接放行
        if ("GET".equals(method) && PUBLIC_PATHS.contains(uri)) {
            logger.debug("✅ 公开接口: {}", uri);
            return true;
        }

        // ✅ 第二步：检查JWT认证状态
        String userRole = (String) request.getAttribute("role");
        String username = (String) request.getAttribute("username");
        
        if (userRole == null || username == null) {
            logger.warn("❌ 未认证访问: {}", uri);
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "未授权访问，请先登录");
            return false;
        }
        
        logger.info("🔐 已认证 | {} | 用户:{} | 角色:{}", uri, username, userRole);

        // ✅ 第三步：基于角色的权限控制
        return checkPermission(uri, userRole, response);
    }

    /**
     * 权限检查核心逻辑
     */
    private boolean checkPermission(String uri, String role, HttpServletResponse response) throws Exception {

        // ADMIN角色：可访问所有接口（除患者专属）
        if ("ADMIN".equals(role)) {
            if (uri.startsWith("/api/v1/patient/")) {
                sendError(response, HttpServletResponse.SC_FORBIDDEN, "此功能仅对患者开放");
                return false;
            }
            return true;
        }
        
        // PATIENT角色：只能访问患者接口和AI助手接口
        if ("PATIENT".equals(role)) {
            boolean allowed = uri.startsWith("/api/v1/patient/") ||
                             uri.startsWith("/api/v1/ai-assistant/");
            if (!allowed) {
                sendError(response, HttpServletResponse.SC_FORBIDDEN, "权限不足，此功能仅对管理员开放");
                return false;
            }
            return true;
        }
        
        // DOCTOR角色：同PATIENT
        if ("DOCTOR".equals(role)) {
            boolean allowed = uri.startsWith("/api/v1/patient/") ||
                             uri.startsWith("/api/v1/ai-assistant/");
            if (!allowed) {
                sendError(response, HttpServletResponse.SC_FORBIDDEN, "权限不足");
                return false;
            }
            return true;
        }

        // 其他角色拒绝
        sendError(response, HttpServletResponse.SC_FORBIDDEN, "无效的角色");
        return false;
    }

    /**
     * 统一错误响应
     */
    private void sendError(HttpServletResponse response, int status, String message) throws Exception {
        setCorsHeaders(response);
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");

        ObjectMapper mapper = new ObjectMapper();
        Map<String, Object> errorResponse = createErrorResponse(status, message);
        response.getWriter().write(mapper.writeValueAsString(errorResponse));
    }

    private void setCorsHeaders(HttpServletResponse response) {
        response.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
        response.setHeader("Access-Control-Allow-Credentials", "true");
    }

    private Map<String, Object> createErrorResponse(int status, String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("status", status == HttpServletResponse.SC_UNAUTHORIZED ? "error" : "forbidden");
        response.put("message", message);
        response.put("data", null);
        return response;
    }
}
