import React, { useState, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import Landing from "./Landing";
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

const getResetTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || null;
};

function App() {
  const resetToken = getResetTokenFromUrl();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("token");
  });

  const [currentPage, setCurrentPage] = useState(() => {
    if (window.location.pathname === "/reset-password" && resetToken) return "forgot";
    if (window.location.pathname === "/verify-email") return "verify-email";
    if (!!localStorage.getItem("token")) {
      return localStorage.getItem("currentPage") || "dashboard";
    }
    localStorage.removeItem("currentPage");
    return "landing";
  });

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [forgotInModal,  setForgotInModal]  = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      getCurrentUser()
        .then(() => {})
        .catch((err) => {
          const isAuthError =
            err.message?.includes("Session expired") ||
            err.message?.includes("Not logged in");
          if (isAuthError) handleLogout();
        });
    }
  }, [isAuthenticated]);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedData, setUploadedData] = useState(() => {
    try {
      const saved = localStorage.getItem("uploadedData");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
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
    setCurrentPage("landing");
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

  const openLoginModal = () => {
    setForgotInModal(false);
    setLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setLoginModalOpen(false);
    setForgotInModal(false);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setLoginModalOpen(false);
    setForgotInModal(false);
    handleNavigate("dashboard");
  };

  const handlePublicNavigate = (page) => {
    if (page === "login") {
      openLoginModal();
    } else if (page === "dashboard") {
      setCurrentPage("browse");
    } else if (page === "prediction") {
      setCurrentPage("browse-prediction");
    } else {
      openLoginModal();
    }
  };

  const sharedProps = {
    onNavigate:   handleNavigate,
    onLogout:     handleLogout,
    uploadedFile: uploadedFile,
    uploadedData: uploadedData,
  };

  // ── Login modal ────────────────────────────────────────────────────────────
  const LoginModal = () => (
    <Dialog
      open={loginModalOpen}
      onClose={closeLoginModal}
      maxWidth={false}
      PaperProps={{
        sx: {
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          width: 400,
          m: 2,
        },
      }}
    >
      {/* Close button */}
      <Box sx={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}>
        <IconButton
          onClick={closeLoginModal}
          size="small"
          sx={{
            backgroundColor: "rgba(0,0,0,0.06)",
            color: "#64748B",
            "&:hover": { backgroundColor: "rgba(0,0,0,0.12)" },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        {forgotInModal ? (
          <ForgotPassword
            token={null}
            onBack={() => setForgotInModal(false)}
          />
        ) : (
          <Login
            onLogin={handleLoginSuccess}
            onGoToRegister={null}
            onForgotPassword={() => setForgotInModal(true)}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <LoginModal />

      <div>
        {currentPage === "landing" && (
          <Landing
            onGoToLogin={openLoginModal}
            onBrowse={() => setCurrentPage("browse")}
          />
        )}

        {currentPage === "browse" && (
          <Dashboard
            onNavigate={handlePublicNavigate}
            onLogout={openLoginModal}
            isPublic={true}
          />
        )}

        {currentPage === "browse-prediction" && (
          <Prediction
            onNavigate={handlePublicNavigate}
            onLogout={openLoginModal}
            isPublic={true}
          />
        )}

        {currentPage === "verify-email" && (
          <VerifyEmail
            onGoToLogin={() => {
              window.history.replaceState({}, "", "/");
              openLoginModal();
              setCurrentPage("landing");
            }}
          />
        )}

        {currentPage === "forgot" && (
          <ForgotPassword
            token={resetToken}
            onBack={() => {
              if (resetToken) window.history.replaceState({}, "", "/");
              setCurrentPage("landing");
            }}
          />
        )}

        {currentPage === "dashboard"  && <Dashboard  {...sharedProps} />}
        {currentPage === "history"    && <History    {...sharedProps} />}
        {currentPage === "dataimport" && (
          <DataImport {...sharedProps} onDataUploaded={handleDataUploaded} />
        )}
        {currentPage === "prediction" && <Prediction {...sharedProps} />}
      </div>
    </ThemeProvider>
  );
}

export default App;