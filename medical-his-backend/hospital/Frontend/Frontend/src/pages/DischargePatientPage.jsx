import React, { useState, useMemo, useEffect } from "react";
import Select from "react-select";
import { Field, FormCard } from "../components/UI";
import { patientService } from "../services/patientService";
import { dischargeService } from "../services/dischargeService";
import { toast } from "react-toastify";

const DISCHARGE_TYPES = [
  { value: "Regular", label: "常规出院" },
  { value: "AOR", label: "医嘱离院（AOR）" },
  { value: "Expired", label: "死亡" }
];

const EMPTY_FORM = {
  nic: "",
  patientName: "",
  dischargeDate: "",
  dischargeType: "",
  summary: "",
};

const DischargePatientPage = () => {
  const [admittedPatients, setAdmittedPatients] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedNIC, setSelectedNIC] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [admitted, historyData] = await Promise.all([
        patientService.getAll(),
        dischargeService.getHistory()
      ]);
      setAdmittedPatients(admitted);
      setHistory(historyData);
    } catch (err) {
      toast.error("从服务器加载数据失败");
    }
  };

  const nicOptions = useMemo(() => 
    admittedPatients.map((p) => ({
      value: p.nic,
      label: `${p.nic} - ${p.name}`,
      patientName: p.name
    })), 
  [admittedPatients]);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleNICChange = (selectedOption) => {
    setSelectedNIC(selectedOption);
    if (selectedOption) {
      setForm({
        ...form,
        nic: selectedOption.value,
        patientName: selectedOption.patientName
      });
    } else {
      setForm(EMPTY_FORM);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.nic || !form.dischargeDate || !form.dischargeType) {
      toast.warn("请填写所有必填项");
      return;
    }

    setIsLoading(true);
    try {
      await dischargeService.submitDischarge({
        nic: form.nic,
        name: form.patientName,
        dischargeDate: form.dischargeDate,
        dischargeType: form.dischargeType,
        summary: form.summary
      });

      toast.success("出院办理成功！");
      setForm(EMPTY_FORM);
      setSelectedNIC(null);
      await loadInitialData(); 
    } catch (err) {
      toast.error(err.message || "办理出院失败");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.nic?.toLowerCase().includes(q) ||
        p.dischargeType?.toLowerCase().includes(q)
    );
  }, [history, searchQuery]);

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <FormCard title="办理出院">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>患者证件号（NIC，仅限在院）</label>
              <Select
                options={nicOptions}
                value={selectedNIC}
                onChange={handleNICChange}
                placeholder="搜索在院患者证件号…"
                isSearchable
                styles={customSelectStyles}
              />
            </div>

            <Field
              label="患者姓名"
              value={form.patientName}
              readOnly
              placeholder="根据证件号自动带出"
            />

            <Field
              label="出院日期"
              type="date"
              value={form.dischargeDate}
              onChange={(e) => handleChange("dischargeDate", e.target.value)}
            />

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>出院方式</label>
              <Select
                options={DISCHARGE_TYPES}
                value={DISCHARGE_TYPES.find(o => o.value === form.dischargeType)}
                onChange={(opt) => handleChange("dischargeType", opt ? opt.value : "")}
                placeholder="请选择类型"
                styles={customSelectStyles}
              />
            </div>
          </div>

          <Field
            label="出院小结"
            value={form.summary}
            onChange={(e) => handleChange("summary", e.target.value)}
            placeholder="请填写出院诊断与医嘱要点…"
          />

          <div style={buttonContainerStyle}>
            <button 
              type="submit" 
              disabled={isLoading}
              style={{...submitBtnStyle, opacity: isLoading ? 0.7 : 1}}
            >
              {isLoading ? "处理中…" : "确认出院"}
            </button>
          </div>
        </FormCard>
      </form>

      <div style={{ marginTop: 30 }}>
        <div style={tableCardStyle}>
          <div style={tableHeaderStyle}>
            <h2 style={{ margin: 0, fontSize: 20, color: "#1e3a8a" }}>出院记录</h2>
            <input
              type="text"
              placeholder="搜索出院记录…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchStyle}
            />
          </div>

          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px" }}>
            <thead>
              <tr style={{ background: "#1e40af", color: "#fff" }}>
                <th style={{ padding: 12, textAlign: "left", borderRadius: "8px 0 0 8px" }}>患者姓名</th>
                <th style={{ textAlign: "left" }}>证件号（NIC）</th>
                <th style={{ textAlign: "left" }}>出院日期</th>
                <th style={{ textAlign: "left" }}>出院方式</th>
                <th style={{ textAlign: "left", borderRadius: "0 8px 8px 0" }}>小结</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((p, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                  <td style={{ padding: "12px", fontWeight: "500" }}>{p.name}</td>
                  <td>{p.nic}</td>
                  <td>{p.dischargeDate}</td>
                  <td>
                    <span style={getTypeBadgeStyle(p.dischargeType)}>{p.dischargeType}</span>
                  </td>
                  <td style={{ fontSize: "13px", color: "#6b7280", maxWidth: "250px" }}>{p.summary}</td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
                    暂无出院记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Unified Styles from AdmitPatientPage
const labelStyle = { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" };

const customSelectStyles = {
  control: (base) => ({
    ...base,
    borderRadius: 8,
    borderColor: "#e5e7eb",
    padding: "2px",
    fontSize: "14px",
    boxShadow: "none",
    "&:hover": { borderColor: "#2563eb" }
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    backgroundColor: state.isSelected ? "#2563eb" : state.isFocused ? "#eff6ff" : "#fff",
    color: state.isSelected ? "#fff" : "#374151"
  })
};

const tableCardStyle = { background: "#fff", borderRadius: 14, padding: "32px 36px", boxShadow: "0 2px 16px rgba(0,0,0,.07)" };
const tableHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #dbeafe", paddingBottom: 14, marginBottom: 24 };
const searchStyle = { width: 300, padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: "14px" };
const buttonContainerStyle = { display: "flex", gap: "12px", marginTop: "16px", alignItems: "center" };
const submitBtnStyle = { padding: "10px 20px", background: "linear-gradient(135deg,#2563eb,#1e40af)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 10px rgba(37,99,235,0.3)" };

const getTypeBadgeStyle = (type) => {
  const base = { padding: "4px 10px", borderRadius: 6, fontSize: "12px", fontWeight: 600 };
  if (type === "Expired") return { ...base, background: "#fee2e2", color: "#b91c1c" };
  if (type === "AOR") return { ...base, background: "#fef3c7", color: "#92400e" };
  return { ...base, background: "#dcfce7", color: "#15803d" };
};

export default DischargePatientPage;