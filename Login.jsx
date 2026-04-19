import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Alert,
} from "@mui/material";
import {
  HealthAndSafety as HealthAndSafetyIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";

const T = {
  blue: "#1B4F8A",
  blueMid: "#2260A8",
  bg: "#F4F6F8",
  border: "#DDE1E7",
  t1: "#111827",
  t2: "#374151",
  t3: "#6B7280",
  t4: "#9CA3AF",
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const Login = ({ onLogin, onGoToRegister, onForgotPassword }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || data.message || "Invalid username or password.");
        setLoading(false);
        return;
      }
      const token = data.access_token || data.token;
      if (!token) {
        setError("Login failed: no token received from server.");
        setLoading(false);
        return;
      }
      localStorage.setItem("token", token);
      localStorage.setItem("username", data.user?.username || username);
      localStorage.setItem("role", data.user?.role || "staff");
      localStorage.setItem("fullName", data.user?.full_name || "");
      localStorage.setItem("email", data.user?.email || "");
      onLogin(true);
    } catch (err) {
      console.error("Login error:", err);
      setError("Cannot connect to server. Make sure the backend is running.");
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "9px",
      fontSize: 13,
      backgroundColor: "#FAFBFC",
      "& fieldset": { borderColor: T.border },
      "&:hover fieldset": { borderColor: "#B0BEC5" },
      "&.Mui-focused fieldset": { borderColor: T.blue, borderWidth: 1.5 },
      "&.Mui-focused": { backgroundColor: "#fff" },
    },
    "& .MuiInputBase-input": {
      py: 1.1,
      "&::-ms-reveal": { display: "none" },
      "&::-ms-clear": { display: "none" },
    },
  };

  return (
    <Box sx={{ px: "36px", py: "32px", backgroundColor: "#fff" }}>
      {/* Logo */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2.5 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: "10px",
            backgroundColor: T.blue, display: "flex",
            alignItems: "center", justifyContent: "center",
            boxShadow: "0 3px 10px rgba(27,79,138,0.28)", flexShrink: 0,
          }}
        >
          <HealthAndSafetyIcon sx={{ fontSize: 20, color: "#fff" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.t1, lineHeight: 1.2 }}>
            PredictHealth
          </Typography>
          <Typography sx={{ fontSize: 9, color: T.t4, textTransform: "uppercase", letterSpacing: "0.9px" }}>
            Barangay Health Forecasting
          </Typography>
        </Box>
      </Box>

      {/* Heading */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: T.t1, letterSpacing: "-0.3px", mb: 0.4 }}>
          Welcome Back
        </Typography>
        <Typography sx={{ fontSize: 12, color: T.t3 }}>
          Sign in to access the PredictHealth dashboard.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: "9px", fontSize: 12, py: 0.5 }}>
          {error}
        </Alert>
      )}

      {/* Username */}
      <Box sx={{ mb: 1.75 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.t2, mb: 0.6 }}>
          Username
        </Typography>
        <TextField
          fullWidth
          placeholder="Enter your username"
          variant="outlined"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(""); }}
          onKeyPress={handleKeyPress}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonIcon sx={{ fontSize: 15, color: T.t4 }} />
              </InputAdornment>
            ),
          }}
          sx={fieldSx}
        />
      </Box>

      {/* Password */}
      <Box sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.t2, mb: 0.6 }}>
          Password
        </Typography>
        <TextField
          fullWidth
          placeholder="Enter your password"
          type={showPassword ? "text" : "password"}
          variant="outlined"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyPress={handleKeyPress}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon sx={{ fontSize: 15, color: T.t4 }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((v) => !v)}
                  edge="end" size="small" tabIndex={-1}
                  sx={{ color: T.t4, "&:hover": { backgroundColor: "transparent", color: T.t3 } }}
                  disableRipple
                >
                  {showPassword
                    ? <VisibilityOffIcon sx={{ fontSize: 15 }} />
                    : <VisibilityIcon sx={{ fontSize: 15 }} />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={fieldSx}
        />
      </Box>

      {/* Forgot password */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Typography
          onClick={onForgotPassword}
          sx={{
            fontSize: 11.5, color: T.blue, fontWeight: 600, cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          Forgot password?
        </Typography>
      </Box>

      {/* Sign In button */}
      <Button
        fullWidth variant="contained"
        onClick={handleLogin} disabled={loading}
        endIcon={!loading && <ArrowForwardIcon sx={{ fontSize: 15 }} />}
        sx={{
          py: 1.1, backgroundColor: T.blue, fontSize: 13, fontWeight: 700,
          textTransform: "none", borderRadius: "9px",
          boxShadow: "0 2px 12px rgba(27,79,138,0.28)",
          "&:hover": {
            backgroundColor: T.blueMid,
            boxShadow: "0 4px 18px rgba(27,79,138,0.36)",
            transform: "translateY(-1px)",
          },
          "&:active": { transform: "translateY(0px)" },
          "&:disabled": { backgroundColor: T.blue, opacity: 0.65 },
          transition: "all 0.18s ease",
        }}
      >
        {loading ? "Signing in…" : "Sign In"}
      </Button>

      <Typography sx={{ fontSize: 11, color: T.t4, textAlign: "center", mt: 1.25 }}>
        Authorized barangay health personnel only.
      </Typography>
    </Box>
  );
};

export default Login;