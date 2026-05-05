import React, { useState, useMemo, useEffect } from "react";
import Select from "react-select"; // Added trendy select
import { Field, FormCard } from "../components/UI";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { doctorService } from "../services/doctorService";
import { wardService } from "../services/wardService";
import { toast } from "react-toastify";

// Hardcoded Specialisation Options formatted for Select
const SPECIALISATION_OPTIONS = [
  { value: "Cardiology", label: "心血管内科" },
  { value: "Neurology", label: "神经内科" },
  { value: "Orthopaedics", label: "骨科" },
  { value: "General Surgery", label: "普通外科" },
  { value: "Pediatrics", label: "儿科" },
  { value: "Internal Medicine", label: "内科" }
];

// Hardcoded Team Options formatted for Select
const TEAM_OPTIONS = [
  { value: "Medical Team A", label: "内科医疗组 A" },
  { value: "Surgical Team B", label: "外科医疗组 B" },
  { value: "Emergency Response Team", label: "急诊抢救组" },
  { value: "Pediatric Specialists", label: "儿科专家组" },
  { value: "Cardiology Unit", label: "心内科单元" }
];

const initialForm = {
  name: "",
  specialisation: "",
  ward: "",
  team: "", 
  mobile: "",
};

const ManageDoctorsPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [wards, setWards] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [originalMobile, setOriginalMobile] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    loadDoctors();
    loadWards();
  }, []);

  const loadDoctors = async () => {
    try {
      const data = await doctorService.getAll();
      setDoctors(data);
    } catch (err) {
      console.error(err.message);
    }
  };

  const loadWards = async () => {
    try {
      const data = await wardService.getAll();
      setWards(data);
    } catch (err) {
      toast.error("从数据库加载病区失败");
    }
  };

  // Memoized ward options for react-select
  const wardOptions = useMemo(() => 
    wards.map((w) => ({ value: w.name, label: w.name })),
  [wards]);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.mobile || !form.specialisation) {
      toast.error("请填写姓名、专科与手机号。");
      return;
    }

    try {
      if (isEditing) {
        await doctorService.update(originalMobile, form);
        toast.success("医生信息已更新！");
      } else {
        await doctorService.create(form);
        toast.success("医生已添加！");
      }
      resetForm();
      loadDoctors();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = (mobile) => {
    const confirmDelete = () => {
      doctorService.delete(mobile)
        .then(() => {
          loadDoctors();
          toast.success("医生记录已删除！");
        })
        .catch((err) => toast.error(err.message));
    };

    toast.info(
      <div style={{ minWidth: 150, padding: "5px" }}>
        <p>确定要删除该医生吗？</p>
        <div style={{ display: "flex", gap: "10px", marginTop: 8 }}>
          <button style={confirmBtnStyle} onClick={() => { confirmDelete(); toast.dismiss(); }}>确定</button>
          <button style={cancelActionBtnStyle} onClick={() => toast.dismiss()}>取消</button>
        </div>
      </div>,
      { autoClose: false, closeOnClick: false }
    );
  };

  const startEdit = (doctor) => {
    setForm({ ...doctor });
    setOriginalMobile(doctor.mobile);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setForm(initialForm);
    setIsEditing(false);
    setOriginalMobile(null);
  };

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return doctors.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.mobile?.toLowerCase().includes(q) ||
        d.team?.toLowerCase().includes(q) ||
        d.specialisation?.toLowerCase().includes(q)
    );
  }, [doctors, searchQuery]);

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <FormCard title={isEditing ? "修改医生信息" : "新增医生"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            <Field
              label="医生姓名"
              placeholder="例如：张医生"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />

            <Field
              label="手机号码"
              placeholder="请输入手机号"
              value={form.mobile}
              onChange={(e) => handleChange("mobile", e.target.value)}
            />

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>专科</label>
              <Select
                options={SPECIALISATION_OPTIONS}
                value={SPECIALISATION_OPTIONS.find(o => o.value === form.specialisation)}
                onChange={(opt) => handleChange("specialisation", opt ? opt.value : "")}
                placeholder="请选择专科"
                styles={customSelectStyles}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>所属病区</label>
              <Select
                options={wardOptions}
                value={wardOptions.find(o => o.value === form.ward)}
                onChange={(opt) => handleChange("ward", opt ? opt.value : "")}
                placeholder="请选择病区"
                styles={customSelectStyles}
                isSearchable
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>所属医疗组</label>
              <Select
                options={TEAM_OPTIONS}
                value={TEAM_OPTIONS.find(o => o.value === form.team)}
                onChange={(opt) => handleChange("team", opt ? opt.value : "")}
                placeholder="请选择医疗组"
                styles={customSelectStyles}
              />
            </div>
          </div>

          <div style={buttonContainerStyle}>
            {isEditing && (
              <button type="button" onClick={resetForm} style={cancelBtnStyle}>
                取消编辑
              </button>
            )}
            <button type="submit" style={submitBtnStyle}>
              {isEditing ? "保存修改" : "添加医生"}
            </button>
          </div>
        </FormCard>
      </form>

      <div style={{ marginTop: 30 }}>
        <div style={tableCardStyle}>
          <div style={tableHeaderStyle}>
            <h2 style={{ margin: 0, fontSize: 20, color: "#1e3a8a" }}>医生名册</h2>
            <input
              type="text"
              placeholder="按姓名、医疗组或手机号搜索…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchStyle}
            />
          </div>

          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px" }}>
            <thead>
              <tr style={{ background: "#1e40af", color: "#fff" }}>
                <th style={{ padding: 10 }}>姓名</th>
                <th>专科</th>
                <th>病区</th>
                <th>医疗组</th>
                <th>手机</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.map((d, index) => (
                <tr key={d.mobile} style={{ background: index % 2 === 0 ? "#f9fafb" : "#fff", textAlign: "center" }}>
                  <td style={{ padding: 10 }}>{d.name}</td>
                  <td>{d.specialisation}</td>
                  <td>{d.ward}</td>
                  <td>{d.team}</td>
                  <td>{d.mobile}</td>
                  <td style={{ display: "flex", justifyContent: "center", gap: 12, padding: 10 }}>
                    <FiEdit size={20} color="#f59e0b" style={{ cursor: "pointer" }} onClick={() => startEdit(d)} />
                    <FiTrash2 size={20} color="#ef4444" style={{ cursor: "pointer" }} onClick={() => handleDelete(d.mobile)} />
                  </td>
                </tr>
              ))}
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
  marginBottom: 6, 
  display: "block", 
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

const tableCardStyle = { background: "#fff", borderRadius: 14, padding: "32px 36px", boxShadow: "0 2px 16px rgba(0,0,0,.07)" };
const tableHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #dbeafe", paddingBottom: 14, marginBottom: 24 };
const searchStyle = { width: 300, padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8 };
const buttonContainerStyle = { display: "flex", gap: "12px", marginTop: "16px", alignItems: "center" };
const submitBtnStyle = { padding: "10px 20px", background: "linear-gradient(135deg,#2563eb,#1e40af)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 10px rgba(37,99,235,0.3)" };
const cancelBtnStyle = { padding: "8px 20px", background: "#fff", color: "#ef4444", border: "2px solid #ef4444", borderRadius: "10px", fontWeight: "600", cursor: "pointer" };
const confirmBtnStyle = { padding: "6px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const cancelActionBtnStyle = { padding: "6px 12px", background: "#fff", color: "#ef4444", border: "2px solid #ef4444", borderRadius: 6, cursor: "pointer" };

export default ManageDoctorsPage;