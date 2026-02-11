import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Avatar,
  Button,
  Chip,
  Grid,
  Alert,
  Divider,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  People as PeopleIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  CloudUpload as CloudUploadIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  CalendarMonth as CalendarMonthIcon,
  Biotech as BiotechIcon,
  InfoOutlined as InfoOutlinedIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const Dashboard = ({ onNavigate, onLogout }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const menuItems = [
    { icon: <DashboardIcon />, text: 'Dashboard', active: true },
    { icon: <TrendingUpIcon />, text: 'Prediction', active: false },
    { icon: <HistoryIcon />, text: 'History', active: false },
    { icon: <CloudUploadIcon />, text: 'Data Import', active: false },
  ];

  // System Overview Data (from History data)
  const systemOverview = {
    selectedDisease: 'Dengue',
    latestMonth: 'March 2026',
    totalCases: 210,
    trendDirection: 'increasing', // increasing, decreasing, stable
    trendPercentage: '+16.7%',
  };

  // Mini trend data (last 6 months from History)
  const miniTrendData = [
    { month: 'Oct', cases: 180 },
    { month: 'Nov', cases: 190 },
    { month: 'Dec', cases: 200 },
    { month: 'Jan', cases: 195 },
    { month: 'Feb', cases: 175 },
    { month: 'Mar', cases: 210 },
  ];

  // Prediction snapshot (summary from Prediction page)
  const predictionSnapshot = {
    nextForecastValue: 245,
    forecastMonth: 'April 2026',
    trendIndicator: 'increase', // increase, decrease, stable
    shortText: 'Forecast indicates a possible increase in cases next month',
  };

  // Data status
  const dataStatus = {
    datasetLoaded: true,
    lastUploadDate: 'March 15, 2026',
    dataRange: '2019 - 2026',
    totalRecords: 2840,
  };

  const getTrendIcon = (direction) => {
    switch(direction) {
      case 'increasing':
        return <TrendingUpIcon sx={{ fontSize: 20 }} />;
      case 'decreasing':
        return <TrendingDownIcon sx={{ fontSize: 20 }} />;
      case 'stable':
        return <RemoveIcon sx={{ fontSize: 20 }} />;
      default:
        return <RemoveIcon sx={{ fontSize: 20 }} />;
    }
  };

  const getTrendColor = (direction) => {
    switch(direction) {
      case 'increasing':
        return { bg: '#FFEBEE', color: '#F44336' };
      case 'decreasing':
        return { bg: '#E8F5E9', color: '#4CAF50' };
      case 'stable':
        return { bg: '#F5F5F5', color: '#757575' };
      default:
        return { bg: '#F5F5F5', color: '#757575' };
    }
  };

  return (
    <Box className="dashboard-container">
      {/* Sidebar */}
      <Box className="sidebar">
        <Box className="sidebar-logo">
          <Box className="logo-icon">
            <HealthAndSafetyIcon sx={{ fontSize: 28, color: '#4A90E2' }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" className="logo-title">Barangay Health</Typography>
            <Typography variant="caption" className="logo-subtitle">Prediction System</Typography>
          </Box>
        </Box>

        <Box className="sidebar-navigation">
          <Typography variant="caption" className="nav-label">Navigation</Typography>
          {menuItems.map((item, index) => (
            <Box 
              key={index} 
              className={`nav-item ${item.active ? 'active' : ''}`}
              onClick={() => {
                if (item.text === 'History') onNavigate?.('history');
                if (item.text === 'Dashboard') onNavigate?.('dashboard');
                if (item.text === 'Prediction') onNavigate?.('prediction');
                if (item.text === 'Data Import') onNavigate?.('dataimport');
              }}
            >
              <Box className="nav-icon">{item.icon}</Box>
              <Typography>{item.text}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Main Content */}
      <Box className="main-content">
        {/* Header - FIXED WIDTH */}
        <Box className="dashboard-header">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" className="dashboard-title">
              Dashboard
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              System overview and health data insights
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <Avatar className="user-avatar">👤</Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  minWidth: 200,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  borderRadius: 2,
                }
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={600}>Admin User</Typography>
                <Typography variant="caption" color="textSecondary">admin@barangayhealth.gov.ph</Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => setAnchorEl(null)} sx={{ py: 1.5 }}>
                Profile Settings
              </MenuItem>
              <MenuItem onClick={() => setAnchorEl(null)} sx={{ py: 1.5 }}>
                Notifications
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); onLogout?.(); }} sx={{ py: 1.5, color: '#E94E77' }}>
                Sign Out
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* 1. System Overview Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Selected Disease</Typography>
                <Box className="stat-icon" sx={{ backgroundColor: '#4A90E215' }}>
                  <BiotechIcon sx={{ color: '#4A90E2', fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h5" className="stat-value" sx={{ fontSize: '1.5rem' }}>
                {systemOverview.selectedDisease}
              </Typography>
              <Typography variant="caption" className="stat-subtitle">
                Currently tracking
              </Typography>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Latest Recorded Month</Typography>
                <Box className="stat-icon" sx={{ backgroundColor: '#50C87815' }}>
                  <CalendarMonthIcon sx={{ color: '#50C878', fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h5" className="stat-value" sx={{ fontSize: '1.5rem' }}>
                {systemOverview.latestMonth}
              </Typography>
              <Typography variant="caption" className="stat-subtitle">
                Most recent data
              </Typography>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Total Cases (Latest Period)</Typography>
                <Box className="stat-icon" sx={{ backgroundColor: '#9B59B615' }}>
                  <PeopleIcon sx={{ color: '#9B59B6', fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h4" className="stat-value">
                {systemOverview.totalCases}
              </Typography>
              <Typography variant="caption" className="stat-subtitle">
                {systemOverview.latestMonth}
              </Typography>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Trend Direction</Typography>
                <Box className="stat-icon" sx={{ 
                  backgroundColor: getTrendColor(systemOverview.trendDirection).bg 
                }}>
                  {React.cloneElement(getTrendIcon(systemOverview.trendDirection), { 
                    sx: { color: getTrendColor(systemOverview.trendDirection).color, fontSize: 20 } 
                  })}
                </Box>
              </Box>
              <Typography variant="h5" className="stat-value" sx={{ 
                fontSize: '1.5rem',
                color: getTrendColor(systemOverview.trendDirection).color,
                textTransform: 'capitalize'
              }}>
                {systemOverview.trendDirection}
              </Typography>
              <Typography variant="caption" className="stat-subtitle">
                {systemOverview.trendPercentage} from previous
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* 2. Mini Trend Chart & 3. Prediction Snapshot Side by Side */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Mini Trend Chart */}
          <Grid item xs={12} md={7}>
            <Card className="chart-card">
              <CardContent>
                <Typography variant="h6" className="chart-title" sx={{ mb: 2 }}>
                  Recent Trend (Last 6 Months)
                </Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={miniTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      style={{ fontSize: '12px', fill: '#999' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      style={{ fontSize: '12px', fill: '#999' }} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #E8E8E8', 
                        borderRadius: '8px', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cases" 
                      stroke="#4A90E2" 
                      strokeWidth={3} 
                      dot={{ fill: '#4A90E2', r: 5 }} 
                      name="Cases"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                  At-a-glance understanding of recent behavior
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Prediction Snapshot */}
          <Grid item xs={12} md={5}>
            <Card className="chart-card" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" className="chart-title" sx={{ mb: 2 }}>
                  Prediction Snapshot
                </Typography>
                
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                    Next Forecasted Period
                  </Typography>
                  <Typography variant="h3" fontWeight={700} color="primary" sx={{ mb: 1 }}>
                    {predictionSnapshot.nextForecastValue}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {predictionSnapshot.forecastMonth}
                  </Typography>

                  <Divider sx={{ my: 3 }} />

                  <Chip
                    icon={predictionSnapshot.trendIndicator === 'increase' ? <TrendingUpIcon /> : <TrendingDownIcon />}
                    label={predictionSnapshot.trendIndicator === 'increase' ? 'Possible Increase' : 'Possible Decrease'}
                    sx={{
                      backgroundColor: predictionSnapshot.trendIndicator === 'increase' ? '#FFEBEE' : '#E8F5E9',
                      color: predictionSnapshot.trendIndicator === 'increase' ? '#F44336' : '#4CAF50',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      px: 2,
                      py: 2.5,
                    }}
                  />

                  <Typography variant="body2" color="textSecondary" sx={{ mt: 3, px: 2 }}>
                    {predictionSnapshot.shortText}
                  </Typography>

                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => onNavigate?.('prediction')}
                    sx={{ mt: 3, textTransform: 'none' }}
                  >
                    View Full Prediction
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 4. Data Status Indicator */}
        <Card className="chart-card">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StorageIcon sx={{ color: '#4A90E2', fontSize: 28 }} />
                <Typography variant="h6" className="chart-title">
                  Data Status
                </Typography>
              </Box>
              {dataStatus.datasetLoaded ? (
                <Chip 
                  icon={<StorageIcon />}
                  label="Dataset Loaded" 
                  sx={{ 
                    backgroundColor: '#E8F5E9',
                    color: '#4CAF50',
                    fontWeight: 600 
                  }}
                />
              ) : (
                <Chip 
                  label="No Dataset" 
                  sx={{ 
                    backgroundColor: '#FFF3E0',
                    color: '#FF9800',
                    fontWeight: 600 
                  }}
                />
              )}
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ 
                  p: 3, 
                  borderRadius: 2, 
                  backgroundColor: '#F5F7FA',
                  textAlign: 'center',
                }}>
                  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                    Last Upload Date
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="#4A90E2">
                    {dataStatus.lastUploadDate}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ 
                  p: 3, 
                  borderRadius: 2, 
                  backgroundColor: '#F5F7FA',
                  textAlign: 'center',
                }}>
                  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                    Data Range
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="#50C878">
                    {dataStatus.dataRange}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ 
                  p: 3, 
                  borderRadius: 2, 
                  backgroundColor: '#F5F7FA',
                  textAlign: 'center',
                }}>
                  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                    Total Records
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="#9B59B6">
                    {dataStatus.totalRecords.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ 
                  p: 3, 
                  borderRadius: 2, 
                  backgroundColor: '#F5F7FA',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Button 
                    variant="contained" 
                    startIcon={<CloudUploadIcon />}
                    onClick={() => onNavigate?.('dataimport')}
                    sx={{ 
                      textTransform: 'none',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)'
                    }}
                  >
                    Go to Data Import
                  </Button>
                </Box>
              </Grid>
            </Grid>

            <Alert 
              severity="info" 
              icon={<InfoOutlinedIcon />}
              sx={{ mt: 3, borderRadius: 2 }}
            >
              <Typography variant="body2">
                <strong>Data Awareness:</strong> All predictions and trends are based on historical data from {dataStatus.dataRange}. 
                To upload new data or update the dataset, visit the Data Import module.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Dashboard;