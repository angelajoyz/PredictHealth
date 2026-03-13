import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Login from './Login';
import Dashboard from './Dashboard';
import History from './History';
import Prediction from './Prediction';
import DataImport from './DataImport';

const theme = createTheme({
  palette: {
    primary: { main: '#4A90E2' },
    secondary: { main: '#E94E77' },
    background: { default: '#F5F7FA' },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: 'none', fontWeight: 500 },
      },
    },
  },
});

function App() {
  // ── Restore page only if valid JWT exists ──────────────────
  const [currentPage, setCurrentPage] = useState(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.removeItem('currentPage');
      return 'login';
    }
    return localStorage.getItem('currentPage') || 'dashboard';
  });

  // ── uploadedFile: actual File object (lost on refresh — normal) ──
  const [uploadedFile, setUploadedFile] = useState(null);

  // ── uploadedData: metadata from localStorage (survives refresh) ──
  const [uploadedData, setUploadedData] = useState(() => {
    try {
      const saved = localStorage.getItem('uploadedData');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleNavigate = (page) => {
    localStorage.setItem('currentPage', page);
    setCurrentPage(page);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentPage');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    localStorage.removeItem('uploadedData');
    localStorage.removeItem('availableBarangays');
    localStorage.removeItem('diseaseColumns');
    localStorage.removeItem('datasetCity');
    localStorage.removeItem('datasetStartDate');
    localStorage.removeItem('datasetEndDate');
    setUploadedFile(null);
    setUploadedData(null);
    setCurrentPage('login');
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

  // ── Shared props for all authenticated pages ───────────────
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
        {currentPage === 'login' && (
          <Login onLogin={() => handleNavigate('dashboard')} />
        )}

        {currentPage === 'dashboard' && (
          // ✅ FIXED: uploadedFile at uploadedData ay pinapasa na
          <Dashboard {...sharedProps} />
        )}

        {currentPage === 'history' && (
          <History {...sharedProps} />
        )}

        {currentPage === 'dataimport' && (
          <DataImport
            {...sharedProps}
            onDataUploaded={handleDataUploaded}
          />
        )}

        {currentPage === 'prediction' && (
          <Prediction {...sharedProps} />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;