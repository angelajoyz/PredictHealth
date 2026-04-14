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
  Email as EmailIcon,
  Badge as BadgeIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
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
  sidebarBg: "#162032",
};

const features = [
  {
    title: "Time-Series Forecasting",
    desc: "Forecasts disease trends up to 6 months ahead.",
  },
  {
    title: "Multi-Disease Monitoring",
    desc: "Tracks common barangay health conditions.",
  },
  {
    title: "Localized Insights",
    desc: "Provides barangay-level health forecasts.",
  },
];

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const Register = ({ onGoToLogin }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");
    setSuccess("");

    if (!username || !email || !password) {
      setError("Username, email, and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed.");
        setLoading(false);
        return;
      }

      setSuccess(
        data.message || "Account created! Check your email to verify.",
      );
      setLoading(false);
    } catch (err) {
      console.error("Register error:", err);
      setError("Cannot connect to server. Make sure the backend is running.");
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleRegister();
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
      py: 1.15,
      "&::-ms-reveal": { display: "none" },
      "&::-ms-clear": { display: "none" },
    },
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        backgroundColor: T.sidebarBg,
        overflow: "hidden",
      }}
    >
      {/* ── Left panel ── */}
      <Box
        sx={{
          flex: 1,
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          px: "8%",
          position: "relative",
          gap: 3,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              width: 350,
              height: 350,
              top: "-80px",
              left: "-80px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #4A90D9 0%, transparent 70%)",
              opacity: 0.07,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              width: 220,
              height: 220,
              bottom: "30px",
              right: "-20px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #4A90D9 0%, transparent 70%)",
              opacity: 0.05,
            }}
          />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: "12px",
              backgroundColor: T.blue,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "0 0 0 4px rgba(27,79,138,0.28), 0 6px 18px rgba(27,79,138,0.4)",
            }}
          >
            <HealthAndSafetyIcon sx={{ fontSize: 23, color: "#fff" }} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: 16,
                fontWeight: 800,
                color: "rgba(255,255,255,0.92)",
                letterSpacing: "-0.3px",
                lineHeight: 1.2,
              }}
            >
              PredictHealth
            </Typography>
            <Typography
              sx={{
                fontSize: 9.5,
                color: "rgba(255,255,255,0.32)",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Barangay Health Forecasting System
            </Typography>
          </Box>
        </Box>

        <Box>
          <Typography
            sx={{
              fontSize: 26,
              fontWeight: 800,
              color: "rgba(255,255,255,0.93)",
              letterSpacing: "-0.5px",
              lineHeight: 1.3,
              mb: 1.5,
            }}
          >
            Smarter Health Planning
            <br />
            <Box component="span" sx={{ color: "#5B9FD4" }}>
              Powered by
            </Box>{" "}
            Machine Learning
          </Typography>
          <Typography
            sx={{
              fontSize: 13,
              color: "rgba(255,255,255,0.38)",
              lineHeight: 1.75,
              maxWidth: 340,
            }}
          >
            An ML-based system designed to analyze historical barangay health
            data and forecast disease trends to support data-driven planning.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.9 }}>
          {features.map((f, i) => (
            <Box
              key={i}
              sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}
            >
              <CheckCircleIcon
                sx={{
                  fontSize: 14,
                  color: "#4A90D9",
                  mt: "3px",
                  flexShrink: 0,
                }}
              />
              <Typography
                sx={{
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.40)",
                  lineHeight: 1.55,
                }}
              >
                <Box
                  component="span"
                  sx={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}
                >
                  {f.title}
                </Box>{" "}
                — {f.desc}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            position: "absolute",
            right: 0,
            top: "10%",
            bottom: "10%",
            width: "1px",
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        />
      </Box>

      {/* ── Right panel — form ── */}
      <Box
        sx={{
          width: { xs: "100%", md: 420 },
          flexShrink: 0,
          backgroundColor: T.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: "36px",
          py: 4,
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 340 }}>
          {/* Mobile logo */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              gap: 1.5,
              mb: 3.5,
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: T.blue,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <HealthAndSafetyIcon sx={{ fontSize: 20, color: "#fff" }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.t1 }}>
                PredictHealth
              </Typography>
              <Typography
                sx={{
                  fontSize: 10,
                  color: T.t4,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                }}
              >
                Barangay Health Forecasting
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 2.5 }}>
            <Typography
              sx={{
                fontSize: 20,
                fontWeight: 800,
                color: T.t1,
                letterSpacing: "-0.3px",
                mb: 0.5,
              }}
            >
              Create Account
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: T.t3 }}>
              Register to access the PredictHealth dashboard.
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2, borderRadius: "9px", fontSize: 12, py: 0.5 }}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              severity="success"
              sx={{ mb: 2, borderRadius: "9px", fontSize: 12, py: 0.5 }}
            >
              {success}
            </Alert>
          )}

          {!success ? (
            <>
              {/* First Name & Last Name */}
              <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    sx={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: T.t2,
                      mb: 0.75,
                    }}
                  >
                    First Name
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="First name"
                    variant="outlined"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setError("");
                    }}
                    onKeyPress={handleKeyPress}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeIcon sx={{ fontSize: 16, color: T.t4 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={fieldSx}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    sx={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: T.t2,
                      mb: 0.75,
                    }}
                  >
                    Last Name
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Last name"
                    variant="outlined"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setError("");
                    }}
                    onKeyPress={handleKeyPress}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeIcon sx={{ fontSize: 16, color: T.t4 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={fieldSx}
                  />
                </Box>
              </Box>

              {/* Username */}
              <Box sx={{ mb: 1.5 }}>
                <Typography
                  sx={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: T.t2,
                    mb: 0.75,
                  }}
                >
                  Username
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Choose a username"
                  variant="outlined"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  onKeyPress={handleKeyPress}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ fontSize: 16, color: T.t4 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSx}
                />
              </Box>

              {/* Email */}
              <Box sx={{ mb: 1.5 }}>
                <Typography
                  sx={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: T.t2,
                    mb: 0.75,
                  }}
                >
                  Email
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Enter your email"
                  variant="outlined"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onKeyPress={handleKeyPress}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ fontSize: 16, color: T.t4 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSx}
                />
              </Box>

              {/* Password */}
              <Box sx={{ mb: 1.5 }}>
                <Typography
                  sx={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: T.t2,
                    mb: 0.75,
                  }}
                >
                  Password
                </Typography>
                <TextField
                  fullWidth
                  placeholder="At least 8 characters"
                  type={showPassword ? "text" : "password"}
                  variant="outlined"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  onKeyPress={handleKeyPress}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ fontSize: 16, color: T.t4 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          size="small"
                          tabIndex={-1}
                          sx={{
                            color: T.t4,
                            "&:hover": {
                              backgroundColor: "transparent",
                              color: T.t3,
                            },
                          }}
                          disableRipple
                        >
                          {showPassword ? (
                            <VisibilityOffIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <VisibilityIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSx}
                />
              </Box>

              {/* Confirm Password */}
              <Box sx={{ mb: 2.5 }}>
                <Typography
                  sx={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: T.t2,
                    mb: 0.75,
                  }}
                >
                  Confirm Password
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Re-enter your password"
                  type={showConfirm ? "text" : "password"}
                  variant="outlined"
                  value={confirmPw}
                  onChange={(e) => {
                    setConfirmPw(e.target.value);
                    setError("");
                  }}
                  onKeyPress={handleKeyPress}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ fontSize: 16, color: T.t4 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirm((v) => !v)}
                          edge="end"
                          size="small"
                          tabIndex={-1}
                          sx={{
                            color: T.t4,
                            "&:hover": {
                              backgroundColor: "transparent",
                              color: T.t3,
                            },
                          }}
                          disableRipple
                        >
                          {showConfirm ? (
                            <VisibilityOffIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <VisibilityIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSx}
                />
              </Box>

              <Button
                fullWidth
                variant="contained"
                onClick={handleRegister}
                disabled={loading}
                endIcon={!loading && <ArrowForwardIcon sx={{ fontSize: 16 }} />}
                sx={{
                  py: 1.15,
                  backgroundColor: T.blue,
                  fontSize: 13.5,
                  fontWeight: 700,
                  textTransform: "none",
                  borderRadius: "9px",
                  boxShadow: "0 2px 12px rgba(27,79,138,0.28)",
                  letterSpacing: "0.1px",
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
                {loading ? "Creating Account…" : "Create Account"}
              </Button>

              <Typography
                sx={{ fontSize: 12, color: T.t3, textAlign: "center", mt: 2.5 }}
              >
                Already have an account?{" "}
                <Box
                  component="span"
                  onClick={onGoToLogin}
                  sx={{
                    color: T.blue,
                    fontWeight: 600,
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Sign In
                </Box>
              </Typography>
            </>
          ) : (
            /* ── Post-registration success view ── */
            <Box sx={{ textAlign: "center", mt: 1 }}>
              <Typography
                sx={{ fontSize: 13, color: T.t3, mb: 3, lineHeight: 1.7 }}
              >
                A verification link has been sent to <strong>{email}</strong>.
                Please check your inbox and click the link to activate your
                account.
              </Typography>
              <Button
                fullWidth
                variant="contained"
                onClick={onGoToLogin}
                endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                sx={{
                  py: 1.15,
                  backgroundColor: T.blue,
                  fontSize: 13.5,
                  fontWeight: 700,
                  textTransform: "none",
                  borderRadius: "9px",
                  boxShadow: "0 2px 12px rgba(27,79,138,0.28)",
                  letterSpacing: "0.1px",
                  "&:hover": {
                    backgroundColor: T.blueMid,
                    boxShadow: "0 4px 18px rgba(27,79,138,0.36)",
                    transform: "translateY(-1px)",
                  },
                  "&:active": { transform: "translateY(0px)" },
                  transition: "all 0.18s ease",
                }}
              >
                Go to Sign In
              </Button>
            </Box>
          )}

          <Typography
            sx={{
              fontSize: 11,
              color: T.t4,
              textAlign: "center",
              mt: 2.5,
              lineHeight: 1.6,
            }}
          >
            Authorized barangay health personnel only.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Register;
