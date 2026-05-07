import React, { useState } from "react";
import { Badge } from "../components/UI";
import { patientService } from "../services/patientService";
import { dischargeService } from "../services/dischargeService";
import { zhGender, zhMedicalTeam, zhDischargeType } from "../utils/backendDisplayZh";

const PatientDetailsPage = () => {
  const [query, setQuery] = useState("");
  const [patient, setPatient] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState("Admitted");

  const handleSearch = async () => {
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery) return;

    try {
      // 1. Search in Admitted Patients first
      const allPatients = await patientService.getAll();
      const admitted = allPatients.find(
        (p) => p.nic?.toUpperCase() === normalizedQuery
      );

      if (admitted) {
        setPatient(admitted);
        setStatus("Admitted");
        setNotFound(false);
        return;
      }

      // 2. If not found, search in Discharge History (Archived records)
      const history = await dischargeService.getHistory();
      const discharged = history.find(
        (p) => p.nic?.toUpperCase() === normalizedQuery
      );

      if (discharged) {
        setPatient(discharged); // Backend now provides full details for Discharge entity
        setStatus("Discharged");
        setNotFound(false);
      } else {
        setPatient(null);
        setNotFound(true);
      }
    } catch (err) {
      console.error("Search Error:", err.message);
      setPatient(null);
      setNotFound(true);
    }
  };

  // Define display items dynamically based on status
  const displayItems = patient ? [
    { label: "证件号（NIC）",      value: patient.nic,           icon: "🪪" },
    { label: "年龄",             value: patient.age,           icon: "🎂" },
    { label: "性别",          value: zhGender(patient.gender),        icon: "👤" },
    { label: "所在病区",   value: patient.ward,          icon: "🏥" },
    { label: "医疗组",    value: zhMedicalTeam(patient.team),          icon: "👨‍⚕️" },
    { label: "入院日期",  value: patient.admissionDate, icon: "📥" },
    { label: "联系电话",  value: patient.contact,       icon: "📞" },
    { label: "入院备注 / 诊断", value: patient.description, icon: "📋" },
    // Show these only if status is Discharged
    ...(status === "Discharged" ? [
      { label: "出院日期", value: patient.dischargeDate, icon: "📅" },
      { label: "出院方式", value: zhDischargeType(patient.dischargeType), icon: "🛡️" },
      { label: "出院小结",  value: patient.summary,       icon: "📝" },
    ] : [])
  ] : [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif", padding: "20px" }}>

      {/* Search Bar Section */}
      <div style={searchContainerStyle}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, paddingLeft: 8 }}>
          <svg width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            placeholder="输入患者证件号（NIC）查询在院或历史档案…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            style={inputStyle}
          />
        </div>
        <button onClick={handleSearch} style={searchBtnStyle}>
          查询
        </button>
      </div>

      {patient ? (
        <div style={cardContainerStyle}>
          {/* Header Banner - Color changes based on status */}
          <div style={{
            ...headerBannerStyle,
            background: status === "Admitted" 
              ? "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)" 
              : "linear-gradient(135deg, #475569 0%, #64748b 100%)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                  <span style={nicBadgeStyle}>NIC: {patient.nic}</span>
                  <span style={{
                    ...statusBadgeStyle,
                    background: status === "Admitted" ? "#10b981" : "#ef4444"
                  }}>
                    {status === "Admitted" ? "在院" : "已出院"}
                  </span>
                </div>
                <h1 style={{ margin: "0 0 4px", fontSize: 32, fontWeight: 800 }}>{patient.name}</h1>
                <p style={{ margin: 0, opacity: 0.9, fontSize: 16 }}>
                   {status === "Admitted" ? "当前在院" : `已于 ${patient.dischargeDate} 出院`}
                </p>
              </div>
              <Badge
                color={status === "Admitted" ? "#10b981" : "#f59e0b"}
                label={patient.ward || "未分配病区"}
              />
            </div>
          </div>

          {/* Details Grid Content */}
          <div style={detailsGridContainer}>
            {displayItems.map((item) => (
              <div key={item.label} style={detailItemStyle}>
                <div style={iconBoxStyle}>{item.icon}</div>
                <div>
                  <div style={detailLabelStyle}>{item.label}</div>
                  <div style={detailValueStyle}>{item.value || "暂无记录"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : notFound ? (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: 50, marginBottom: 16 }}>🔎</div>
          <h3 style={{ color: "#1e293b", margin: "0 0 8px" }}>未找到患者</h3>
          <p style={{ margin: 0 }}>在在院与历史档案中均未找到证件号为「{query}」的记录。</p>
        </div>
      ) : (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: 50, marginBottom: 16 }}>🏥</div>
          <h3 style={{ color: "#1e293b", margin: "0 0 8px" }}>患者信息查询</h3>
          <p style={{ margin: 0 }}>请输入患者证件号（NIC）以调阅电子病历与在院信息。</p>
        </div>
      )}
    </div>
  );
};

// --- Styles ---

const searchContainerStyle = {
  background: "#fff", padding: "14px 20px", borderRadius: 16,
  boxShadow: "0 4px 20px rgba(0,0,0,.05)", display: "flex", gap: 12,
  alignItems: "center", marginBottom: 32, border: "1px solid #f1f5f9"
};

const inputStyle = { width: "100%", border: "none", outline: "none", fontSize: 16, color: "#1e293b" };

const searchBtnStyle = {
  background: "#2563eb", color: "#fff", border: "none", borderRadius: 10,
  padding: "12px 28px", cursor: "pointer", fontWeight: 600, fontSize: 14,
  transition: "all 0.2s"
};

const cardContainerStyle = {
  background: "#fff", borderRadius: 24, boxShadow: "0 10px 40px rgba(0,0,0,.04)",
  overflow: "hidden", border: "1px solid #f1f5f9"
};

const headerBannerStyle = { padding: "48px 48px 80px", color: "#fff", position: "relative" };

const nicBadgeStyle = { background: "rgba(255,255,255,0.2)", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: "0.5px" };

const statusBadgeStyle = { padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "#fff" };

const detailsGridContainer = {
  marginTop: -24, background: "#fff", borderRadius: "24px 24px 0 0",
  padding: "48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px 48px"
};

const detailItemStyle = { display: "flex", gap: 18, alignItems: "center" };

const iconBoxStyle = {
  width: 48, height: 48, borderRadius: 14, background: "#f1f5f9",
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22
};

const detailLabelStyle = { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" };

const detailValueStyle = { fontSize: 16, fontWeight: 600, color: "#1e293b", marginTop: 3 };

const emptyStateStyle = {
  textAlign: "center", padding: "100px 40px", background: "#fff",
  borderRadius: 24, border: "2px dashed #e2e8f0", color: "#94a3b8"
};

export default PatientDetailsPage;