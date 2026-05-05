package com.hms.repository;

import com.hms.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthRepository extends JpaRepository<User, Integer> {

    User findByEmailAndPassword(String mail, String password);
    
    // 添加根据邮箱查找用户的方法
    User findByEmail(String email);
}
