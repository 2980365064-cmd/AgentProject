import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Import your services (adjust paths as necessary)
import { patientService } from '../services/patientService';
import { doctorService } from '../services/doctorService';
import { wardService } from '../services/wardService';
import { dischargeService } from '../services/dischargeService';

const DashboardPage = ({ setActive }) => {
  const [data, setData] = useState({
    patients: [],
    doctors: [],
    wards: [],
    discharges: [],
    loading: true,
    error: null
  });

  // 1. Fetch all data from DB on component mount
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Fetch all data in parallel for speed
        const [p, d, w, dis] = await Promise.all([
          patientService.getAll(),
          doctorService.getAll(),
          wardService.getAll(),
          dischargeService.getHistory()
        ]);

        setData({
          patients: p || [],
          doctors: d || [],
          wards: w || [],
          discharges: dis || [],
          loading: false,
          error: null
        });
      } catch (err) {
        setData(prev => ({ ...prev, loading: false, error: "加载数据失败，请检查网络或后端服务。" }));
      }
    };

    loadDashboardData();
  }, []);

  // 2. Data Transformation for Charts
  // Transform Ward DB data for the Bar Chart
  const formattedWardData = data.wards.map(ward => ({
    name: ward.wardName || ward.name,
    occupied: ward.occupiedBeds || 0,
    // Assuming 'capacity' or 'totalBeds' exists in your DB
    available: (ward.totalBeds || 20) - (ward.occupiedBeds || 0) 
  }));

  // Generate Weekly Analytics (Simplistic grouping by day)
  const dayKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weeklyAnalytics = dayKeys.map((dayKey, idx) => {
    return {
      name: dayLabels[idx],
      admitted: data.patients.filter(p => {
        const d = new Date(p.admissionDate);
        return dayKeys[d.getDay()] === dayKey;
      }).length,
      discharged: data.discharges.filter(d => {
        const date = new Date(d.dischargeDate);
        return dayKeys[date.getDay()] === dayKey;
      }).length
    };
  });

  // 3. Summary Stats calculation
  const summaryStats = [
    { 
        title: "在院患者总数", 
        value: data.patients.length, 
        trend: "分布在各病区", 
        emoji: "🛏️", 
        action: "byWard" 
    },
    { 
        title: "今日入院人数", 
        value: data.patients.filter(p => new Date(p.admissionDate).toDateString() === new Date().toDateString()).length, 
        trend: "今日新增", 
        emoji: "🏥"
    },
    { 
        title: "出院记录数", 
        value: data.discharges.length, 
        trend: "累计已办理", 
        emoji: "🚪" 
    },
    { 
        title: "在职医生", 
        value: data.doctors.length, 
        trend: "全院在岗", 
        emoji: "👨‍⚕️"
    },
  ];

  if (data.loading) return <div style={{ padding: "50px", textAlign: "center", color: "#666" }}>正在加载实时数据…</div>;
  if (data.error) return <div style={{ padding: "50px", textAlign: "center", color: "red" }}>{data.error}</div>;

  return (
    <div style={{ padding: "10px", fontFamily: "system-ui, sans-serif" }}>
      
      {/* Header */}
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800, color: "#1e3a8a" }}>实时工作台</h2>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 15 }}>全院运行数据一览。</p>
        </div>
        <button 
          onClick={() => setActive('admit')}
          style={{
            background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px",
            padding: "10px 20px", fontWeight: 600, cursor: "pointer"
          }}
        >
          + 新建入院
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "32px" }}>
        {summaryStats.map((stat, index) => (
          <div 
            key={index} 
            onClick={() => stat.action && setActive(stat.action)}
            style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)", cursor: stat.action ? "pointer" : "default"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#6b7280", fontWeight: 600 }}>{stat.title}</p>
                <h3 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "#111827" }}>{stat.value}</h3>
              </div>
              <span style={{ fontSize: 28 }}>{stat.emoji}</span>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "#10b981" }}>{stat.trend}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px" }}>
        
        {/* Line Chart: Weekly Admissions vs Discharges */}
        <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, color: "#374151" }}>本周动态</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyAnalytics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="admitted" name="入院" stroke="#3b82f6" strokeWidth={3} />
                <Line type="monotone" dataKey="discharged" name="出院" stroke="#10b981" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Ward Occupancy */}
        <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, color: "#374151" }}>病区床位占用</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedWardData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Legend />
                <Bar dataKey="occupied" name="已占用" stackId="a" fill="#3b82f6" />
                <Bar dataKey="available" name="空余" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;