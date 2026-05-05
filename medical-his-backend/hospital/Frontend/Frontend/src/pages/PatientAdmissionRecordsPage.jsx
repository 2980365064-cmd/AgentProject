import React, { useEffect, useState, useMemo } from "react";
import { authFetch, handleApiResponse, API_BASE_URL, getStoredUser } from "../services/apiClient";
import { toast } from "react-toastify";
import { requirePatientRole } from "../utils/permissionCheck";

// 🔧 直接在文件中定义API调用（避免导入问题）
const PATIENT_BASE_URL = `${API_BASE_URL}/api/v1/patient`;

async function getAdmissions() {
  console.log('🏥 获取住院记录');
  const response = await authFetch(`${PATIENT_BASE_URL}/admissions`);
  return await handleApiResponse(response, "获取住院记录");
}

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
 * 患者端：查看与本人相关的在院及历史住院记录
 */
const PatientAdmissionRecordsPage = () => {
  const [admitted, setAdmitted] = useState([]);
  const [discharged, setDischarged] = useState([]);
  const [loading, setLoading] = useState(true);

  const nic = useMemo(() => {
    const u = getStoredUser();
    return String(getPatientNicFromUser(u) || "").trim();
  }, []);

  // ✅ 权限检查：仅患者可访问
  useEffect(() => {
    try {
      requirePatientRole();
    } catch (error) {
      toast.error(error.message);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
      return;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        console.log('🏥 ========== 开始加载住院记录 ==========');
        
        // 🔍 调试信息：打印当前用户信息
        const currentUser = getStoredUser();
        console.log('👤 当前登录用户信息:', {
          userId: currentUser?.userId || currentUser?.id,
          username: currentUser?.username || currentUser?.email,
          name: currentUser?.name,
          role: currentUser?.role,
          nic: currentUser?.nic
        });
        
        console.log('📋 用于查询的NIC:', nic);
        console.log('🌐 调用API: GET', `${PATIENT_BASE_URL}/admissions`);
        
        // ✅ 调用API获取住院记录
        const responseData = await getAdmissions();
        
        if (cancelled) return;
        
        console.log('✅ 后端返回的原始数据:', responseData);
        console.log('数据类型:', typeof responseData);
        
        // ✅ 正确解析后端返回的数据结构
        // 后端返回格式：{ status, message, data: { currentAdmission, dischargeHistory, totalRecords } }
        let currentAdmission = null;
        let dischargeHistory = [];
        
        if (responseData && responseData.data) {
          // 新格式：嵌套对象
          currentAdmission = responseData.data.currentAdmission || null;
          dischargeHistory = Array.isArray(responseData.data.dischargeHistory) 
            ? responseData.data.dischargeHistory 
            : [];
          
          console.log('📊 解析后的数据:');
          console.log('  在院记录:', currentAdmission);
          console.log('  出院历史:', dischargeHistory);
          console.log('  总记录数:', responseData.data.totalRecords);
        } else if (Array.isArray(responseData)) {
          // 兼容旧格式：直接返回数组
          console.warn('⚠️ 检测到旧格式数据（数组），建议后端统一返回新格式');
          dischargeHistory = responseData;
        } else {
          console.warn('⚠️ 未知的数据格式:', responseData);
        }
        
        // ✅ 构建在院记录数组（可能有0或1条）
        const admittedList = currentAdmission ? [currentAdmission] : [];
        
        // ✅ 出院历史记录已经是数组
        const dischargedList = dischargeHistory;
        
        console.log('📊 最终分类结果:', {
          在院记录数: admittedList.length,
          出院记录数: dischargedList.length
        });
        
        // 📊 打印详细数据
        if (admittedList.length > 0) {
          console.log('🏥 在院记录详情:', admittedList[0]);
        }
        
        if (dischargedList.length > 0) {
          console.log('📋 出院记录详情（前3条）:');
          dischargedList.slice(0, 3).forEach((record, index) => {
            console.log(`  记录${index + 1}:`, {
              id: record.id,
              nic: record.nic,
              name: record.name,
              admissionDate: record.admissionDate,
              dischargeDate: record.dischargeDate,
              dischargeType: record.dischargeType
            });
          });
        }
        
        setAdmitted(admittedList);
        setDischarged(dischargedList);
        
        console.log('🏥 ========== 住院记录加载完成 ==========');
        
      } catch (e) {
        if (!cancelled) {
          console.error('❌ 加载住院记录失败:', e);
          console.error('错误堆栈:', e.stack);
          
          if (e.message.includes('403') || e.message.includes('权限')) {
            toast.error('没有权限访问此功能，请确认您的账号角色');
          } else if (e.message.includes('401') || e.message.includes('认证')) {
            toast.error('登录已过期，请重新登录');
          } else if (e.message.includes('网络连接')) {
            toast.error('网络连接失败，请检查后端服务是否启动');
          } else {
            toast.error(e.message || "加载住院记录失败");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nic]);

  if (loading) {
    return <div style={{ padding: 40, color: "#6b7280" }}>加载中…</div>;
  }

  if (!nic) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>查看住院记录</h2>
        <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
          当前账号未绑定患者证件号（NIC），无法匹配住院记录。请先绑定您的证件号。
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>查看住院记录</h2>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280" }}>证件号（NIC）：{nic}</p>

      {/* 在院记录 */}
      <section style={card}>
        <h3 style={h3}>在院记录</h3>
        <table style={table}>
          <thead>
            <tr style={{ background: "#1e40af", color: "#fff" }}>
              <th style={th}>姓名</th>
              <th style={th}>病区</th>
              <th style={th}>入院日期</th>
              <th style={th}>医疗组</th>
              <th style={th}>病情描述</th>
            </tr>
          </thead>
          <tbody>
            {admitted.length === 0 ? (
              <tr>
                <td colSpan={5} style={empty}>
                  暂无在院记录。
                </td>
              </tr>
            ) : (
              admitted.map((p, i) => (
                <tr key={p.id || i} style={tr(i)}>
                  <td style={td}>{p.name || p.patientName}</td>
                  <td style={td}>{p.ward || p.wardName}</td>
                  <td style={td}>{p.admissionDate || p.admission_date}</td>
                  <td style={td}>{p.team || p.medicalTeam}</td>
                  <td style={td}>{p.description || p.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* 历史出院记录 */}
      <section style={{ ...card, marginTop: 24 }}>
        <h3 style={h3}>历史出院记录</h3>
        <table style={table}>
          <thead>
            <tr style={{ background: "#1e40af", color: "#fff" }}>
              <th style={th}>姓名</th>
              <th style={th}>入院日期</th>
              <th style={th}>出院日期</th>
              <th style={th}>出院方式</th>
              <th style={th}>小结</th>
            </tr>
          </thead>
          <tbody>
            {discharged.length === 0 ? (
              <tr>
                <td colSpan={5} style={empty}>
                  暂无出院记录。
                </td>
              </tr>
            ) : (
              discharged.map((p, i) => (
                <tr key={p.id || i} style={tr(i)}>
                  <td style={td}>{p.name || p.patientName}</td>
                  <td style={td}>{p.admissionDate || p.admission_date}</td>
                  <td style={td}>{p.dischargeDate || p.discharge_date}</td>
                  <td style={td}>{p.dischargeType || p.discharge_type || p.dischargeMethod}</td>
                  <td style={td}>{p.summary || p.dischargeSummary || p.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

const card = { background: "#fff", borderRadius: 14, padding: "24px 28px", boxShadow: "0 2px 16px rgba(0,0,0,.07)" };
const h3 = { margin: "0 0 16px", fontSize: 16, color: "#374151" };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th = { padding: "12px 14px", textAlign: "left" };
const td = { padding: "11px 14px", color: "#374151" };
const empty = { padding: 28, textAlign: "center", color: "#9ca3af" };
const tr = (i) => ({ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e5e7eb" });

export default PatientAdmissionRecordsPage;
