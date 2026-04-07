import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import { CheckCircle, Error as ErrorIcon } from "@mui/icons-material";

const API_BASE_URL = "http://localhost:5000/api";

const VerifyEmail = ({ onGoToLogin }) => {
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the URL.");
      return;
    }

    fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatus("error");
          setMessage(data.error);
        } else {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
          // Clean up the URL
          window.history.replaceState({}, "", "/");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage(
          "Cannot connect to server. Make sure the backend is running.",
        );
      });
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F4F6F8",
      }}
    >
      <Box
        sx={{
          backgroundColor: "#fff",
          borderRadius: 3,
          p: 5,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          textAlign: "center",
          maxWidth: 440,
          width: "100%",
        }}
      >
        {status === "loading" && (
          <>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6">Verifying your email...</Typography>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle sx={{ fontSize: 56, color: "#4CAF50", mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              Email Verified!
            </Typography>
            <Alert severity="success" sx={{ mb: 3 }}>
              {message}
            </Alert>
            <Button
              variant="contained"
              onClick={onGoToLogin}
              sx={{ borderRadius: 2, px: 4, textTransform: "none" }}
            >
              Go to Login
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <ErrorIcon sx={{ fontSize: 56, color: "#E94E77", mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              Verification Failed
            </Typography>
            <Alert severity="error" sx={{ mb: 3 }}>
              {message}
            </Alert>
            <Button
              variant="outlined"
              onClick={onGoToLogin}
              sx={{ borderRadius: 2, px: 4, textTransform: "none" }}
            >
              Go to Login
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
};

export default VerifyEmail;
