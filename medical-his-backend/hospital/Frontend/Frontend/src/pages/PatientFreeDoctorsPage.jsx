import React, { useState, useCallback } from "react";
import { doctorService } from "../services/doctorService";
import { toast } from "react-toastify";

/**
 * 患者端：按时间段查看空闲医生（展示层；具体「空闲」逻辑由后端排班接口对接后可替换查询）
 */
const PatientFreeDoctorsPage = () => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("09:00");
  const [timeTo, setTimeTo] = useState("17:00");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleQuery = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      toast.warning("请选择开始日期与结束日期。");
      return;
    }
    setLoading(true);
    try {
      const list = await doctorService.getAll();
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e.message || "加载失败");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>
        查看指定时间段空闲医生
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280" }}>
        请选择日期与大致时段，查询后将展示在职医生信息；与排班系统对接后，可仅显示该时段可预约/空闲的医生。
      </p>

      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "24px 28px",
          boxShadow: "0 2px 16px rgba(0,0,0,.07)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={lb}>开始日期</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lb}>结束日期</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lb}>每日开始时间</label>
            <input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lb}>每日结束时间</label>
            <input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} style={inp} />
          </div>
        </div>
        <button type="button" onClick={handleQuery} disabled={loading} style={btn}>
          {loading ? "查询中…" : "查询"}
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", boxShadow: "0 2px 16px rgba(0,0,0,.07)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#374151" }}>医生列表</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#1e40af", color: "#fff" }}>
                <th style={th}>姓名</th>
                <th style={th}>专科</th>
                <th style={th}>病区</th>
                <th style={th}>医疗组</th>
                <th style={th}>联系电话</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>
                    请先选择日期并点击「查询」。
                  </td>
                </tr>
              ) : (
                rows.map((d, i) => (
                  <tr key={d.mobile || i} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                    <td style={td}>{d.name}</td>
                    <td style={td}>{d.specialisation}</td>
                    <td style={td}>{d.ward}</td>
                    <td style={td}>{d.team}</td>
                    <td style={td}>{d.mobile}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const lb = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 };
const inp = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 14, boxSizing: "border-box" };
const btn = {
  padding: "10px 24px",
  background: "linear-gradient(135deg,#2563eb,#1e40af)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontWeight: 600,
  cursor: "pointer",
};
const th = { padding: "12px 14px", textAlign: "left", fontWeight: 700 };
const td = { padding: "11px 14px", color: "#374151" };

export default PatientFreeDoctorsPage;
