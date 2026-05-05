// D:\TOOL\Project\JavaProject\hospital\backend\src\main\java\com\hms\config\JwtAuthenticationFilter.java
package com.hms.config;

import com.hms.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        try {
            String jwt = getJwtFromRequest(request);

            if (jwt != null && jwtUtil.validateToken(jwt, jwtUtil.getUsernameFromToken(jwt))) {
                String username = jwtUtil.getUsernameFromToken(jwt);
                String role = jwtUtil.getRoleFromToken(jwt);

                // 创建认证对象
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(username, null, new ArrayList<>());

                // 设置详细信息
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // 将认证信息存入SecurityContext
                SecurityContextHolder.getContext().setAuthentication(authentication);

                // 将用户信息存入request属性，供后续使用
                request.setAttribute("username", username);
                request.setAttribute("role", role);

                logger.debug("JWT认证成功，用户: {}, 角色: {}", username, role);
            }
        } catch (Exception e) {
            logger.error("JWT认证失败: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    /**
     * 从请求中提取JWT Token
     */
    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
