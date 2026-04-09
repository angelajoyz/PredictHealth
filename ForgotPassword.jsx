import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Alert,
} from "@mui/material";
import {
  HealthAndSafety as HealthAndSafetyIcon,
  Email as EmailIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";
import IconButton from "@mui/material/IconButton";

// ── Design tokens — identical to Login ───────────────────────────────────────
const T = {
  blue:      "#1B4F8A",
  blueMid:   "#2260A8",
  bg:        "#F4F6F8",
  border:    "#DDE1E7",
  t1:        "#111827",
  t2:        "#374151",
  t3:        "#6B7280",
  t4:        "#9CA3AF",
  sidebarBg: "#162032",
};

const API_BASE_URL = "http://localhost:5000/api";

// ── Steps: 'email' | 'sent' | 'reset' ────────────────────────────────────────
// 'email' — enter email address
// 'sent'  — email sent confirmation screen
// 'reset' — enter new password (used if backend sends user back with token via URL;
//            expose this step only when a ?token= param is present, or wire as needed)

const features = [
  { title: "Secure Reset Link", desc: "A one-time link is sent to your registered email." },
  { title: "Link Expires in 30 Minutes", desc: "For security, the reset link expires quickly." },
  { title: "Barangay Personnel Only", desc: "Only registered health personnel can reset." },
];

// ── Shared field style — mirrors Login exactly ────────────────────────────────
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
  "& .MuiInputBase-input": { py: 1.15 },
};

// ── Left decorative panel — identical structure to Login ──────────────────────
const LeftPanel = () => (
  <Box sx={{
    flex: 1,
    display: { xs: "none", md: "flex" },
    flexDirection: "column",
    justifyContent: "center",
    px: "8%",
    position: "relative",
    gap: 3,
  }}>
    {/* Decorative blobs */}
    <Box sx={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <Box sx={{
        position: "absolute", width: 350, height: 350,
        top: "-80px", left: "-80px", borderRadius: "50%",
        background: "radial-gradient(circle, #4A90D9 0%, transparent 70%)",
        opacity: 0.07,
      }} />
      <Box sx={{
        position: "absolute", width: 220, height: 220,
        bottom: "30px", right: "-20px", borderRadius: "50%",
        background: "radial-gradient(circle, #4A90D9 0%, transparent 70%)",
        opacity: 0.05,
      }} />
    </Box>

    {/* Logo */}
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{
        width: 46, height: 46, borderRadius: "12px", backgroundColor: T.blue,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 0 4px rgba(27,79,138,0.28), 0 6px 18px rgba(27,79,138,0.4)",
      }}>
        <HealthAndSafetyIcon sx={{ fontSize: 23, color: "#fff" }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.3px", lineHeight: 1.2 }}>
          PredictHealth
        </Typography>
        <Typography sx={{ fontSize: 9.5, color: "rgba(255,255,255,0.32)", letterSpacing: "1px", textTransform: "uppercase" }}>
          Barangay Health Forecasting System
        </Typography>
      </Box>
    </Box>

    {/* Headline */}
    <Box>
      <Typography sx={{ fontSize: 26, fontWeight: 800, color: "rgba(255,255,255,0.93)", letterSpacing: "-0.5px", lineHeight: 1.3, mb: 1.5 }}>
        Account Recovery
        <br />
        <Box component="span" sx={{ color: "#5B9FD4" }}>Quick</Box> & Secure
      </Typography>
      <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.75, maxWidth: 340 }}>
        Regain access to your PredictHealth account. A secure reset link will be sent to your registered email address.
      </Typography>
    </Box>

    {/* Feature list */}
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.9 }}>
      {features.map((f, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
          <CheckCircleIcon sx={{ fontSize: 14, color: "#4A90D9", mt: "3px", flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.40)", lineHeight: 1.55 }}>
            <Box component="span" sx={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{f.title}</Box>
            {" "}— {f.desc}
          </Typography>
        </Box>
      ))}
    </Box>

    {/* Right divider */}
    <Box sx={{ position: "absolute", right: 0, top: "10%", bottom: "10%", width: "1px", backgroundColor: "rgba(255,255,255,0.06)" }} />
  </Box>
);

// ── Step 1: Email form ────────────────────────────────────────────────────────
const EmailStep = ({ onSent, onBack }) => {
  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setError("Please enter your email address."); return; }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(trimmed)) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: trimmed }),
      });

      // Always show the "sent" screen regardless of whether the email exists —
      // this prevents email enumeration attacks.
      if (res.status === 401) {
        // Token expired mid-session edge case
        setError("Session error. Please try again.");
        setLoading(false);
        return;
      }

      // 200, 404, 422 — all show the sent screen (security best practice)
      onSent(trimmed);
    } catch {
      setError("Cannot connect to server. Make sure the backend is running.");
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") handleSubmit(); };

  return (
    <Box sx={{ width: "100%", maxWidth: 340 }}>
      {/* Mobile logo */}
      <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1.5, mb: 3.5 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: "10px", backgroundColor: T.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HealthAndSafetyIcon sx={{ fontSize: 20, color: "#fff" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.t1 }}>PredictHealth</Typography>
          <Typography sx={{ fontSize: 10, color: T.t4, textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Barangay Health Forecasting
          </Typography>
        </Box>
      </Box>

      {/* Heading */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: "-0.3px", mb: 0.5 }}>
          Forgot Password?
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: T.t3, lineHeight: 1.65 }}>
          Enter the email address linked to your account and we'll send you a password reset link.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: "9px", fontSize: 12, py: 0.5 }}>
          {error}
        </Alert>
      )}

      {/* Email field */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.t2, mb: 0.75 }}>
          Email Address
        </Typography>
        <TextField
          fullWidth
          placeholder="Enter your registered email"
          variant="outlined"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          onKeyPress={handleKey}
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

      {/* Submit */}
      <Button
        fullWidth
        variant="contained"
        onClick={handleSubmit}
        disabled={loading}
        endIcon={!loading && <ArrowForwardIcon sx={{ fontSize: 16 }} />}
        sx={{
          py: 1.15, backgroundColor: T.blue, fontSize: 13.5, fontWeight: 700,
          textTransform: "none", borderRadius: "9px",
          boxShadow: "0 2px 12px rgba(27,79,138,0.28)", letterSpacing: "0.1px",
          "&:hover": { backgroundColor: T.blueMid, boxShadow: "0 4px 18px rgba(27,79,138,0.36)", transform: "translateY(-1px)" },
          "&:active": { transform: "translateY(0px)" },
          "&:disabled": { backgroundColor: T.blue, opacity: 0.65 },
          transition: "all 0.18s ease",
        }}
      >
        {loading ? "Sending…" : "Send Reset Link"}
      </Button>

      {/* Back to login */}
      <Button
        fullWidth
        variant="text"
        onClick={onBack}
        startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />}
        sx={{
          mt: 1.5, py: 1, fontSize: 13, fontWeight: 600, textTransform: "none",
          color: T.t3, borderRadius: "9px",
          "&:hover": { backgroundColor: "rgba(0,0,0,0.04)", color: T.t2 },
        }}
      >
        Back to Sign In
      </Button>

      <Typography sx={{ fontSize: 11, color: T.t4, textAlign: "center", mt: 1.5, lineHeight: 1.6 }}>
        Authorized barangay health personnel only.
      </Typography>
    </Box>
  );
};

// ── Step 2: Email sent confirmation ──────────────────────────────────────────
const SentStep = ({ email, onBack, onResend }) => {
  const [resending,  setResending]  = useState(false);
  const [resent,     setResent]     = useState(false);
  const [countdown,  setCountdown]  = useState(0);

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    setResent(false);
    try {
      await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setResending(false);
    setResent(true);
    // Cooldown: 60 seconds before user can resend again
    setCountdown(60);
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(tick); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 340 }}>
      {/* Mobile logo */}
      <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1.5, mb: 3.5 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: "10px", backgroundColor: T.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HealthAndSafetyIcon sx={{ fontSize: 20, color: "#fff" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.t1 }}>PredictHealth</Typography>
          <Typography sx={{ fontSize: 10, color: T.t4, textTransform: "uppercase", letterSpacing: "0.8px" }}>Barangay Health Forecasting</Typography>
        </Box>
      </Box>

      {/* Icon */}
      <Box sx={{
        width: 64, height: 64, borderRadius: "16px", backgroundColor: "#EFF6FF",
        border: "1.5px solid #BFDBFE", display: "flex", alignItems: "center",
        justifyContent: "center", mb: 2.5,
      }}>
        <MarkEmailReadIcon sx={{ fontSize: 30, color: T.blue }} />
      </Box>

      {/* Heading */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: "-0.3px", mb: 0.5 }}>
          Check Your Email
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: T.t3, lineHeight: 1.7 }}>
          If <Box component="span" sx={{ fontWeight: 600, color: T.t2 }}>{email}</Box> is registered, a reset link has been sent. Check your inbox and spam folder.
        </Typography>
      </Box>

      {/* Info box */}
      <Box sx={{
        p: "12px 14px", borderRadius: "9px",
        backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE",
        mb: 3,
      }}>
        <Typography sx={{ fontSize: 12, color: T.blue, lineHeight: 1.65 }}>
          🔒 The link expires in <strong>30 minutes</strong>. Click it promptly to reset your password.
        </Typography>
      </Box>

      {resent && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: "9px", fontSize: 12, py: 0.5 }}>
          Reset link resent successfully.
        </Alert>
      )}

      {/* Resend */}
      <Button
        fullWidth
        variant="outlined"
        onClick={handleResend}
        disabled={resending || countdown > 0}
        sx={{
          py: 1.1, fontSize: 13, fontWeight: 600, textTransform: "none",
          borderRadius: "9px", borderColor: T.border, color: T.t2,
          "&:hover": { borderColor: T.blue, color: T.blue, backgroundColor: "#EFF6FF" },
          "&:disabled": { borderColor: T.border, color: T.t4 },
          mb: 1.25,
        }}
      >
        {resending
          ? "Resending…"
          : countdown > 0
            ? `Resend in ${countdown}s`
            : "Resend Reset Link"}
      </Button>

      {/* Back to login */}
      <Button
        fullWidth
        variant="text"
        onClick={onBack}
        startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />}
        sx={{
          py: 1, fontSize: 13, fontWeight: 600, textTransform: "none",
          color: T.t3, borderRadius: "9px",
          "&:hover": { backgroundColor: "rgba(0,0,0,0.04)", color: T.t2 },
        }}
      >
        Back to Sign In
      </Button>

      <Typography sx={{ fontSize: 11, color: T.t4, textAlign: "center", mt: 1.5, lineHeight: 1.6 }}>
        Authorized barangay health personnel only.
      </Typography>
    </Box>
  );
};

// ── Step 3: Reset password form (reached via link with ?token=) ───────────────
// Wire this step by reading `token` from the URL in your router and passing it as prop.
const ResetStep = ({ token, onDone, onBack }) => {
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8)               s++;
    if (/[A-Z]/.test(password))            s++;
    if (/[0-9]/.test(password))            s++;
    if (/[^A-Za-z0-9]/.test(password))    s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#EF4444", "#F59E0B", "#3B82F6", "#22C55E"][strength];

  const handleReset = async () => {
    if (!password)            { setError("Please enter a new password."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Reset failed. The link may have expired.");
        setLoading(false);
        return;
      }
      onDone();
    } catch {
      setError("Cannot connect to server. Make sure the backend is running.");
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 340 }}>
      {/* Mobile logo */}
      <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1.5, mb: 3.5 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: "10px", backgroundColor: T.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HealthAndSafetyIcon sx={{ fontSize: 20, color: "#fff" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.t1 }}>PredictHealth</Typography>
          <Typography sx={{ fontSize: 10, color: T.t4, textTransform: "uppercase", letterSpacing: "0.8px" }}>Barangay Health Forecasting</Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: "-0.3px", mb: 0.5 }}>
          Set New Password
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: T.t3 }}>
          Choose a strong password for your PredictHealth account.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: "9px", fontSize: 12, py: 0.5 }}>
          {error}
        </Alert>
      )}

      {/* New password */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.t2, mb: 0.75 }}>New Password</Typography>
        <TextField
          fullWidth placeholder="Enter new password"
          type={showPass ? "text" : "password"}
          variant="outlined" value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 16, color: T.t4 }} /></InputAdornment>,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPass(v => !v)} edge="end" size="small" tabIndex={-1}
                  sx={{ color: T.t4, "&:hover": { backgroundColor: "transparent", color: T.t3 } }} disableRipple>
                  {showPass ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={fieldSx}
        />
        {/* Strength bar */}
        {password.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: "flex", gap: "4px", mb: 0.5 }}>
              {[1, 2, 3, 4].map(i => (
                <Box key={i} sx={{
                  flex: 1, height: 3, borderRadius: 2,
                  backgroundColor: i <= strength ? strengthColor : T.border,
                  transition: "background-color 0.2s",
                }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: 10.5, color: strengthColor, fontWeight: 600 }}>
              {strengthLabel}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Confirm password */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.t2, mb: 0.75 }}>Confirm Password</Typography>
        <TextField
          fullWidth placeholder="Re-enter new password"
          type={showConfirm ? "text" : "password"}
          variant="outlined" value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 16, color: T.t4 }} /></InputAdornment>,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowConfirm(v => !v)} edge="end" size="small" tabIndex={-1}
                  sx={{ color: T.t4, "&:hover": { backgroundColor: "transparent", color: T.t3 } }} disableRipple>
                  {showConfirm ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            ...fieldSx,
            "& .MuiOutlinedInput-root": {
              ...fieldSx["& .MuiOutlinedInput-root"],
              // Highlight confirm field green when matching, red when not (only after typing)
              ...(confirm.length > 0 && {
                "& fieldset": {
                  borderColor: password === confirm ? "#22C55E" : "#EF4444",
                  borderWidth: 1.5,
                },
              }),
            },
          }}
        />
        {confirm.length > 0 && password !== confirm && (
          <Typography sx={{ fontSize: 11, color: "#EF4444", mt: 0.5 }}>Passwords do not match.</Typography>
        )}
      </Box>

      <Button
        fullWidth variant="contained" onClick={handleReset} disabled={loading}
        endIcon={!loading && <ArrowForwardIcon sx={{ fontSize: 16 }} />}
        sx={{
          py: 1.15, backgroundColor: T.blue, fontSize: 13.5, fontWeight: 700,
          textTransform: "none", borderRadius: "9px",
          boxShadow: "0 2px 12px rgba(27,79,138,0.28)", letterSpacing: "0.1px",
          "&:hover": { backgroundColor: T.blueMid, boxShadow: "0 4px 18px rgba(27,79,138,0.36)", transform: "translateY(-1px)" },
          "&:active": { transform: "translateY(0px)" },
          "&:disabled": { backgroundColor: T.blue, opacity: 0.65 },
          transition: "all 0.18s ease",
          mb: 1.5,
        }}
      >
        {loading ? "Updating…" : "Update Password"}
      </Button>

      <Button fullWidth variant="text" onClick={onBack}
        startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />}
        sx={{ py: 1, fontSize: 13, fontWeight: 600, textTransform: "none", color: T.t3, borderRadius: "9px",
          "&:hover": { backgroundColor: "rgba(0,0,0,0.04)", color: T.t2 } }}>
        Back to Sign In
      </Button>
    </Box>
  );
};

// ── Step 4: Success screen after reset ────────────────────────────────────────
const DoneStep = ({ onBack }) => (
  <Box sx={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
    <Box sx={{
      width: 64, height: 64, borderRadius: "50%",
      backgroundColor: "#F0FDF4", border: "1.5px solid #BBF7D0",
      display: "flex", alignItems: "center", justifyContent: "center",
      mx: "auto", mb: 2.5,
    }}>
      <CheckCircleIcon sx={{ fontSize: 32, color: "#22C55E" }} />
    </Box>
    <Typography sx={{ fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: "-0.3px", mb: 0.75 }}>
      Password Updated!
    </Typography>
    <Typography sx={{ fontSize: 12.5, color: T.t3, lineHeight: 1.7, mb: 3 }}>
      Your password has been successfully reset. You can now sign in with your new password.
    </Typography>
    <Button fullWidth variant="contained" onClick={onBack}
      endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
      sx={{
        py: 1.15, backgroundColor: T.blue, fontSize: 13.5, fontWeight: 700,
        textTransform: "none", borderRadius: "9px",
        boxShadow: "0 2px 12px rgba(27,79,138,0.28)",
        "&:hover": { backgroundColor: T.blueMid, transform: "translateY(-1px)" },
        "&:active": { transform: "translateY(0px)" },
        transition: "all 0.18s ease",
      }}>
      Back to Sign In
    </Button>
  </Box>
);

// ── ForgotPassword — main export ──────────────────────────────────────────────
// Props:
//   onBack  — called to return to Login
//   token   — optional; if provided, starts at 'reset' step (password reset via link)
const ForgotPassword = ({ onBack, token = null }) => {
  // If a reset token is already present (user came from email link), jump to reset step
  const [step,  setStep]  = useState(token ? "reset" : "email");
  const [email, setEmail] = useState("");

  return (
    <Box sx={{
      minHeight: "100vh",
      display: "flex",
      backgroundColor: T.sidebarBg,
      overflow: "hidden",
    }}>
      <LeftPanel />

      {/* Right panel */}
      <Box sx={{
        width: { xs: "100%", md: 420 },
        flexShrink: 0,
        backgroundColor: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: "36px",
        py: 4,
      }}>
        {step === "email" && (
          <EmailStep
            onSent={(addr) => { setEmail(addr); setStep("sent"); }}
            onBack={onBack}
          />
        )}
        {step === "sent" && (
          <SentStep
            email={email}
            onBack={onBack}
            onResend={() => {}}
          />
        )}
        {step === "reset" && (
          <ResetStep
            token={token}
            onDone={() => setStep("done")}
            onBack={onBack}
          />
        )}
        {step === "done" && (
          <DoneStep onBack={onBack} />
        )}
      </Box>
    </Box>
  );
};

export default ForgotPassword;
