import Icon from "./Icon";
import { NAV_ITEMS } from "../../constants";

const Sidebar = ({ active, setActive, navItems }) => {
  const items = navItems ?? NAV_ITEMS;

  return (
    <aside
      style={{
        width: 240,
        background: "#1e293b",
        color: "#cbd5e1",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
        padding: "12px 0",
      }}
    >
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 20px",
              background: isActive
                ? "linear-gradient(90deg,#1e40af,#2563eb)"
                : "transparent",
              border: "none",
              color: isActive ? "#fff" : "#94a3b8",
              cursor: "pointer",
              textAlign: "left",
              fontSize: 13.5,
              fontWeight: isActive ? 700 : 500,
              borderLeft: isActive ? "3px solid #93c5fd" : "3px solid transparent",
              transition: "all .18s",
              width: "100%",
              borderRadius: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "rgba(255,255,255,.06)";
                e.currentTarget.style.color = "#e2e8f0";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#94a3b8";
              }
            }}
          >
            <span style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>
              <Icon name={item.icon} />
            </span>
            {item.label}
          </button>
        );
      })}
    </aside>
  );
};

export default Sidebar;
