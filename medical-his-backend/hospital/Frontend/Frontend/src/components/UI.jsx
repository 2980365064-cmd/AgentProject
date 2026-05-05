// ── Field ─────────────────────────────────────────────────────────────────────
export const Field = ({ label, type = "text", placeholder, value, onChange, disabled }) => (
  <div style={{ marginBottom: 16 }}>
    <label 
      style={{ 
        display: "block", 
        fontSize: 13, 
        fontWeight: 600, 
        color: "#374151", 
        marginBottom: 6 
      }}
    >
      {label}
    </label>
    <input
      type={type}
      placeholder={placeholder}
      value={value}         
      onChange={onChange}   
      disabled={disabled}   
      style={{
        width: "100%", 
        padding: "10px 14px", 
        border: "1.5px solid #e5e7eb",
        borderRadius: 8, 
        fontSize: 14, 
        color: "#111827", 
        outline: "none",
        transition: "border-color .2s", 
        boxSizing: "border-box", 
        background: disabled ? "#f3f4f6" : "#fafafa", 
        cursor: disabled ? "not-allowed" : "text"
      }}
      onFocus={e => !disabled && (e.target.style.borderColor = "#1e40af")}
      onBlur={e => !disabled && (e.target.style.borderColor = "#e5e7eb")}
    />
  </div>
);
  
  // ── FormCard ──────────────────────────────────────────────────────────────────
  export const FormCard = ({ title, children, onSubmit }) => (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      padding: "32px 36px",
      boxShadow: "0 2px 16px rgba(0,0,0,.07)",
      width: "100%",
      maxWidth: "100%"
    }}>
      <h2 style={{
        margin: "0 0 24px",
        fontSize: 20,
        fontWeight: 700,
        color: "#1e3a8a",
        borderBottom: "2px solid #dbeafe",
        paddingBottom: 14
      }}>
        {title}
      </h2>
  
      {children}
  
      {/* Show button ONLY if onSubmit exists */}
      {/* {onSubmit && (
        <button
          onClick={onSubmit}
          style={{
            marginTop: 8,
            background: "linear-gradient(135deg,#1e40af,#2563eb)",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "11px 32px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: ".3px",
            boxShadow: "0 4px 12px rgba(37,99,235,.35)"
          }}
        >
          Submit
        </button>
      )} */}
  
    </div>
  );
  
  
  
  // ── Badge ─────────────────────────────────────────────────────────────────────
  export const Badge = ({ color, label }) => (
    <span style={{
      background: color, color: "#fff", borderRadius: 20,
      padding: "3px 11px", fontSize: 12, fontWeight: 600,
    }}>
      {label}
    </span>
  );
  
  // ── Table ─────────────────────────────────────────────────────────────────────
  export const Table = ({ headers, rows }) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#1e40af" }}>
            {headers.map(h => (
              <th key={h} style={{
                padding: "12px 16px", color: "#fff", fontWeight: 700,
                textAlign: "left", whiteSpace: "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{
              background: i % 2 === 0 ? "#f8faff" : "#fff",
              borderBottom: "1px solid #e5e7eb",
            }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "11px 16px", color: "#374151" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  