// frontend/src/Login.jsx
import React, { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();

    const rawUrl = import.meta.env.VITE_API_BASE_URL || "https://ai-job-aggregator-backend-yn8i.onrender.com";
    const BASE_URL = rawUrl.replace(/\/$/, "");

    try {
      const response = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      setMessage("Login successful!");
      localStorage.setItem('user', JSON.stringify(data.user));
      if (onLoginSuccess) onLoginSuccess(data.user);
    } catch (err) {
      console.error("Login Error:", err.message);
      setMessage(err.message || "Error connecting to backend");
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '300px' }}>
      <h2>Login</h2>
      {message && <p>{message}</p>}
      <form onSubmit={handleLogin}>
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <br />
        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <br />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;