import React, { useEffect, useState, useMemo } from "react";
import { patientUserService } from "../services/patientUserService";
import { getStoredUser, setStoredUser } from "../services/apiClient";
import { toast } from "react-toastify";
import { FiSave, FiEdit2, FiRefreshCw } from "react-icons/fi";

function getPatientNicFromUser(user) {
  if (!user) return "";
  return (
    user.nic ??
    user.patientNic ??
    user.patientNIC ??
    user.idNumber ??
    user.patientId ??
    ""
  );
}

/**
 * 患者端：我的病例（按证件号匹配的诊疗记录）
 */
const PatientMyCasesPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nicInput, setNicInput] = useState("");
  const [isEditingNic, setIsEditingNic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // 从 localStorage 获取当前 NIC（登录时已同步）
  const currentNic = useMemo(() => {
    const u = getStoredUser();
    return String(getPatientNicFromUser(u) || "").trim();
  }, []);

  // 初始化输入框的值
  useEffect(() => {
    setNicInput(currentNic);
  }, [currentNic]);

  // 加载诊疗记录
  useEffect(() => {
    if (!currentNic) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 使用患者专用的API获取诊疗记录
        const list = await patientUserService.getMyTreatments();
        if (cancelled) return;
        const all = Array.isArray(list) ? list : [];
        setRows(all);
      } catch (e) {
        if (!cancelled) {
          console.error('加载诊疗记录失败:', e);
          toast.error(e.message || "加载诊疗记录失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNic]);

  // 提交NIC绑定
  const handleSubmitNic = async () => {
    const newNic = nicInput.trim();

    // 验证输入
    if (!newNic) {
      toast.warning("请输入患者证件号（NIC）");
      return;
    }

    // 确认对话框
    const confirmed = window.confirm(
      `您即将绑定/修改患者证件号为：${newNic}\n\n确认提交吗？`
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);

    try {
      // 调用后端接口保存NIC
      await patientUserService.bindNic(newNic);
      
      // 更新本地存储
      const userData = getStoredUser();
      if (userData) {
        userData.nic = newNic;
        setStoredUser(userData);
        
        // 触发storage事件，让其他组件也能更新
        window.dispatchEvent(new Event('storage'));
      }

      toast.success("患者证件号绑定成功！");
      setIsEditingNic(false);
      
      // 重新加载诊疗记录（通过刷新页面或重新触发useEffect）
      window.location.reload();
    } catch (error) {
      console.error('绑定NIC失败:', error);
      toast.error(error.message || "绑定失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setNicInput(currentNic);
    setIsEditingNic(false);
  };

  // 刷新数据
  const handleRefresh = async () => {
    if (!currentNic) {
      toast.warning("请先绑定患者证件号");
      return;
    }
    
    setLoading(true);
    try {
      const list = await patientUserService.getMyTreatments();
      const all = Array.isArray(list) ? list : [];
      setRows(all);
      toast.success("数据已刷新");
    } catch (error) {
      toast.error("刷新失败");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !currentNic) {
    return <div style={{ padding: 40, color: "#6b7280" }}>加载中…</div>;
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>我的病例</h2>
      
      {/* NIC 绑定区域 */}
      <div style={{ 
        background: "#eff6ff", 
        borderRadius: 12, 
        padding: "20px 24px", 
        marginBottom: 24,
        border: "2px solid #dbeafe"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e40af" }}>
            患者证件号（NIC）绑定
          </h3>
          {!isEditingNic && (
            <button
              onClick={() => setIsEditingNic(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: "#fff",
                border: "1.5px solid #3b82f6",
                color: "#3b82f6",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#3b82f6";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.color = "#3b82f6";
              }}
            >
              <FiEdit2 /> 修改
            </button>
          )}
        </div>

        {isEditingNic ? (
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                type="text"
                value={nicInput}
                onChange={(e) => setNicInput(e.target.value)}
                placeholder="请输入或修改您的患者证件号"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  border: "2px solid #3b82f6",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  transition: "border-color 0.2s"
                }}
                onFocus={(e) => e.target.style.borderColor = "#2563eb"}
                onBlur={(e) => e.target.style.borderColor = "#3b82f6"}
              />
              <button
                onClick={handleSubmitNic}
                disabled={submitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  background: submitting ? "#9ca3af" : "linear-gradient(135deg,#2563eb,#1e40af)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: "0 4px 10px rgba(37,99,235,0.3)",
                  transition: "all 0.2s"
                }}
              >
                <FiSave /> {submitting ? "提交中…" : "确认提交"}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={submitting}
                style={{
                  padding: "10px 20px",
                  background: "#fff",
                  color: "#ef4444",
                  border: "2px solid #ef4444",
                  borderRadius: 8,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                取消
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7280" }}>
              💡 提示：请输入您在医院登记的患者证件号（NIC），以便查看您的诊疗记录
            </p>
          </div>
        ) : (
          <div>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 12,
              padding: "12px 16px",
              background: "#fff",
              borderRadius: 8,
              border: "1.5px solid #bfdbfe"
            }}>
              <span style={{ fontSize: 14, color: "#6b7280" }}>当前绑定的证件号：</span>
              <strong style={{ 
                fontSize: 16, 
                color: "#1e40af",
                padding: "4px 12px",
                background: "#dbeafe",
                borderRadius: 6
              }}>
                {currentNic || "未绑定"}
              </strong>
            </div>
            {!currentNic && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#ef4444" }}>
                ⚠️ 您尚未绑定患者证件号，请点击右上角"修改"按钮进行绑定
              </p>
            )}
          </div>
        )}
      </div>

      {/* 诊疗记录列表 */}
      {!currentNic ? (
        <div style={{ 
          background: "#fff", 
          borderRadius: 14, 
          padding: "40px", 
          textAlign: "center",
          boxShadow: "0 2px 16px rgba(0,0,0,.07)"
        }}>
          <p style={{ color: "#9ca3af", fontSize: 15 }}>
            请先绑定患者证件号（NIC）以查看您的诊疗记录
          </p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", boxShadow: "0 2px 16px rgba(0,0,0,.07)" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#374151" }}>
                诊疗记录列表
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                证件号：{currentNic}
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                共 {rows.length} 条记录
              </span>
              <button
                onClick={handleRefresh}
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: loading ? "#f3f4f6" : "#fff",
                  border: "1.5px solid #e5e7eb",
                  color: loading ? "#9ca3af" : "#374151",
                  borderRadius: 8,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = "#f9fafb";
                    e.currentTarget.style.borderColor = "#d1d5db";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.borderColor = "#e5e7eb";
                  }
                }}
              >
                <FiRefreshCw className={loading ? "animate-spin" : ""} /> 
                {loading ? "刷新中…" : "刷新"}
              </button>
            </div>
          </div>
          
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              加载中…
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#1e40af", color: "#fff" }}>
                  <th style={th}>诊疗日期</th>
                  <th style={th}>医生</th>
                  <th style={th}>用药</th>
                  <th style={th}>病程记录</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>
                      暂无诊疗记录。
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={r.id || i} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                      <td style={td}>{r.treatmentDate}</td>
                      <td style={td}>{r.doctor}</td>
                      <td style={td}>{r.medications}</td>
                      <td style={td}>{r.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

const th = { padding: "12px 14px", textAlign: "left", fontWeight: 700 };
const td = { padding: "11px 14px", color: "#374151", verticalAlign: "top" };

export default PatientMyCasesPage;
