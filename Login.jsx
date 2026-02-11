import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import './Dashboard.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    // Only admin credentials
    if (username === 'admin' && password === 'admin123') {
      onLogin(true);
    } else {
      setError('Invalid username or password');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #E8EAF6 0%, #C5CAE9 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2,
    }}>
      <Card sx={{ 
        maxWidth: 420,
        width: '100%',
        borderRadius: 4, 
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
      }}>
        <CardContent sx={{ p: 5, textAlign: 'center' }}>
          {/* Logo/Icon */}
          <Box sx={{
            width: 80,
            height: 80,
            background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 4px 16px rgba(74, 144, 226, 0.3)',
          }}>
            <DashboardIcon sx={{ fontSize: 48, color: 'white' }} />
          </Box>

          {/* Title */}
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Health Dashboard
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
            Barangay Health Prediction System
          </Typography>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          {/* Username Field */}
          <Box sx={{ mb: 3, textAlign: 'left' }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Username
            </Typography>
            <TextField
              fullWidth
              placeholder="Enter your username"
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: '#999' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }}
            />
          </Box>

          {/* Password Field */}
          <Box sx={{ mb: 4, textAlign: 'left' }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Password
            </Typography>
            <TextField
              fullWidth
              placeholder="Enter your password"
              type={showPassword ? 'text' : 'password'}
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: '#999' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }}
            />
          </Box>

          {/* Sign In Button */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleLogin}
            sx={{
              py: 1.5,
              background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
              fontSize: '16px',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              boxShadow: '0 4px 12px rgba(74, 144, 226, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #357ABD 0%, #2868A8 100%)',
                boxShadow: '0 6px 20px rgba(74, 144, 226, 0.4)',
              }
            }}
          >
            Sign in
          </Button>

          {/* Footer Text */}
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 4 }}>
            Authorized personnel only. <br />
            Unauthorized access is prohibited.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;