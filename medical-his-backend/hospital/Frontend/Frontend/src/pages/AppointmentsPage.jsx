import React, { useState, useEffect, useMemo } from 'react';
import Select from "react-select"; 
import { toast } from "react-toastify";
import { FiCalendar, FiEdit, FiXCircle } from "react-icons/fi";
import { doctorService } from "../services/doctorService";
import { appointmentService } from "../services/appointmentService"; // Imported your service
import { zhAppointmentStatus, zhSpecialisation } from "../utils/backendDisplayZh";

const AppointmentsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false); // Used to toggle title
  const [doctors, setDoctors] = useState([]); 
  const [appointments, setAppointments] = useState([]); // Mock data removed

  const [formData, setFormData] = useState({
    patient: "", 
    nic: "", 
    doctor: "", 
    date: "", 
    time: "", 
    type: "Consultation"
  });

  // Load everything on mount
  useEffect(() => {
    loadDoctors();
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const data = await appointmentService.getAll();
      setAppointments(data);
    } catch (err) {
      toast.error("无法从服务器加载预约列表");
    }
  };

  const loadDoctors = async () => {
    try {
      const data = await doctorService.getAll();
      setDoctors(data);
    } catch (err) {
      toast.error("加载医生列表失败");
    }
  };

  const doctorOptions = useMemo(() => 
    doctors.map((doc) => {
      const spec = doc.specialization ?? doc.specialisation;
      return {
        value: doc.name,
        label: `${doc.name}（${spec ? zhSpecialisation(spec) : "全科"}）`,
      };
    }), 
  [doctors]);

  const handleCancelAppointment = (nic) => {
    const confirmCancel = async () => {
      try {
        await appointmentService.cancel(nic);
        toast.success("预约已取消！");
        loadAppointments(); // Refresh list
      } catch (err) {
        toast.error(err.message);
      }
    };

    toast.info(
      <div style={{ minWidth: 200, padding: "5px" }}>
        <p style={{ margin: "0 0 10px 0", fontWeight: 600 }}>确定取消该预约？</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button style={confirmBtnStyle} onClick={() => { confirmCancel(); toast.dismiss(); }}>确定</button>
          <button style={denyBtnStyle} onClick={() => toast.dismiss()}>取消</button>
        </div>
      </div>,
      { autoClose: false, closeOnClick: false }
    );
  };

  const handleOpenModal = (appointment = null) => {
    if (appointment) {
      setFormData({ ...appointment });
      setIsRescheduling(true);
    } else {
      setIsRescheduling(false);
      setFormData({ patient: "", nic: "", doctor: "", date: "", time: "", type: "Consultation" });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.patient || !formData.nic || !formData.doctor) {
      toast.error("请填写患者姓名、证件号（NIC）和医生！");
      return;
    }

    try {
      // Both Create and Update use .save as per your backend service logic
      await appointmentService.save(formData);
      toast.success(isRescheduling ? "预约已更新！" : "预约已创建！");
      
      setIsModalOpen(false);
      loadAppointments(); // Refresh the table from DB
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiCalendar /> 预约挂号
        </h2>
        <button onClick={() => handleOpenModal()} style={mainBtnStyle}>+ 新建预约</button>
      </div>

      <div style={tableCardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              {['患者', '证件号（NIC）', '医生', '日期', '时间', '状态', '操作'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appointments.length > 0 ? (
              appointments.map((app) => (
                <tr key={app.nic} style={{ borderBottom: '1px solid #f1f5f9', opacity: app.status === 'Cancelled' ? 0.6 : 1 }}>
                  <td style={tdStyle}><b>{app.patient}</b></td>
                  <td style={tdStyle}>{app.nic}</td>
                  <td style={tdStyle}>{app.doctor}</td>
                  <td style={tdStyle}>{app.date}</td>
                  <td style={tdStyle}>{app.time}</td>
                  <td style={tdStyle}>
                    <span style={{ ...statusBadge, background: app.status === 'Confirmed' ? '#dcfce7' : '#fee2e2', color: app.status === 'Confirmed' ? '#166534' : '#991b1b' }}>
                      {zhAppointmentStatus(app.status)}
                    </span>
                  </td>
                  <td style={{ padding: '15px', display: 'flex', gap: '8px' }}>
                    <FiEdit size={18} color="#2563eb" style={{ cursor: 'pointer' }} onClick={() => handleOpenModal(app)} />
                    {app.status !== 'Cancelled' && <FiXCircle size={18} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => handleCancelAppointment(app.nic)} />}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px', color: '#94a3b8'}}>暂无预约记录。</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <button onClick={() => setIsModalOpen(false)} style={closeIconStyle}><FiXCircle size={24} /></button>
            <h3 style={{ marginBottom: '20px' }}>{isRescheduling ? "修改预约" : "新建预约"}</h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={labelStyle}>患者姓名</label>
                <input required style={inputStyle} value={formData.patient} onChange={(e) => setFormData({...formData, patient: e.target.value})} placeholder="请输入姓名" />
              </div>

              <div>
                <label style={labelStyle}>证件号（NIC）</label>
                <input required style={inputStyle} value={formData.nic} disabled={isRescheduling} onChange={(e) => setFormData({...formData, nic: e.target.value})} placeholder="请输入证件号" />
              </div>
              
              <div>
                <label style={labelStyle}>选择医生</label>
                <Select
                  options={doctorOptions}
                  value={doctorOptions.find(o => o.value === formData.doctor)}
                  onChange={(opt) => setFormData({...formData, doctor: opt ? opt.value : ""})}
                  placeholder="搜索并选择医生…"
                  styles={customSelectStyles}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>日期</label>
                  <input required type="date" style={inputStyle} value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>时间</label>
                  <input required type="time" style={inputStyle} value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} />
                </div>
              </div>

              <button type="submit" style={mainBtnStyle}>
                {isRescheduling ? "保存修改" : "确认预约"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Styles ---
const labelStyle = { fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 5, display: "block" };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px' };
const thStyle = { textAlign: 'left', padding: '15px', fontSize: '13px', color: '#64748b' };
const tdStyle = { padding: '15px', fontSize: '14px' };
const statusBadge = { padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' };
const tableCardStyle = { background: "#fff", borderRadius: 14, padding: "10px", boxShadow: "0 2px 16px rgba(0,0,0,.07)" };
const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalContentStyle = { background: 'white', padding: '30px', borderRadius: '16px', width: '400px', position: 'relative' };
const closeIconStyle = { position: 'absolute', top: 15, right: 15, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' };
const mainBtnStyle = { background: 'linear-gradient(135deg,#2563eb,#1e40af)', color: 'white', padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: '600', cursor: 'pointer' };
const confirmBtnStyle = { padding: "6px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const denyBtnStyle = { padding: "6px 12px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" };

const customSelectStyles = {
  control: (base) => ({
    ...base,
    borderRadius: 8,
    borderColor: "#e5e7eb",
    fontSize: "14px",
    "&:hover": { borderColor: "#2563eb" }
  })
};

export default AppointmentsPage;