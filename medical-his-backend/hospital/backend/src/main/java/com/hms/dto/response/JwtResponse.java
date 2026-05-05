package com.hms.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class JwtResponse {
    private String token;
    private String type = "Bearer";
    private String username;
    private String name;
    private String role;
    private Integer userId;
    private String nic; // ⚠️ 新增：添加 NIC 字段

    public JwtResponse(String token, String username, String name, String role, Integer userId, String nic) {
        this.token = token;
        this.username = username;
        this.name = name;
        this.role = role;
        this.userId = userId;
        this.nic = nic;
    }
}
