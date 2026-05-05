import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { USER_DATA_KEY, getStoredUser } from "../services/apiClient";

const Navbar = () => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({ name: "", role: "" });

  useEffect(() => {
    loadUserInfo();
    
    // 监听storage变化，当用户信息更新时同步更新显示
    const handleStorageChange = () => {
      loadUserInfo();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const loadUserInfo = () => {
    const userData = getStoredUser();
    
    console.log('📋 Navbar - 读取到的用户数据:', userData);
    
    if (userData) {
      const name = userData.name || userData.userName || userData.username || "未设置姓名";
      const role = userData.role || userData.userRole || "";
      
      console.log('📋 Navbar - 解析后的信息:', { name, role });
      
      setUserInfo({
        name: name,
        role: role
      });
    } else {
      console.warn('⚠️ Navbar - 未找到用户数据');
      setUserInfo({ name: "未登录", role: "" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_DATA_KEY);
    navigate("/login");
  };

  // 角色映射：将后端返回的角色转换为中文显示
  const getRoleDisplay = (role) => {
    if (!role) return "";
    
    const roleStr = String(role).toUpperCase();
    
    // 根据实际后端返回的角色值进行映射
    const roleMap = {
      'ADMIN': '管理员',
      'PATIENT': '患者',
      'DOCTOR': '医生',
      'NURSE': '护士',
      'USER': '用户',
      'MANAGER': '管理员'
    };
    
    return roleMap[roleStr] || role;
  };

  // 获取角色对应的颜色
  const getRoleColor = (role) => {
    if (!role) return '#6b7280';
    
    const roleStr = String(role).toUpperCase();
    
    const colorMap = {
      'ADMIN': '#f59e0b',      // 橙色 - 管理员
      'PATIENT': '#10b981',    // 绿色 - 患者
      'DOCTOR': '#3b82f6',     // 蓝色 - 医生
      'NURSE': '#8b5cf6',      // 紫色 - 护士
      'USER': '#6b7280',       // 灰色 - 普通用户
      'MANAGER': '#f59e0b'     // 橙色 - 管理员
    };
    
    return colorMap[roleStr] || '#6b7280';
  };

  const roleDisplay = getRoleDisplay(userInfo.role);
  const roleColor = getRoleColor(userInfo.role);

  return (
    <header
      style={{
        background: "linear-gradient(90deg, #1e3a8a 0%, #1e40af 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        height: 56,
        flexShrink: 0,
        boxShadow: "0 2px 12px rgba(30,58,138,.4)",
        zIndex: 10,
      }}
    >
      {/* Logo + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            background: "#fff",
            color: "#1e40af",
            fontWeight: 900,
            fontSize: 15,
            width: 34,
            height: 34,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            letterSpacing: "-1px",
          }}
        >
          H
        </div>
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: ".4px" }}>
          医院管理系统
        </span>
      </div>

      {/* User Info + Logout */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* 显示用户名和角色 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, opacity: 0.9 }}>
            当前登录：
          </span>
          
          {/* 用户名 */}
          <strong
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {userInfo.name}
          </strong>
          
          {/* 角色标签 */}
          {roleDisplay && (
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                background: roleColor,
                color: "#fff",
                borderRadius: "12px",
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}
            >
              {roleDisplay}
            </span>
          )}
        </div>

        {/* 退出登录按钮 */}
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,.12)",
            border: "1.5px solid rgba(255,255,255,.25)",
            color: "#fff",
            borderRadius: 8,
            padding: "6px 16px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            transition: "all .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,.22)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,.12)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <Icon name="logout" /> 退出登录
        </button>
      </div>
    </header>
  );
};

export default Navbar;
