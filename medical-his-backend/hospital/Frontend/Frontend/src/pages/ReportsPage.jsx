import React, { useState } from 'react';
import Icon from '../components/Icon';
import { wardService } from "../services/wardService";
import { patientService } from "../services/patientService";
import { treatmentService } from "../services/treatmentService";
import { toast } from "react-toastify";
import { zhWardType } from "../utils/backendDisplayZh";

const REPORT_TYPE_TITLE = {
  "Ward Report": "病区占用报表",
  "Patient Admission Report": "患者入院记录报表",
  "Doctor Treatment Report": "医生诊疗记录报表",
};

const ReportsPage = () => {
  const [reportType, setReportType] = useState("Ward Report");
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const getColumns = () => {
    switch (reportType) {
      case "Patient Admission Report":
        return ["姓名", "证件号（NIC）", "病区", "入院日期", "联系电话"];
      case "Doctor Treatment Report":
        return ["医生", "患者证件号", "病程记录", "诊疗日期", "用药"];
      case "Ward Report":
      default:
        return ["病区名称", "病区类型", "核定床位", "占用床位", "占用率"];
    }
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData([]);
    try {
      if (reportType === "Ward Report") {
        const [wards, patients] = await Promise.all([
          wardService.getAll(),
          patientService.getAll()
        ]);
        const data = wards.map(w => {
          const occupied = patients.filter(p => p.ward === w.wardName || p.ward === w.name).length;
          const capacity = w.capacity || 0;
          const rate = capacity > 0 ? ((occupied / capacity) * 100).toFixed(1) + "%" : "0%";
          return {
            col1: w.wardName || w.name,
            col2: zhWardType(w.wardType || w.type) || "—",
            col3: capacity,
            col4: occupied,
            col5: rate
          };
        });
        setReportData(data);
      }

      else if (reportType === "Patient Admission Report") {
        const patients = await patientService.getAll();
        const filtered = patients.filter(p => {
          if (!dateRange.start || !dateRange.end) return true;
          const recordDate = new Date(p.admissionDate);
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          return recordDate >= startDate && recordDate <= endDate;
        });
        setReportData(filtered.map(p => ({
          col1: p.name || "—",
          col2: p.nic || "—",
          col3: p.ward || "—",
          col4: p.admissionDate || "—",
          col5: p.contact || "—"
        })));
      }

      else if (reportType === "Doctor Treatment Report") {
        const treatments = await treatmentService.getAll();
        const filtered = treatments.filter(t => {
          if (!dateRange.start || !dateRange.end) return true;
          const recordDate = new Date(t.treatmentDate);
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          return recordDate >= startDate && recordDate <= endDate;
        });
        setReportData(filtered.map(t => ({
          col1: t.doctor || "—",
          col2: t.nic || "—",
          col3: t.notes || "—",
          col4: t.treatmentDate || "—",
          col5: t.medications || "—"
        })));
      }

      toast.success(`「${REPORT_TYPE_TITLE[reportType] || reportType}」已生成`);
    } catch (err) {
      toast.error("连接失败，请确认后端服务已在 8081 端口运行。");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── CSV Download ──────────────────────────────────────────────
  const downloadCSV = () => {
    if (reportData.length === 0) {
      toast.warn("请先生成报表再下载。");
      return;
    }

    const columns = getColumns();
    const rows = reportData.map(row => [row.col1, row.col2, row.col3, row.col4, row.col5]);

    const csvContent = [
      columns.join(","),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(REPORT_TYPE_TITLE[reportType] || reportType).replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 已下载！");
  };

  // ─── PDF Download using jsPDF + autoTable ─────────────────────
  const downloadPDF = () => {
    if (reportData.length === 0) {
      toast.warn("请先生成报表再下载。");
      return;
    }

    // Dynamically import jsPDF (must be installed: npm install jspdf jspdf-autotable)
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // ── Header ──
        doc.setFillColor(15, 23, 42); // #0f172a
        doc.rect(0, 0, 297, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Hospital Management System', 14, 9);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Official Report Document', 14, 15);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(String(REPORT_TYPE_TITLE[reportType] || reportType), 14, 32);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        const generatedOn = `生成时间：${new Date().toLocaleString('zh-CN')}`;
        const period = dateRange.start && dateRange.end
          ? `统计区间：${dateRange.start} 至 ${dateRange.end}`
          : '统计区间：全部记录';
        doc.text(generatedOn, 14, 39);
        doc.text(period, 14, 44);
        doc.text(`记录条数：${reportData.length}`, 14, 49);

        // ── Table ──
        const columns = getColumns();
        const rows = reportData.map(row => [row.col1, row.col2, row.col3, row.col4, row.col5]);

        doc.autoTable({
          head: [columns],
          body: rows,
          startY: 55,
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 4,
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.3,
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          margin: { left: 14, right: 14 },
        });

        // ── Footer on each page ──
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          const pageHeight = doc.internal.pageSize.height;
          doc.setDrawColor(226, 232, 240);
          doc.line(14, pageHeight - 12, 283, pageHeight - 12);
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text('Hospital Management System — Confidential', 14, pageHeight - 7);
          doc.text(`第 ${i} / ${pageCount} 页`, 283, pageHeight - 7, { align: 'right' });
        }

        doc.save(`${(REPORT_TYPE_TITLE[reportType] || reportType).replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success("PDF 已下载！");
      });
    }).catch(() => {
      toast.error("未安装 PDF 组件，请执行：npm install jspdf jspdf-autotable");
    });
  };

  return (
    <div className="reports-page" style={{ padding: '28px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
          医院管理统计报表
        </h1>

        {/* Download Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={csvBtnStyle} onClick={downloadCSV} title="下载为 CSV（可用 Excel 打开）">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
            </svg>
            <span>下载 CSV</span>
          </button>

          {/* <button style={pdfBtnStyle} onClick={downloadPDF} title="下载为 PDF">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
            </svg>
            <span>PDF</span>
          </button> */}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="no-print" style={filterBarStyle}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>报表类型</label>
            <select
              style={inputStyle}
              value={reportType}
              onChange={(e) => { setReportType(e.target.value); setReportData([]); }}
            >
              <option value="Ward Report">病区占用报表</option>
              <option value="Patient Admission Report">患者入院记录报表</option>
              <option value="Doctor Treatment Report">医生诊疗记录报表</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>日期范围</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="date" style={inputStyle} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
              <span style={{ color: '#94a3b8' }}>至</span>
              <input type="date" style={inputStyle} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
            </div>
          </div>

          <button style={generateBtnStyle} onClick={generateReport} disabled={loading}>
            {loading ? "加载中…" : "生成报表"}
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={tableContainerStyle} id="report-content">
        <div style={{ borderBottom: '2px solid #334155', marginBottom: '20px', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ margin: 0, color: '#334155', fontSize: '18px' }}>{REPORT_TYPE_TITLE[reportType] || reportType}</h2>
            {dateRange.start && (
              <small style={{ color: '#64748b' }}>统计区间：{dateRange.start} 至 {dateRange.end}</small>
            )}
          </div>
          {reportData.length > 0 && (
            <span style={{ fontSize: '13px', color: '#64748b', background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px' }}>
              共 {reportData.length} 条记录
            </span>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: "linear-gradient(135deg,#2563eb,#1e40af)", textAlign: 'left' }}>
              {getColumns().map((col, i) => (
                <th key={i} style={thStyle}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportData.length > 0 ? reportData.map((row, index) => (
              <tr key={index} style={{ background: index % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <td style={tdStyle}>{row.col1}</td>
                <td style={tdStyle}>{row.col2}</td>
                <td style={tdStyle}>{row.col3}</td>
                <td style={tdStyle}>{row.col4}</td>
                <td style={tdStyle}>{row.col5}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  暂无数据。请选择条件后点击「生成报表」。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .reports-page { padding: 0 !important; }
          #report-content { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────
const filterBarStyle = { background: '#fff', padding: '20px 24px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '24px' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px', letterSpacing: '0.02em' };
const inputStyle = { padding: '9px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#334155', outline: 'none', background: '#fff' };
const generateBtnStyle = { background: "linear-gradient(135deg,#2563eb,#1e40af)",color: '#fff', padding: '10px 22px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' };
const tableContainerStyle = { background: '#fff', padding: '28px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' };
const thStyle = { padding: '12px 16px', fontSize: '12px', color: '#fff', fontWeight: '700', letterSpacing: '0.02em' };
const tdStyle = { padding: '13px 16px', fontSize: '14px', color: '#1e293b' };
const csvBtnStyle = { background: '#fff', border: '1.5px solid #16a34a', color: '#16a34a', padding: '9px 18px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '700', fontSize: '13px' };
const pdfBtnStyle = { background: '#fff', border: '1.5px solid #dc2626', color: '#dc2626', padding: '9px 18px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '700', fontSize: '13px' };

export default ReportsPage;