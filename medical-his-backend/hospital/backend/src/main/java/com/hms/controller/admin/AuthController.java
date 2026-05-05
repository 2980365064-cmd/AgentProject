package com.hms.controller.admin;

import com.hms.entity.User;
import com.hms.dto.request.AuthRequest;
import com.hms.dto.request.RegisterRequest;
import com.hms.service.AuthService;
import com.hms.util.Response;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {

    @Autowired
    private AuthService authService;


    @PostMapping("login")
    public Response<?> authRequest(@RequestBody AuthRequest request) {
        return authService.Auth(request.getMail(), request.getPassword());
    }

    @PostMapping("register")
    public Response<?> registerRequest(@RequestBody RegisterRequest request) {
        User user = User.builder()
                .name(request.getName())
                .password(request.getPassword())
                .email(request.getEmail())
                .role(request.getRole())
                .build();
        return authService.Register(user);
    }
    
    @GetMapping("user/{email}")
    public Response<?> getUserInfo(@PathVariable String email) {
        return authService.getUserByEmail(email);
    }

}
