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
  const [currentPage, setCurrentPage] = useState(
    () => localStorage.getItem('currentPage') || 'login'
  );

  const [uploadedFile, setUploadedFile] = useState(null);

  // ── uploadedData no longer carries barangay — that's decided in Prediction now ──
  const [uploadedData, setUploadedData] = useState(() => {
    const saved = localStorage.getItem('uploadedData');
    return saved ? JSON.parse(saved) : null;
  });

  const handleNavigate = (page) => {
    localStorage.setItem('currentPage', page);
    setCurrentPage(page);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentPage');
    setCurrentPage('login');
  };

  const handleDataUploaded = (data) => {
    setUploadedFile(data.file);
    // Store file + uploadDate only — barangay selection happens in Prediction
    setUploadedData({ file: data.file, uploadDate: data.uploadDate });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div>
        {currentPage === 'login' && (
          <Login onLogin={() => handleNavigate('dashboard')} />
        )}

        {currentPage === 'dashboard' && (
          <Dashboard
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        )}

        {currentPage === 'history' && (
          <History
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        )}

        {currentPage === 'dataimport' && (
          <DataImport
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onDataUploaded={handleDataUploaded}
          />
        )}

        {currentPage === 'prediction' && (
          <Prediction
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            uploadedFile={uploadedFile}
            uploadedData={uploadedData}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;