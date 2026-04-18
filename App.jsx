import React, { useState, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Login from "./Login";
import Dashboard from "./Dashboard";
import History from "./History";
import Prediction from "./Prediction";
import DataImport from "./DataImport";
import VerifyEmail from "./VerifyEmail";
import ForgotPassword from "./ForgotPassword";
import { getCurrentUser } from "./services/api";

const theme = createTheme({
  palette: {
    primary: { main: "#4A90E2" },
    secondary: { main: "#E94E77" },
    background: { default: "#F5F7FA" },
  },
  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: "none", fontWeight: 500 },
      },
    },
  },
});

// ── Read reset token from URL (?token=xxx) ────────────────────────────────────
// If present the user arrived from a password-reset email link.
const getResetTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || null;
};

function App() {
  // ── Detect special entry URLs ─────────────────────────────────────────────
  const resetToken = getResetTokenFromUrl();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem("token");
    return !!token;
  });

const [currentPage, setCurrentPage] = useState(() => {
    if (window.location.pathname === "/reset-password" && resetToken) {
      return "forgot";
    }
    if (window.location.pathname === "/verify-email") {
      return "verify-email";
    }
    if (!isAuthenticated) {
      localStorage.removeItem("currentPage");
      return "browse";
    }
    return localStorage.getItem("currentPage") || "dashboard";
  });

  // Validate token on app load
// Palitan ang useEffect sa App.jsx:
useEffect(() => {
  if (isAuthenticated) {
    getCurrentUser()
      .then(() => {})
      .catch((err) => {
        // Logout ONLY sa actual auth errors, hindi sa network/CORS errors
        const isAuthError =
          err.message?.includes("Session expired") ||
          err.message?.includes("Not logged in");
        
        if (isAuthError) {
          setIsAuthenticated(false);
          setCurrentPage("login");
          localStorage.removeItem("currentPage");
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          localStorage.removeItem("role");
          localStorage.removeItem("fullName");
          localStorage.removeItem("email");
        }
        // Network/CORS errors → stay logged in
      });
  }
}, [isAuthenticated]);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedData, setUploadedData] = useState(() => {
    try {
      const saved = localStorage.getItem("uploadedData");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleNavigate = (page) => {
    localStorage.setItem("currentPage", page);
    setCurrentPage(page);
  };

  const handleLogout = () => {
    localStorage.removeItem("currentPage");
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem("fullName");
    localStorage.removeItem("email");
    localStorage.removeItem("uploadedData");
    localStorage.removeItem("availableBarangays");
    localStorage.removeItem("diseaseColumns");
    localStorage.removeItem("datasetCity");
    localStorage.removeItem("datasetStartDate");
    localStorage.removeItem("datasetEndDate");
    setUploadedFile(null);
    setUploadedData(null);
    setIsAuthenticated(false);
    setCurrentPage("login");
  };

  const handleDataUploaded = (data) => {
    setUploadedFile(data.file);
    setUploadedData({
      file:       data.file,
      fileName:   data.file?.name,
      fileSize:   data.file?.size,
      uploadDate: data.uploadDate,
    });
  };

  const sharedProps = {
    onNavigate:   handleNavigate,
    onLogout:     handleLogout,
    uploadedFile: uploadedFile,
    uploadedData: uploadedData,
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div>
        {currentPage === "browse" && (
  <Dashboard
    onNavigate={(page) => {
      if (page === "login") setCurrentPage("login");
    }}
    onLogout={() => setCurrentPage("login")}
    isPublic={true}
  />
)}

        {currentPage === "login" && (
          <Login
            onLogin={() => {
              setIsAuthenticated(true);
              handleNavigate("dashboard");
            }}
            onGoToRegister={null}
            onForgotPassword={() => setCurrentPage("forgot")}
          />
        )}

    

        {currentPage === "verify-email" && (
          <VerifyEmail
            onGoToLogin={() => {
              window.history.replaceState({}, "", "/");
              setCurrentPage("login");
            }}
          />
        )}

        {currentPage === "forgot" && (
          <ForgotPassword
            // If user arrived via reset-password link, pass the token so
            // ForgotPassword skips straight to the "Set New Password" step.
            token={resetToken}
            onBack={() => {
              // Clean up the URL if we came from a reset link
              if (resetToken) {
                window.history.replaceState({}, "", "/");
              }
              setCurrentPage("login");
            }}
          />
        )}

        {currentPage === "dashboard" && <Dashboard {...sharedProps} />}

        {currentPage === "history" && <History {...sharedProps} />}

        {currentPage === "dataimport" && (
          <DataImport {...sharedProps} onDataUploaded={handleDataUploaded} />
        )}

        {currentPage === "prediction" && <Prediction {...sharedProps} />}
      </div>
    </ThemeProvider>
  );
}

export default App;