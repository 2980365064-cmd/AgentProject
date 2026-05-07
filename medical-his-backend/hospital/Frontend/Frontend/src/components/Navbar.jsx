import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { USER_DATA_KEY, getStoredUser, logout } from "../services/apiClient";
import { isPatientRole } from "../../constants";
import { toast } from "react-toastify";

const Navbar = () => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({ name: "", role: "" });

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setUserInfo({
        name: user.name || user.username || user.email || "用户",
        role: user.role || user.userRole || "",
      });
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const user = getStoredUser();
      if (!user) {
        console.log('🔌 检测到用户已登出，跳转到登录页');
        navigate("/login", { replace: true });
      } else {
        setUserInfo({
          name: user.name || user.username || user.email || "用户",
          role: user.role || user.userRole || "",
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [navigate]);

  const handleLogout = async () => {
    console.log('🚪 用户点击退出登录');
    
    try {
      // ✅ 使用统一的登出函数，确保彻底清理
      await logout();
      
      console.log('✅ 登出完成，立即跳转到登录页');
      
      // ✅ 使用 replace 强制替换当前路由，避免回退问题
      navigate("/login", { replace: true });
      
      // 显示成功提示（不依赖 onClose）
      toast.success('已安全退出登录', { 
        autoClose: 2000,
        position: "top-center"
      });
      
    } catch (error) {
      console.error('❌ 登出失败:', error);
      // 即使出错也强制跳转
      navigate("/login", { replace: true });
      toast.error('登出时出现错误', { autoClose: 2000 });
    }
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
  const navTitle = isPatientRole(userInfo.role) ? "🏥 仁爱医院" : "🏥 仁爱医院管理系统";

  return (
    <header
      style={{
        background: "linear-gradient(135deg, #1e40af, #2563eb)",
        padding: "14px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 4px 12px rgba(30,64,175,.25)",
      }}
    >
      {/* Logo / Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: ".5px",
          }}
        >
          {navTitle}
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
