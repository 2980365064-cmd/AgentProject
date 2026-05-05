import React, { useState, useMemo, useEffect } from "react";
import { Table } from "../components/UI";
import { patientService } from "../services/patientService";

const PatientsByWardPage = () => {
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    patientService
      .getAll()
      .then((data) => setPatients(data))
      .catch((err) => console.error(err.message));
  }, []);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = q
      ? patients.filter(
          (p) =>
            p.nic?.toLowerCase().includes(q) ||
            p.name?.toLowerCase().includes(q) ||
            p.ward?.toLowerCase().includes(q) ||
            p.admissionDate?.toLowerCase().includes(q)
        )
      : patients;

    return filtered.map((p) => [
      p.nic           || "—",
      p.name          || "—",
      p.ward          || "—",
      p.admissionDate || "—",
    ]);
  }, [patients, searchQuery]);

  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "32px 36px",
      boxShadow: "0 2px 16px rgba(0,0,0,.07)",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "2px solid #dbeafe",
        paddingBottom: 14,
        marginBottom: 24,
      }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1e3a8a" }}>
          按病区查询患者
        </h2>

        <input
          type="text"
          placeholder="按证件号、姓名或病区搜索…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: 300,
            padding: "8px 12px",
            border: "1.5px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 13,
            background: "#fafafa",
            outline: "none",
          }}
        />
      </div>

      <div style={{ overflowX: "auto", maxHeight: "500px", overflowY: "auto" }}>
        <Table
          headers={["证件号（NIC）", "姓名", "病区", "入院日期"]}
          rows={filteredRows}
        />
        {filteredRows.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px", color: "#6b7280", fontSize: 14 }}>
            {searchQuery
              ? `未找到与「${searchQuery}」匹配的患者`
              : "暂无患者数据。"}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientsByWardPage;