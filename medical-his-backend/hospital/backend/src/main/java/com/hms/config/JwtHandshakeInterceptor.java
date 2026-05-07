package com.hms.config;

import com.hms.util.JwtUtil;
import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);
    private final JwtUtil jwtUtil;

    public JwtHandshakeInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        // 从查询参数或 Header 中提取 Token
        String token = extractToken(request);
        
        log.info("╔════════════════════════════════════════╗");
        log.info("║   WebSocket 握手开始                  ║");
        log.info("╠════════════════════════════════════════╣");
        log.info("║ 请求URI: {}", request.getURI());
        log.info("║ 提取到的Token: {}", token != null ? token.substring(0, Math.min(20, token.length())) + "..." : "null");
        
        if (token != null && !token.isEmpty()) {
            try {
                // ✅ 详细记录从 Token 中解析的所有信息
                Claims claims = jwtUtil.getAllClaimsFromToken(token);
                String username = claims.getSubject();
                Integer userId = claims.get("userId", Integer.class);
                String userRole = claims.get("role", String.class);
                
                log.info("║ ✓ JWT Token 解析成功:");
                log.info("║   - 用户名 (sub): {}", username);
                log.info("║   - 用户ID (userId): {}", userId);
                log.info("║   - 用户角色 (role): {}", userRole);
                
                // ✅ 关键：清除 attributes 中可能存在的旧数据
                attributes.clear();
                log.info("║ ✓ 已清除旧的 attributes 数据");
                
                // 将用户信息存储到 WebSocket Session 的 attributes 中
                attributes.put("rawJwt", token);
                attributes.put("userId", userId);
                attributes.put("userRole", userRole);
                attributes.put("username", username);
                
                log.info("║ ✓ 新用户信息已存储到 session attributes");
                log.info("║   - attributes.userId: {}", attributes.get("userId"));
                log.info("║   - attributes.userRole: {}", attributes.get("userRole"));
                log.info("╚════════════════════════════════════════╝");
                return true;
            } catch (Exception e) {
                log.error("✗ JWT Token 解析失败: {}", e.getMessage(), e);
                log.info("╚════════════════════════════════════════╝");
                return false; // 拒绝握手
            }
        } else {
            log.warn("⚠ WebSocket 握手未提供有效的JWT Token");
            log.info("╚════════════════════════════════════════╝");
            return false; // 拒绝握手
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // 握手后处理，通常不需要做什么
    }

    private String extractToken(ServerHttpRequest request) {
        // 尝试从查询参数获取
        String query = request.getURI().getQuery();
        log.debug("WebSocket 握手查询参数: {}", query);
        
        if (query != null && !query.isEmpty()) {
            String[] params = query.split("&");
            for (String param : params) {
                if (param.startsWith("token=")) {
                    String raw = param.substring(6);
                    try {
                        raw = URLDecoder.decode(raw, StandardCharsets.UTF_8);
                    } catch (Exception ignored) {
                        // keep raw
                    }
                    log.info("从URL查询参数中提取到Token");
                    return raw;
                }
            }
        }
        
        // 尝试从 Header 获取
        String authHeader = request.getHeaders().getFirst("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            log.info("从Authorization Header中提取到Token");
            return token;
        }
        
        log.warn("未能从请求中提取到Token");
        return null;
    }
}
