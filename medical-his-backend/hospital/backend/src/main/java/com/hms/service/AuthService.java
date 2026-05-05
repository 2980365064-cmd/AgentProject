package com.hms.service;

import com.hms.entity.User;
import com.hms.util.Response;

public interface AuthService {

    Response<?> Auth(String mail, String password);

    Response<?> Register(User user);
    
    Response<?> getUserByEmail(String email);
}
