import React, { useCallback, useState, useEffect, useMemo } from "react";
import Select from "react-select"; // Added trendy select
import { Field, FormCard } from "../components/UI";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { wardService } from "../services/wardService";
import { auditLogService } from "../services/auditLogService";
import { toast } from "react-toastify";
import {
  WARD_TYPE_OPTIONS,
  WARD_FLOOR_OPTIONS,
  zhWardType,
  zhWardFloor,
} from "../utils/backendDisplayZh";

const initialForm = {
  id: null,
  name: "",
  type: "",
  capacity: "",
  occupied: "0",
  floor: "",
};

const LOG_PAGE_SIZE = 8;

const ManageWardsPage = () => {
  const [wards, setWards] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logPage, setLogPage] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(0);
  const [logTotalElements, setLogTotalElements] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadWards = useCallback(async () => {
    try {
      const data = await wardService.getAll();
      setWards(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || "加载病区列表失败");
    }
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
    loadWards();
    loadAuditLogs(0);
  }, [loadWards, loadAuditLogs]);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    if (!form.name || !form.capacity || !form.type || !form.floor) {
      toast.error("请填写所有必填项。");
      return;
    }
  
    try {
      if (isEditing) {
        await wardService.update(form.id, form);
        toast.success("病区信息已更新！");
      } else {
        await wardService.create(form);
        toast.success("病区已保存！");
      }
      resetForm();
      loadWards();
      loadAuditLogs(0);
    } catch (err) {
      toast.error(err.message || "保存病区失败。");
    }
  };

  const handleDelete = (id) => {
    const confirmDelete = () => {
      wardService.delete(id)
        .then(() => {
          loadWards();
          loadAuditLogs(0);
          resetForm();
          toast.success("病区已删除！");
        })
        .catch((err) => toast.error(err.message));
    };
  
    toast.info(
      <div style={{ minWidth: 150, padding: "5px" }}>
        <p>确定要删除该病区吗？</p>
        <div style={{ display: "flex", gap: "10px", marginTop: 8 }}>
          <button
            style={{
              padding: "6px 12px",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer"
            }}
            onClick={() => { confirmDelete(); toast.dismiss(); }}
          >
            确定
          </button>
          <button
            style={{
              padding: "6px 12px",
              background: "#fff",
              color: "#ef4444",
              border: "2px solid #ef4444",
              borderRadius: 6,
              cursor: "pointer"
            }}
            onClick={() => toast.dismiss()}
          >
            取消
          </button>
        </div>
      </div>,
      { autoClose: false, closeOnClick: false }
    );
  };

  const startEdit = (ward) => {
    setForm({ ...ward });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setForm(initialForm);
    setIsEditing(false);
  };

  const filteredWards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return wards.filter(
      (w) =>
        w.name?.toLowerCase().includes(q) ||
        w.type?.toLowerCase().includes(q) ||
        w.floor?.toLowerCase().includes(q)
    );
  }, [wards, searchQuery]);

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
      <div style={{ minWidth: 0, padding: "20px" }}>
        <form onSubmit={handleSubmit}>
          <FormCard title={isEditing ? "修改病区信息" : "新增病区"}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0 24px",
              }}
            >
              <Field
                label="病区名称"
                placeholder="例如：内科一病区"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />

              <Field
                label="核定床位数"
                type="number"
                placeholder="20"
                value={form.capacity}
                onChange={(e) => handleChange("capacity", e.target.value)}
              />

              {/* Ward Type Selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>病区类型</label>
                <Select
                  options={WARD_TYPE_OPTIONS}
                  value={WARD_TYPE_OPTIONS.find((o) => o.value === form.type)}
                  onChange={(opt) => handleChange("type", opt ? opt.value : "")}
                  placeholder="请选择类型"
                  styles={customSelectStyles}
                />
              </div>

              {/* Floor Selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>所在楼层</label>
                <Select
                  options={WARD_FLOOR_OPTIONS}
                  value={WARD_FLOOR_OPTIONS.find((o) => o.value === form.floor)}
                  onChange={(opt) => handleChange("floor", opt ? opt.value : "")}
                  placeholder="请选择楼层"
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
                {isEditing ? "保存修改" : "新增病区"}
              </button>
            </div>
          </FormCard>
        </form>

        {/* Table Section */}
        <div style={{ marginTop: 30 }}>
          <div style={tableCardStyle}>
            <div style={tableHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: 20, color: "#1e3a8a" }}>
                病区列表
              </h2>

              <input
                type="text"
                placeholder="搜索…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={searchStyle}
              />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: "0 12px",
                }}
              >
                <thead>
                  <tr style={{ background: "#1e40af", color: "#fff" }}>
                    <th style={{ padding: 12 }}>编号</th>
                    <th>病区名称</th>
                    <th>类型</th>
                    <th>床位数</th>
                    <th>已占用</th>
                    <th>楼层</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWards.map((w, index) => (
                    <tr
                      key={w.id}
                      style={{
                        background: index % 2 === 0 ? "#f9fafb" : "#fff",
                        textAlign: "center",
                        fontSize: "14px",
                      }}
                    >
                      <td style={{ padding: 10, fontWeight: "bold" }}>{w.id}</td>
                      <td>{w.name}</td>
                      <td>{zhWardType(w.type)}</td>
                      <td>{w.capacity}</td>
                      <td>{w.occupied}</td>
                      <td>{zhWardFloor(w.floor)}</td>
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
                          onClick={() => startEdit(w)}
                        />
                        <FiTrash2
                          size={20}
                          color="#ef4444"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleDelete(w.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <aside style={auditSidebarStyle}>
        <div style={auditHeaderStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>日志查看</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
              仅查看，不可更改或删除
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
const pageLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 360px",
  gap: 20,
  alignItems: "start",
};
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

export default ManageWardsPage;