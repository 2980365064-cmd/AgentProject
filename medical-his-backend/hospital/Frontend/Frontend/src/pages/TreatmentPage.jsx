import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select"; // Added trendy select
import { Field, FormCard } from "../components/UI";
import { FiEdit, FiTrash2, FiUser } from "react-icons/fi";
import { treatmentService } from "../services/treatmentService";
import { patientService } from "../services/patientService";
import { toast } from "react-toastify";
import { doctorService } from "../services/doctorService";

const initialForm = {
  nic: "",
  patientName: "",
  doctor: "",
  treatmentDate: new Date().toISOString().split("T")[0],
  nextReview: "",
  medications: "",
  notes: "",
};

const TreatmentPage = () => {
  const [patients, setPatients] = useState([]);
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [doctors, setDoctors] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    loadPatients();
    loadTreatments();
    loadDoctors();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await patientService.getAll();
      setPatients(data);
    } catch (err) {
      toast.error("加载患者列表失败");
    }
  };

  const loadTreatments = async () => {
    try {
      const data = await treatmentService.getAll();
      setHistory(data);
    } catch (err) {
      toast.error("加载诊疗记录失败");
    }
  };

  const loadDoctors = async () => {
    try {
      const data = await doctorService.getAll();
      setDoctors(data);
    } catch (err) {
      toast.error("从数据库加载医生列表失败");
    }
  };

  // Memoized options for react-select
  const nicOptions = useMemo(() => 
    patients.map((p) => ({ 
      value: p.nic, 
      label: `${p.nic} - ${p.name}`,
      data: p 
    })),
  [patients]);

  const doctorOptions = useMemo(() => 
    doctors.map((doc) => ({ value: doc.name, label: doc.name })),
  [doctors]);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  // 当选择患者时，自动填充患者姓名
  const handlePatientChange = (selectedOption) => {
    setSelectedPatient(selectedOption);
    if (selectedOption) {
      setForm({ 
        ...form, 
        nic: selectedOption.value,
        patientName: selectedOption.data.name 
      });
    } else {
      setForm({ 
        ...form, 
        nic: "",
        patientName: "" 
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.nic || !form.doctor || !form.treatmentDate) {
      toast.warning("请填写证件号（NIC）、医生与诊疗日期。");
      return;
    }

    try {
      const treatmentData = {
        ...form,
        patientName: form.patientName || (selectedPatient?.data?.name)
      };

      if (isEditing) {
        await treatmentService.update(currentId, treatmentData);
        toast.success("诊疗记录已更新！");
      } else {
        await treatmentService.create(treatmentData);
        toast.success("诊疗记录已保存！");
      }
      resetForm();
      loadTreatments();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = (id) => {
    const confirmDelete = () => {
      treatmentService
        .delete(id)
        .then(() => {
          loadTreatments();
          toast.success("记录已删除！");
        })
        .catch((err) => toast.error(err.message));
    };

    toast.info(
      <div style={{ minWidth: 150, padding: "5px" }}>
        <p>确定删除该条诊疗记录？</p>
        <div style={{ display: "flex", gap: "10px", marginTop: 8 }}>
          <button
            style={confirmBtnStyle}
            onClick={() => {
              confirmDelete();
              toast.dismiss();
            }}
          >
            确定
          </button>
          <button style={cancelToastBtnStyle} onClick={() => toast.dismiss()}>
            取消
          </button>
        </div>
      </div>,
      { autoClose: false, closeOnClick: false }
    );
  };

  const startEdit = (record) => {
    setForm(record);
    setCurrentId(record.id);
    setIsEditing(true);
    
    // 如果是编辑模式，尝试找到对应的患者
    const patient = patients.find(p => p.nic === record.nic);
    if (patient) {
      setSelectedPatient({
        value: patient.nic,
        label: `${patient.nic} - ${patient.name}`,
        data: patient
      });
    }
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setForm(initialForm);
    setIsEditing(false);
    setCurrentId(null);
    setSelectedPatient(null);
  };

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter(
      (h) =>
        h.nic?.toLowerCase().includes(q) ||
        h.patientName?.toLowerCase().includes(q) ||
        h.doctor?.toLowerCase().includes(q) ||
        h.medications?.toLowerCase().includes(q)
    );
  }, [history, searchQuery]);

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <FormCard
          title={isEditing ? "修改诊疗记录" : "新建诊疗记录"}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 24px",
            }}
          >
            {/* Patient Selection with NIC Binding */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>
                <FiUser style={{ verticalAlign: "middle", marginRight: "4px" }} />
                患者证件号（NIC）<span style={{ color: "#ef4444" }}>*</span>
              </label>
              <Select
                options={nicOptions}
                value={selectedPatient}
                onChange={handlePatientChange}
                placeholder="搜索并选择患者..."
                isDisabled={isEditing}
                styles={customSelectStyles}
                isSearchable
                isClearable
                noOptionsMessage={() => "未找到匹配的患者"}
              />
              {form.nic && (
                <div style={{ 
                  marginTop: "8px", 
                  padding: "8px 12px", 
                  background: "#eff6ff", 
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "#1e40af"
                }}>
                  <strong>已绑定：</strong>{form.nic} - {form.patientName || "未知"}
                </div>
              )}
            </div>

            {/* Doctor Selection using Trendy Select */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>主治医生 <span style={{ color: "#ef4444" }}>*</span></label>
              <Select
                options={doctorOptions}
                value={doctorOptions.find(o => o.value === form.doctor)}
                onChange={(opt) => handleChange("doctor", opt ? opt.value : "")}
                placeholder="请选择医生"
                styles={customSelectStyles}
                isSearchable
              />
            </div>

            <Field
              label="诊疗日期"
              type="date"
              value={form.treatmentDate}
              onChange={(e) => handleChange("treatmentDate", e.target.value)}
            />

            <Field
              label="下次复诊日期"
              type="date"
              value={form.nextReview}
              onChange={(e) => handleChange("nextReview", e.target.value)}
            />
          </div>

          <Field
            label="用药情况"
            placeholder="药品、剂量与频次…"
            value={form.medications}
            onChange={(e) => handleChange("medications", e.target.value)}
          />

          <Field
            label="病程记录 / 备注"
            placeholder="请输入观察与处理意见…"
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
          />

          <div style={buttonContainerStyle}>
            {isEditing && (
              <button type="button" onClick={resetForm} style={cancelBtnStyle}>
                取消编辑
              </button>
            )}
            <button type="submit" style={submitBtnStyle}>
              {isEditing ? "保存修改" : "保存诊疗记录"}
            </button>
          </div>
        </FormCard>
      </form>

      <div style={{ marginTop: 30 }}>
        <div style={tableCardStyle}>
          <div style={tableHeaderStyle}>
            <h2 style={{ margin: 0, fontSize: 20, color: "#1e3a8a" }}>
              诊疗历史
            </h2>
            <input
              type="text"
              placeholder="搜索诊疗记录…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchStyle}
            />
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0 12px",
            }}
          >
            <thead>
              <tr style={{ background: "#1e40af", color: "#fff" }}>
                <th style={{ padding: 10 }}>证件号（NIC）</th>
                <th>患者姓名</th>
                <th>医生</th>
                <th>日期</th>
                <th>用药</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((h, index) => (
                <tr
                  key={h.id || index}
                  style={{
                    background: index % 2 === 0 ? "#f9fafb" : "#fff",
                    textAlign: "center",
                  }}
                >
                  <td style={{ padding: 10 }}>
                    <span style={{ 
                      background: "#dbeafe", 
                      color: "#1e40af",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontWeight: "600",
                      fontSize: "13px"
                    }}>
                      {h.nic}
                    </span>
                  </td>
                  <td style={{ fontWeight: "500" }}>{h.patientName || "—"}</td>
                  <td>{h.doctor}</td>
                  <td>{h.treatmentDate}</td>
                  <td
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.medications}
                  </td>
                  <td
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 12,
                      padding: 10,
                    }}
                  >
                    <FiEdit
                      size={20}
                      color="#f59e0b"
                      style={{ cursor: "pointer" }}
                      onClick={() => startEdit(h)}
                    />
                    <FiTrash2
                      size={20}
                      color="#ef4444"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleDelete(h.id)}
                    />
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
                    暂无诊疗记录。
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

// --- Updated Trendy Styles ---

const labelStyle = {
  fontSize: 13,
  fontWeight: 600,
  display: "block",
  marginBottom: 6,
  color: "#374151"
};

const customSelectStyles = { 
  control: (base, state) => ({ 
    ...base, 
    borderRadius: 8, 
    borderColor: state.isFocused ? "#2563eb" : "#e5e7eb",
    minHeight: "40px",
    boxShadow: state.isFocused ? "0 0 0 1px #2563eb" : "none",
    "&:hover": { borderColor: "#2563eb" }
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected 
      ? "#2563eb" 
      : state.isFocused 
        ? "#eff6ff" 
        : "#fff",
    color: state.isSelected ? "#fff" : "#374151",
    "&:active": {
      backgroundColor: "#dbeafe"
    }
  })
};

const tableCardStyle = {
  background: "#fff",
  borderRadius: 14,
  padding: "32px 36px",
  boxShadow: "0 2px 16px rgba(0,0,0,.07)",
};
const tableHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "2px solid #dbeafe",
  paddingBottom: 14,
  marginBottom: 24,
};
const searchStyle = {
  width: 300,
  padding: "8px 12px",
  border: "1.5px solid #e5e7eb",
  borderRadius: 8,
};
const buttonContainerStyle = {
  display: "flex",
  gap: "12px",
  marginTop: "16px",
  alignItems: "center",
};
const submitBtnStyle = {
  padding: "10px 20px",
  background: "linear-gradient(135deg,#2563eb,#1e40af)",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(37,99,235,0.3)",
};
const cancelBtnStyle = {
  padding: "8px 20px",
  background: "#fff",
  color: "#ef4444",
  border: "2px solid #ef4444",
  borderRadius: "10px",
  fontWeight: "600",
  cursor: "pointer",
};
const confirmBtnStyle = {
  padding: "6px 12px",
  background: "#ef4444",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};
const cancelToastBtnStyle = {
  padding: "6px 12px",
  background: "#fff",
  color: "#ef4444",
  border: "2px solid #ef4444",
  borderRadius: 6,
  cursor: "pointer",
};

export default TreatmentPage;