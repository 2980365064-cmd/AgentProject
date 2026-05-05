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

@Component
public class RoleInterceptor implements HandlerInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(RoleInterceptor.class);

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }

        String userRole = (String) request.getAttribute("role");
        String username = (String) request.getAttribute("username");
        
        if (userRole == null || username == null) {
            logger.warn("未认证访问: {}", request.getRequestURI());
            setCorsHeaders(response);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            ObjectMapper mapper = new ObjectMapper();
            response.getWriter().write(mapper.writeValueAsString(createErrorResponse("error", "未授权访问，请先登录", null)));
            return false;
        }
        
        logger.info("访问接口: {}, 用户: {}, 角色: {}", 
                    request.getRequestURI(), username, userRole);

        String requestURI = request.getRequestURI();
        
        // ADMIN角色可以访问所有接口
        if ("ADMIN".equals(userRole)) {
            // ADMIN不能访问患者专属接口
            if (requestURI.startsWith("/api/v1/patient/")) {
                logger.warn("ADMIN尝试访问患者接口: {}", requestURI);
                setCorsHeaders(response);
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json;charset=UTF-8");
                ObjectMapper mapper = new ObjectMapper();
                response.getWriter().write(mapper.writeValueAsString(
                    createErrorResponse("error", "此功能仅对患者开放", null)
                ));
                return false;
            }
            return true;
        }
        
        // PATIENT角色只能访问患者专属接口
        if ("PATIENT".equals(userRole)) {
            if (!requestURI.startsWith("/api/v1/patient/")) {
                logger.warn("患者尝试访问管理员接口: {}", requestURI);
                setCorsHeaders(response);
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json;charset=UTF-8");
                ObjectMapper mapper = new ObjectMapper();
                response.getWriter().write(mapper.writeValueAsString(
                    createErrorResponse("error", "权限不足，此功能仅对管理员开放", null)
                ));
                return false;
            }
            return true;
        }
        
        // 其他角色拒绝访问
        setCorsHeaders(response);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        ObjectMapper mapper = new ObjectMapper();
        response.getWriter().write(mapper.writeValueAsString(
            createErrorResponse("error", "无效的角色", null)
        ));
        return false;
    }

    private void setCorsHeaders(HttpServletResponse response) {
        response.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
        response.setHeader("Access-Control-Allow-Credentials", "true");
    }

    private Map<String, Object> createErrorResponse(String status, String message, Object data) {
        Map<String, Object> response = new HashMap<>();
        response.put("status", status);
        response.put("message", message);
        response.put("data", data);
        return response;
    }
}
