
package com.hms.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    @Value("${jwt.secret:HospitalManagementSystemSecretKey2026ForJWTTokenGeneration}")
    private String secret;

    @Value("${jwt.expiration:86400000}")
    private Long expiration; // 默认24小时（毫秒）

    /**
     * 生成签名密钥
     */
    private SecretKey getSignKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * 生成JWT Token
     * @param username 用户名（邮箱）
     * @param role 用户角色
     * @param userId 用户ID
     * @return JWT Token字符串
     */
    public String generateToken(String username, String role, Integer userId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", role);
        claims.put("userId", userId);

        return createToken(claims, username);
    }

    /**
     * 创建Token
     */
    private String createToken(Map<String, Object> claims, String subject) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(getSignKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * 从Token中获取所有声明
     */
    public Claims getAllClaimsFromToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /**
     * 从Token中获取用户名
     */
    public String getUsernameFromToken(String token) {
        return getAllClaimsFromToken(token).getSubject();
    }

    /**
     * 从Token中获取角色
     */
    public String getRoleFromToken(String token) {
        return (String) getAllClaimsFromToken(token).get("role");
    }

    /**
     * 从Token中获取用户ID
     */
    public Integer getUserIdFromToken(String token) {
        return (Integer) getAllClaimsFromToken(token).get("userId");
    }

    /**
     * 检查Token是否过期
     */
    public Boolean isTokenExpired(String token) {
        Date expiration = getAllClaimsFromToken(token).getExpiration();
        return expiration.before(new Date());
    }

    /**
     * 验证Token是否有效
     */
    public Boolean validateToken(String token, String username) {
        try {
            final String tokenUsername = getUsernameFromToken(token);
            return (tokenUsername.equals(username) && !isTokenExpired(token));
        } catch (Exception e) {
            return false;
        }
    }
}
