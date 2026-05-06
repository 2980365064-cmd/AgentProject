import { useMemo, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Register from "./pages/Registration";
import {
  PAGES,
  getNavItemsForRole,
  getDefaultActiveId,
  getDashboardRoot,
  PATIENT_ROOT_ID,
  isPatientRole,
} from "../constants";
import { getStoredUser } from "./services/apiClient";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function readUserRole() {
  const u = getStoredUser();
  return u?.role ?? u?.userRole ?? "";
}

/**
 * 路由守卫组件：检查用户是否登录
 */
const ProtectedRoute = ({ children }) => {
  const user = getStoredUser();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

/**
 * 角色守卫组件：检查用户是否有权限访问
 */
const RoleGuard = ({ allowedRoles, children }) => {
  const user = getStoredUser();
  const role = user?.role ?? user?.userRole ?? "";
  
  if (!allowedRoles.includes(role.toUpperCase())) {
    const redirectPath = isPatientRole(role) ? "/dashboard" : "/dashboard";
    return <Navigate to={redirectPath} replace />;
  }
  
  return children;
};

const HospitalLayout = () => {
  const [role, setRole] = useState(() => readUserRole());
  const navItems = useMemo(() => getNavItemsForRole(role), [role]);
  const root = useMemo(() => getDashboardRoot(role), [role]);

  const [active, setActive] = useState(() => getDefaultActiveId(role));

  useEffect(() => {
    const handleStorageChange = () => {
      const newRole = readUserRole();
      if (newRole !== role) {
        setRole(newRole);
        setActive(getDefaultActiveId(newRole));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [role]);

  const ActivePage =
    PAGES[active] ||
    (root.id === PATIENT_ROOT_ID ? PAGES.patientFreeDoctors : PAGES.dashboard);

  const activeLabel =
    navItems.find((n) => n.id === active)?.label || root.label;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif",
        background: "#f1f5f9",
      }}
    >
      <Navbar />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar active={active} setActive={setActive} navItems={navItems} />

        <main style={{ flex: 1, overflowY: "auto", padding: "32px 36px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 24,
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            <span
              style={{ color: "#1e40af", fontWeight: 600, cursor: "pointer" }}
              onClick={() => setActive(root.id)}
            >
              {root.label}
            </span>
            {active !== root.id && (
              <>
                <span>›</span>
                <span style={{ color: "#374151", fontWeight: 600 }}>{activeLabel}</span>
              </>
            )}
          </div>
          <ActivePage setActive={setActive} />
        </main>
      </div>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registration" element={<Register />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <HospitalLayout />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
