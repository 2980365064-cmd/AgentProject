import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import { Field, FormCard } from "../components/UI";
import { patientService } from "../services/patientService";
import { wardService } from "../services/wardService"; 
import { toast } from "react-toastify";
import { FiTrendingUp } from "react-icons/fi"; 

const EMPTY_FORM = {
  patientName: "",
  currentWard: "",
  transferWard: "",
  transferDate: new Date().toISOString().split('T')[0],
  doctor: "",
  reason: "",
};

const TransferPatientPage = () => {
  const [patients, setPatients] = useState([]);
  const [wards, setWards] = useState([]); 
  const [selectedNIC, setSelectedNIC] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [pData, wData] = await Promise.all([
        patientService.getAll(),
        wardService.getAll()
      ]);
      setPatients(pData);
      setWards(wData);
    } catch (error) {
      toast.error("加载服务器数据失败");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const nicOptions = useMemo(() => 
    patients.map((p) => ({ value: p.nic, label: `${p.nic} - ${p.name}`, data: p })), 
  [patients]);

  // --- NEW: Ward options formatted for react-select ---
  const wardOptions = useMemo(() => 
    wards.map((w) => ({ value: w.name, label: w.name })), 
  [wards]);

  const handleNICChange = (selectedOption) => {
    setSelectedNIC(selectedOption);
    if (selectedOption) {
      const p = selectedOption.data;
      setForm({
        ...form,
        patientName: p.name,
        currentWard: p.ward,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  };

  const handleChange = (field, value) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!selectedNIC || !form.transferWard) {
      toast.warning("请选择患者与目标病区。");
      return;
    }

    if (form.currentWard === form.transferWard) {
      toast.error("患者已在该病区，无需转科。");
      return;
    }

    setLoading(true);
    try {
      const updatedData = {
        ...selectedNIC.data,
        ward: form.transferWard,
        description: `上次转科：${form.currentWard} -> ${form.transferWard} | 原因：${form.reason}`,
        date: form.transferDate 
      };

      await patientService.update(selectedNIC.value, updatedData);
      
      toast.success("转科记录已保存！");
      setForm(EMPTY_FORM);
      setSelectedNIC(null);
      fetchData(); 
    } catch (error) {
      toast.error(error.message || "转科失败");
    } finally {
      setLoading(false);
    }
  };

  const transferredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const historyOnly = patients.filter(p => p.description?.includes("->"));

    if (!q) return historyOnly;
    return historyOnly.filter(
      (p) =>
        p.nic?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

  return (
    <div>
      <FormCard title="患者转科">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column" }}>
            <label style={labelStyle}>按证件号（NIC）查找患者</label>
            <Select
              options={nicOptions}
              value={selectedNIC}
              onChange={handleNICChange}
              placeholder="请选择患者…"
              isSearchable
              styles={customSelectStyles}
            />
          </div>
          <Field label="患者姓名" value={form.patientName} readOnly />
          
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>当前病区</label>
            <input value={form.currentWard || "无"} readOnly style={{ ...inputStyle, background: "#f3f4f6" }} />
          </div>

          {/* --- UPDATED: Transfer to Ward now uses Select --- */}
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column" }}>
            <label style={labelStyle}>转至病区</label>
            <Select
              options={wardOptions}
              value={wardOptions.find(opt => opt.value === form.transferWard) || null}
              onChange={(selected) => handleChange("transferWard", selected ? selected.value : "")}
              placeholder="请选择目标病区"
              isSearchable
              styles={customSelectStyles}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          <Field label="转科日期" type="date" value={form.transferDate} onChange={(e) => handleChange("transferDate", e.target.value)} />
          <Field label="转科原因" placeholder="请填写转科原因…" value={form.reason} onChange={(e) => handleChange("reason", e.target.value)} />
        </div>
        
        <div style={{ marginTop: 10 }}>
          <button onClick={handleSubmit} disabled={loading} style={submitBtnStyle}>
            {loading ? "处理中…" : "确认转科"}
          </button>
        </div>
      </FormCard>

      <div style={{ marginTop: 30 }}>
        <div style={tableCardStyle}>
          <div style={tableHeaderStyle}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, color: "#1e3a8a" }}>转科历史</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                转科记录数：{transferredPatients.length}
              </p>
            </div>
            <input
              placeholder="搜索历史记录…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchStyle}
            />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1e40af", color: "#fff", textAlign: "left" }}>
                <th style={thStyle}>证件号（NIC）</th>
                <th style={thStyle}>患者姓名</th>
                <th style={thStyle}>转科路径</th>
                <th style={thStyle}>当前病区</th>
              </tr>
            </thead>
            <tbody>
              {transferredPatients.length > 0 ? (
                transferredPatients.map((p, idx) => {
                  const historyPart = p.description.split('|')[0]
                    .replace(/^Last Transfer:\s*/, '')
                    .replace(/^上次转科：\s*/, '');
                  
                  return (
                    <tr key={p.nic} style={{ borderBottom: "1px solid #e5e7eb", background: idx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      <td style={tdStyle}>{p.nic}</td>
                      <td style={tdStyle}><strong>{p.name}</strong></td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#4b5563" }}>
                          <FiTrendingUp color="#10b981" />
                          <span>{historyPart}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={wardBadgeStyle}>{p.ward}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    暂无转科记录。请使用上方表单办理转科。
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

const labelStyle = { fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block", color: "#374151" };
const inputStyle = { width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 };
const thStyle = { padding: "14px 12px", fontWeight: 600 };
const tdStyle = { padding: "14px 12px", fontSize: 14 };
const wardBadgeStyle = { background: "#dbeafe", color: "#1e40af", padding: "4px 10px", borderRadius: 6, fontWeight: 600, fontSize: 12 };
const tableCardStyle = { background: "#fff", borderRadius: 14, padding: "32px 36px", boxShadow: "0 2px 16px rgba(0,0,0,.07)" };
const tableHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #dbeafe", paddingBottom: 14, marginBottom: 24 };
const searchStyle = { width: 300, padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8 };
const submitBtnStyle = { padding: "12px 28px", background: "linear-gradient(135deg,#2563eb,#1e40af)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 10px rgba(37,99,235,0.3)" };
const customSelectStyles = { 
  control: (base) => ({ 
    ...base, 
    borderRadius: 8, 
    borderColor: "#e5e7eb",
    minHeight: "40px",
    boxShadow: "none"
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    backgroundColor: state.isSelected ? "#2563eb" : state.isFocused ? "#eff6ff" : "#fff",
    color: state.isSelected ? "#fff" : "#374151"
  }) 
};

export default TransferPatientPage;