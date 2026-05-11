// src/pages/AdminLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    // таны одоо байгаа admin login логик энд орно
    // жишээ нь:
    // await adminLogin(email, password);
    // navigate("/admin/dashboard");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f1f1f1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: "2rem",
        width: 400,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
      }}>
        <h2 style={{ textAlign: "center", color: "#CC2200", marginBottom: 24 }}>
          🔐 Админ нэвтрэх
        </h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Админ имэйл"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Нууц үг"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" style={btnStyle}>
            Админ нэвтрэх
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px", marginBottom: 12,
  border: "1px solid #ddd", borderRadius: 8, fontSize: 15,
  boxSizing: "border-box"
};
const btnStyle = {
  width: "100%", padding: "12px", background: "#CC2200",
  color: "#fff", border: "none", borderRadius: 8,
  fontSize: 15, cursor: "pointer", fontWeight: 500
};