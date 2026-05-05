package com.hms.service.impl;

import com.hms.dto.response.JwtResponse;
import com.hms.entity.User;
import com.hms.repository.AuthRepository;
import com.hms.service.AuthService;
import com.hms.util.JwtUtil;
import com.hms.util.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthServiceImpl implements AuthService {
    
    @Autowired
    private AuthRepository authRepository;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public Response<?> Auth(String mail, String password) {
        User user = authRepository.findByEmail(mail);
        
        if (user == null) {
            return new Response<>("error", "用户不存在", null);
        }
        
        boolean passwordMatches;
        if (user.getPassword().startsWith("$2a$") || user.getPassword().startsWith("$2b$")) {
            passwordMatches = passwordEncoder.matches(password, user.getPassword());
        } else {
            passwordMatches = user.getPassword().equals(password);
        }
        
        if (!passwordMatches) {
            return new Response<>("error", "密码错误", null);
        }
        
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole(), user.getId());
        
        JwtResponse jwtResponse = new JwtResponse(
            token,
            user.getEmail(),
            user.getName(),
            user.getRole(),
            user.getId(),
            user.getNic() 
        );
        
        return new Response<>("success", "登录成功", jwtResponse);
    }

    @Override
    public Response<?> Register(User user) {
        if (user.getRole() == null || user.getRole().isEmpty()) {
            user.setRole("PATIENT");
        } else if (!"PATIENT".equals(user.getRole()) && !"ADMIN".equals(user.getRole())) {
            return new Response<>("error", "无效的角色类型，只能是PATIENT或ADMIN", null);
        }
        
        User existingUser = authRepository.findByEmail(user.getEmail());
        if (existingUser != null) {
            return new Response<>("error", "该邮箱已被注册", null);
        }
        
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        User save = authRepository.save(user);
        
        String token = jwtUtil.generateToken(save.getEmail(), save.getRole(), save.getId());
        
        JwtResponse jwtResponse = new JwtResponse(
            token,
            save.getEmail(),
            save.getName(),
            save.getRole(),
            save.getId(),
            save.getNic()
        );
        
        return new Response<>("success", "注册成功", jwtResponse);
    }
    
    @Override
    public Response<?> getUserByEmail(String email) {
        User user = authRepository.findByEmail(email);
        if (user != null) {
            user.setPassword(null);
            return new Response<>("success", "获取用户信息成功", user);
        } else {
            return new Response<>("error", "用户不存在", null);
        }
    }
}
