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
    primary: {
      main: '#4A90E2',
    },
    secondary: {
      main: '#E94E77',
    },
    background: {
      default: '#F5F7FA',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
  },
});

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleLogin = (success) => {
    setIsLoggedIn(success);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('dashboard');
  };

  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {currentPage === 'dashboard' ? (
        <Dashboard onNavigate={setCurrentPage} onLogout={handleLogout} />
      ) : currentPage === 'history' ? (
        <History onNavigate={setCurrentPage} onLogout={handleLogout} />
      ) : currentPage === 'prediction' ? (
        <Prediction onNavigate={setCurrentPage} onLogout={handleLogout} />
      ) : currentPage === 'dataimport' ? (
        <DataImport onNavigate={setCurrentPage} onLogout={handleLogout} />
      ) : (
        <Dashboard onNavigate={setCurrentPage} onLogout={handleLogout} />
      )}
    </ThemeProvider>
  );
}

export default App;