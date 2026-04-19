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
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

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

// ── Protected Route wrapper ───────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/" replace />;
  return children;
};

// ── Inner App (inside BrowserRouter so hooks work) ────────────────────────────
const AppInner = () => {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem("token")
  );
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [forgotInModal,  setForgotInModal]  = useState(false);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedData, setUploadedData] = useState(() => {
    try {
      const saved = localStorage.getItem("uploadedData");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Validate token on mount
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

  const handleLogout = () => {
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
    navigate("/", { replace: true });
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

  // ── Modal helpers ────────────────────────────────────────────────────────
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
    navigate("/app/dashboard", { replace: true });
  };

  // ── Public navigation (browse without login) ─────────────────────────────
  const handlePublicNavigate = (page) => {
    if (page === "login") {
      openLoginModal();
    } else if (page === "dashboard") {
      navigate("/browse");
    } else if (page === "prediction") {
      navigate("/browse/prediction");
    } else {
      openLoginModal();
    }
  };

  // ── Authenticated navigation ─────────────────────────────────────────────
  const handleNavigate = (page) => {
    const map = {
      dashboard:  "/app/dashboard",
      history:    "/app/history",
      dataimport: "/app/dataimport",
      prediction: "/app/prediction",
    };
    if (map[page]) navigate(map[page]);
  };

  const sharedProps = {
    onNavigate:   handleNavigate,
    onLogout:     handleLogout,
    uploadedFile: uploadedFile,
    uploadedData: uploadedData,
  };

  // ── Login Modal ──────────────────────────────────────────────────────────
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
    <>
      <LoginModal />

      <Routes>

        {/* ── Public pages ── */}
        <Route
          path="/"
          element={
            isAuthenticated
              ? <Navigate to="/app/dashboard" replace />
              : <Landing onGoToLogin={openLoginModal} onBrowse={() => navigate("/browse")} />
          }
        />

        <Route
          path="/browse"
          element={
            <Dashboard
              onNavigate={handlePublicNavigate}
              onLogout={openLoginModal}
              isPublic={true}
            />
          }
        />

        <Route
          path="/browse/prediction"
          element={
            <Prediction
              onNavigate={handlePublicNavigate}
              onLogout={openLoginModal}
              isPublic={true}
            />
          }
        />

        <Route
          path="/verify-email"
          element={
            <VerifyEmail
              onGoToLogin={() => {
                openLoginModal();
                navigate("/", { replace: true });
              }}
            />
          }
        />

        <Route
          path="/reset-password"
          element={
            <ForgotPassword
              token={new URLSearchParams(location.search).get("token")}
              onBack={() => navigate("/", { replace: true })}
            />
          }
        />

        {/* ── Authenticated pages ── */}
        <Route
          path="/app/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard {...sharedProps} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/history"
          element={
            <ProtectedRoute>
              <History {...sharedProps} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/dataimport"
          element={
            <ProtectedRoute>
              <DataImport {...sharedProps} onDataUploaded={handleDataUploaded} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/prediction"
          element={
            <ProtectedRoute>
              <Prediction {...sharedProps} />
            </ProtectedRoute>
          }
        />

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </>
  );
};

// ── Root App ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;