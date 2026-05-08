import React, { useCallback, useState, useMemo, useEffect } from "react";
import Select from "react-select"; // Added trendy select
import { Field, FormCard } from "../components/UI";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { doctorService } from "../services/doctorService";
import { wardService } from "../services/wardService";
import { auditLogService } from "../services/auditLogService";
import { toast } from "react-toastify";
import {
  SPECIALISATION_OPTIONS,
  MEDICAL_TEAM_OPTIONS as TEAM_OPTIONS,
  zhSpecialisation,
  zhMedicalTeam,
} from "../utils/backendDisplayZh";

const initialForm = {
  name: "",
  specialisation: "",
  ward: "",
  team: "", 
  mobile: "",
};

const LOG_PAGE_SIZE = 8;

const ManageDoctorsPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [wards, setWards] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [originalMobile, setOriginalMobile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logPage, setLogPage] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(0);
  const [logTotalElements, setLogTotalElements] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    loadDoctors();
    loadWards();
  }, []);

  const loadAuditLogs = useCallback(async (targetPage = 0) => {
    setLoadingLogs(true);
    try {
      const data = await auditLogService.page({ page: targetPage, size: LOG_PAGE_SIZE });
      setAuditLogs(Array.isArray(data?.content) ? data.content : []);
      setLogPage(Number(data?.page ?? 0));
      setLogTotalPages(Number(data?.totalPages ?? 0));
      setLogTotalElements(Number(data?.totalElements ?? 0));
    } catch (err) {
      toast.error(err.message || "加载审计日志失败");
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs(0);
  }, [loadAuditLogs]);

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
      loadAuditLogs(0);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = (mobile) => {
    const confirmDelete = async () => {
      try {
        await doctorService.delete(mobile);
        loadDoctors();
        loadAuditLogs(0);
        toast.success("医生记录已删除！");
      } catch (err) {
        toast.error(err.message);
      }
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

  const formatAuditTime = (value) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "—";
    }
  };

  return (
    <div style={pageLayoutStyle}>
      <div style={{ minWidth: 0 }}>
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
                  value={SPECIALISATION_OPTIONS.find((o) => o.value === form.specialisation)}
                  onChange={(opt) => handleChange("specialisation", opt ? opt.value : "")}
                  placeholder="请选择专科"
                  styles={customSelectStyles}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>所属病区</label>
                <Select
                  options={wardOptions}
                  value={wardOptions.find((o) => o.value === form.ward)}
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
                  value={TEAM_OPTIONS.find((o) => o.value === form.team)}
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
                    <td>{zhSpecialisation(d.specialisation)}</td>
                    <td>{d.ward}</td>
                    <td>{zhMedicalTeam(d.team)}</td>
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

      <aside style={auditSidebarStyle}>
        <div style={auditHeaderStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>操作日志</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
              仅可查看，不可编辑或删除
            </p>
          </div>
          <button type="button" style={refreshBtnStyle} onClick={() => loadAuditLogs(logPage)} disabled={loadingLogs}>
            刷新
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
          共 {logTotalElements} 条
        </div>

        {loadingLogs ? (
          <div style={auditEmptyStyle}>日志加载中…</div>
        ) : auditLogs.length === 0 ? (
          <div style={auditEmptyStyle}>暂无日志</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {auditLogs.map((log) => (
              <div key={log.id} style={auditItemStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{log.action || "系统操作"}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: log.success ? "#166534" : "#b91c1c",
                      background: log.success ? "#dcfce7" : "#fee2e2",
                      borderRadius: 999,
                      padding: "2px 8px",
                      flexShrink: 0,
                    }}
                  >
                    {log.success ? "成功" : "失败"}
                  </span>
                </div>
                <div style={auditMetaStyle}>
                  <span>{log.httpMethod || "—"}</span>
                  <span>{log.username || "未知用户"}</span>
                  <span>{formatAuditTime(log.createdAt)}</span>
                </div>
                <div style={auditMetaStyle}>
                  <span>{log.module || "—"}</span>
                  <span title={log.requestUri || ""}>{log.requestUri || "—"}</span>
                </div>
                {!log.success && log.errorMessage ? (
                  <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>
                    {log.errorMessage}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div style={auditPaginationStyle}>
          <button
            type="button"
            style={paginationBtnStyle}
            onClick={() => loadAuditLogs(Math.max(logPage - 1, 0))}
            disabled={loadingLogs || logPage <= 0}
          >
            上一页
          </button>
          <span style={{ fontSize: 12, color: "#475569" }}>
            第 {logTotalPages === 0 ? 0 : logPage + 1} / {logTotalPages} 页
          </span>
          <button
            type="button"
            style={paginationBtnStyle}
            onClick={() => loadAuditLogs(logPage + 1)}
            disabled={loadingLogs || logTotalPages === 0 || logPage >= logTotalPages - 1}
          >
            下一页
          </button>
        </div>
      </aside>
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

const pageLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 360px",
  gap: 20,
  alignItems: "start",
};
const tableCardStyle = { background: "#fff", borderRadius: 14, padding: "32px 36px", boxShadow: "0 2px 16px rgba(0,0,0,.07)" };
const tableHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #dbeafe", paddingBottom: 14, marginBottom: 24 };
const searchStyle = { width: 300, padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8 };
const buttonContainerStyle = { display: "flex", gap: "12px", marginTop: "16px", alignItems: "center" };
const submitBtnStyle = { padding: "10px 20px", background: "linear-gradient(135deg,#2563eb,#1e40af)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 10px rgba(37,99,235,0.3)" };
const cancelBtnStyle = { padding: "8px 20px", background: "#fff", color: "#ef4444", border: "2px solid #ef4444", borderRadius: "10px", fontWeight: "600", cursor: "pointer" };
const confirmBtnStyle = { padding: "6px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const cancelActionBtnStyle = { padding: "6px 12px", background: "#fff", color: "#ef4444", border: "2px solid #ef4444", borderRadius: 6, cursor: "pointer" };
const auditSidebarStyle = {
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 2px 16px rgba(0,0,0,.07)",
  padding: "16px 14px",
  position: "sticky",
  top: 20,
  maxHeight: "calc(100vh - 180px)",
  overflowY: "auto",
};
const auditHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};
const refreshBtnStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#f8fafc",
  color: "#334155",
  fontSize: 12,
  padding: "6px 10px",
  cursor: "pointer",
};
const auditEmptyStyle = {
  color: "#64748b",
  fontSize: 13,
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: "16px 12px",
  textAlign: "center",
};
const auditItemStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "10px 10px 9px",
  background: "#f8fafc",
};
const auditMetaStyle = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  gap: 8,
  fontSize: 11.5,
  color: "#475569",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const auditPaginationStyle = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};
const paginationBtnStyle = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 12,
  cursor: "pointer",
};

export default ManageDoctorsPage;