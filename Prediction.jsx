import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  Avatar,
  Menu,
  MenuItem as MenuItemComponent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  Psychology as PsychologyIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  PendingActions as PendingIcon,
  Error as ErrorIcon,
  CalendarMonth as CalendarIcon,
  Analytics as AnalyticsIcon,
  CloudQueue as CloudIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, ComposedChart } from 'recharts';
import './Dashboard.css';

const Prediction = ({ onNavigate, onLogout }) => {
  const [selectedDisease, setSelectedDisease] = useState('dengue');
  const [forecastHorizon, setForecastHorizon] = useState('1');
  const [selectedGeography, setSelectedGeography] = useState('city');
  const [anchorEl, setAnchorEl] = useState(null);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const menuItems = [
    { icon: <DashboardIcon />, text: 'Dashboard', active: false },
    { icon: <TrendingUpIcon />, text: 'Prediction', active: true },
    { icon: <HistoryIcon />, text: 'History', active: false },
    { icon: <CloudUploadIcon />, text: 'Data Import', active: false },
  ];

  // Disease options (from uploaded data)
  const diseases = [
    { value: 'dengue', label: 'Dengue' },
    { value: 'influenza', label: 'Influenza' },
    { value: 'flu', label: 'Flu' },
    { value: 'respiratory', label: 'Respiratory' },
    { value: 'hypertension', label: 'Hypertension' },
  ];

  // Forecast horizon options
  const forecastHorizons = [
    { value: '1', label: '1 Month Ahead' },
    { value: '3', label: '3 Months Ahead' },
    { value: '6', label: '6 Months Ahead' },
  ];

  // Geographic options
  const geographicLevels = [
    { value: 'city', label: 'City/Dataset Level (Aggregated)' },
    { value: 'barangay', label: 'Barangay' },
  ];

  // Sample prediction trend data (Actual + Predicted)
  const predictionTrendData = [
    { month: 'Jul', actual: 150, predicted: null },
    { month: 'Aug', actual: 170, predicted: null },
    { month: 'Sep', actual: 130, predicted: null },
    { month: 'Oct', actual: 180, predicted: null },
    { month: 'Nov', actual: 190, predicted: null },
    { month: 'Dec', actual: 200, predicted: null },
    { month: 'Jan', actual: 195, predicted: null },
    { month: 'Feb', actual: 175, predicted: null },
    { month: 'Mar', actual: 210, predicted: null }, // Last known
    { month: 'Apr', actual: null, predicted: 245 }, // Forecast start
    { month: 'May', actual: null, predicted: 268 },
    { month: 'Jun', actual: null, predicted: 252 },
  ];

  // Sample prediction history data
  const predictionHistory = [
    {
      id: 1,
      predictionName: 'Dengue Cases - April 2026',
      createdDate: '2026-03-15',
      createdTime: '02:30 PM',
      dataSource: 'patient_data_march_2026.csv',
      predictedValue: 245,
      confidence: 87,
      status: 'completed',
      modelUsed: 'LSTM Neural Network',
      forecastHorizon: '1 Month',
      trend: 'increase',
      insights: [
        'Patient visits expected to increase by 16.7% next month',
        'Dengue cases predicted to rise during rainy season',
        'Monitor closely in high-risk barangays'
      ]
    },
    {
      id: 2,
      predictionName: 'Dengue Cases - May 2026',
      createdDate: '2026-03-15',
      createdTime: '02:30 PM',
      dataSource: 'patient_data_march_2026.csv',
      predictedValue: 268,
      confidence: 82,
      status: 'completed',
      modelUsed: 'LSTM Neural Network',
      forecastHorizon: '2 Months',
      trend: 'increase',
      insights: [
        'Continued upward trend expected',
        'Peak season approaching',
        'Stock up on dengue test kits'
      ]
    },
    {
      id: 3,
      predictionName: 'Dengue Cases - June 2026',
      createdDate: '2026-03-15',
      createdTime: '02:30 PM',
      dataSource: 'patient_data_march_2026.csv',
      predictedValue: 252,
      confidence: 78,
      status: 'completed',
      modelUsed: 'LSTM Neural Network',
      forecastHorizon: '3 Months',
      trend: 'decrease',
      insights: [
        'Slight decline expected',
        'Seasonal pattern suggests cooling',
        'Maintain vigilance'
      ]
    },
  ];

  // Calculate prediction stats
  const totalPredictions = predictionHistory.length;
  const avgConfidence = predictionHistory.length > 0
    ? Math.round(predictionHistory.reduce((sum, item) => sum + item.confidence, 0) / predictionHistory.length)
    : 0;
  const increasingTrends = predictionHistory.filter(item => item.trend === 'increase').length;
  const decreasingTrends = predictionHistory.filter(item => item.trend === 'decrease').length;

  // Get current prediction summary
  const currentPrediction = predictionHistory[0]; // Most recent prediction

  const handleMenuClick = (event, prediction) => {
    setAnchorEl(event.currentTarget);
    setSelectedPrediction(prediction);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleView = () => {
    setViewDialogOpen(true);
    handleMenuClose();
  };

  const handleDownload = () => {
    console.log('Downloading prediction report:', selectedPrediction.predictionName);
    // TODO: Implement download functionality
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const confirmDelete = () => {
    console.log('Deleting prediction:', selectedPrediction.predictionName);
    // TODO: Implement delete functionality
    setDeleteDialogOpen(false);
    setSelectedPrediction(null);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon />;
      case 'processing':
        return <PendingIcon />;
      case 'failed':
        return <ErrorIcon />;
      default:
        return <CheckCircleIcon />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return { bg: '#E8F5E9', color: '#4CAF50' };
      case 'processing':
        return { bg: '#FFF4E5', color: '#FF9800' };
      case 'failed':
        return { bg: '#FFEBEE', color: '#F44336' };
      default:
        return { bg: '#E8F5E9', color: '#4CAF50' };
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
        {/* Header */}
        <Box className="dashboard-header">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" className="dashboard-title">Prediction</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              AI-powered disease forecasting and trend predictions
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
            <IconButton onClick={(e) => setUserMenuAnchorEl(e.currentTarget)}>
              <Avatar className="user-avatar">👤</Avatar>
            </IconButton>
            <Menu
              anchorEl={userMenuAnchorEl}
              open={Boolean(userMenuAnchorEl)}
              onClose={() => setUserMenuAnchorEl(null)}
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
              <MenuItemComponent onClick={() => setUserMenuAnchorEl(null)} sx={{ py: 1.5 }}>
                Profile Settings
              </MenuItemComponent>
              <MenuItemComponent onClick={() => setUserMenuAnchorEl(null)} sx={{ py: 1.5 }}>
                Notifications
              </MenuItemComponent>
              <Divider />
              <MenuItemComponent onClick={() => { setUserMenuAnchorEl(null); onLogout?.(); }} sx={{ py: 1.5, color: '#E94E77' }}>
                Sign Out
              </MenuItemComponent>
            </Menu>
          </Box>
        </Box>

        {/* Filters Section */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Disease Filter */}
          <Box>
            <Typography variant="caption" sx={{ color: '#757575', mb: 0.5, display: 'block', fontSize: '0.75rem' }}>
              Disease <span style={{ color: '#E94E77' }}>*</span>
            </Typography>
            <Select
              value={selectedDisease}
              onChange={(e) => setSelectedDisease(e.target.value)}
              displayEmpty
              sx={{ 
                minWidth: 160,
                height: 40,
                backgroundColor: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#E0E0E0',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#4A90E2',
                },
              }}
            >
              {diseases.map(disease => (
                <MenuItem key={disease.value} value={disease.value}>{disease.label}</MenuItem>
              ))}
            </Select>
          </Box>

          {/* Forecast Horizon Filter */}
          <Box>
            <Typography variant="caption" sx={{ color: '#757575', mb: 0.5, display: 'block', fontSize: '0.75rem' }}>
              Forecast Horizon
            </Typography>
            <Select
              value={forecastHorizon}
              onChange={(e) => setForecastHorizon(e.target.value)}
              displayEmpty
              sx={{ 
                minWidth: 180,
                height: 40,
                backgroundColor: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#E0E0E0',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#4A90E2',
                },
              }}
            >
              {forecastHorizons.map(horizon => (
                <MenuItem key={horizon.value} value={horizon.value}>{horizon.label}</MenuItem>
              ))}
            </Select>
          </Box>

          {/* Geographic Level Filter */}
          <Box>
            <Typography variant="caption" sx={{ color: '#757575', mb: 0.5, display: 'block', fontSize: '0.75rem' }}>
              Geographic Level
            </Typography>
            <Select
              value={selectedGeography}
              onChange={(e) => setSelectedGeography(e.target.value)}
              displayEmpty
              sx={{ 
                minWidth: 220,
                height: 40,
                backgroundColor: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#E0E0E0',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#4A90E2',
                },
              }}
            >
              {geographicLevels.map(level => (
                <MenuItem key={level.value} value={level.value}>{level.label}</MenuItem>
              ))}
            </Select>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Next Period Forecast</Typography>
                <Box className="stat-icon" sx={{ backgroundColor: '#4A90E215' }}>
                  <PsychologyIcon sx={{ color: '#4A90E2', fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h4" className="stat-value">{currentPrediction?.predictedValue || 245}</Typography>
              <Typography variant="caption" className="stat-subtitle">
                Predicted cases ({forecastHorizon} month{forecastHorizon !== '1' ? 's' : ''} ahead)
              </Typography>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Trend Indicator</Typography>
                <Box className="stat-icon" sx={{ 
                  backgroundColor: currentPrediction?.trend === 'increase' ? '#FFEBEE' : '#E8F5E9'
                }}>
                  {currentPrediction?.trend === 'increase' ? (
                    <ArrowUpwardIcon sx={{ color: '#F44336', fontSize: 20 }} />
                  ) : (
                    <ArrowDownwardIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
                  )}
                </Box>
              </Box>
              <Typography variant="h4" className="stat-value">
                {currentPrediction?.trend === 'increase' ? '+16.7%' : '-6.0%'}
              </Typography>
              <Typography variant="caption" className="stat-subtitle">
                {currentPrediction?.trend === 'increase' ? 'Increasing' : 'Decreasing'} from last period
              </Typography>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Model Confidence</Typography>
                <Box className="stat-icon" sx={{ backgroundColor: '#50C87815' }}>
                  <AnalyticsIcon sx={{ color: '#50C878', fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h4" className="stat-value">{currentPrediction?.confidence || 87}%</Typography>
              <Typography variant="caption" className="stat-subtitle">
                Prediction accuracy
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Prediction Trend Chart */}
        <Card className="chart-card" sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" className="chart-title">
                Predicted Trend - {selectedDisease.charAt(0).toUpperCase() + selectedDisease.slice(1)}
              </Typography>
              <Chip 
                label="Actual vs Predicted" 
                size="small"
                sx={{ backgroundColor: '#E3F2FD', color: '#4A90E2', fontWeight: 500 }}
              />
            </Box>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={predictionTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: '#999' }} />
                <YAxis axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: '#999' }} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E8E8E8', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                <Bar dataKey="actual" fill="#4A90E2" name="Actual Cases" radius={[8, 8, 0, 0]} />
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="#FF6B6B" 
                  name="Predicted Cases"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#FF6B6B' }}
                  strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>
            <Box sx={{ mt: 2, p: 2, backgroundColor: '#F5F5F5', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#757575', display: 'block', mb: 1 }}>
                Key Insights
              </Typography>
              {currentPrediction?.insights.map((insight, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
                  <Box sx={{ 
                    width: 6, 
                    height: 6, 
                    borderRadius: '50%', 
                    backgroundColor: '#4A90E2',
                    mt: 0.7,
                    flexShrink: 0
                  }} />
                  <Typography variant="body2" color="textSecondary">{insight}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Prediction History Table */}
        <Card className="chart-card">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" className="chart-title">
                Forecast Details
              </Typography>
              {predictionHistory.length > 0 && (
                <Chip 
                  label={`${predictionHistory.length} forecast${predictionHistory.length > 1 ? 's' : ''}`} 
                  size="small"
                  sx={{ backgroundColor: '#E3F2FD', color: '#4A90E2', fontWeight: 500 }}
                />
              )}
            </Box>

            {predictionHistory.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <PsychologyIcon sx={{ fontSize: 64, color: '#E0E0E0', mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  No predictions available
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Generate a prediction to see forecast details
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Forecast Period</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Predicted Value</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Trend</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Confidence</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {predictionHistory.map((prediction) => (
                      <TableRow key={prediction.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PsychologyIcon sx={{ color: '#4A90E2', fontSize: 20 }} />
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {prediction.predictionName}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {prediction.forecastHorizon}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="h6" fontWeight={600} color="primary">
                            {prediction.predictedValue}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={prediction.trend === 'increase' ? 'Increasing' : 'Decreasing'}
                            size="small"
                            icon={prediction.trend === 'increase' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
                            sx={{
                              backgroundColor: prediction.trend === 'increase' ? '#FFEBEE' : '#E8F5E9',
                              color: prediction.trend === 'increase' ? '#F44336' : '#4CAF50',
                              fontWeight: 500,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flex: 1, maxWidth: 80 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={prediction.confidence} 
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: '#E8E8E8',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: prediction.confidence >= 85 ? '#4CAF50' : prediction.confidence >= 70 ? '#FF9800' : '#F44336',
                                    borderRadius: 3,
                                  }
                                }}
                              />
                            </Box>
                            <Typography variant="body2" fontWeight={500}>
                              {prediction.confidence}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={prediction.status}
                            size="small"
                            icon={getStatusIcon(prediction.status)}
                            sx={{
                              backgroundColor: getStatusColor(prediction.status).bg,
                              color: getStatusColor(prediction.status).color,
                              fontWeight: 500,
                              textTransform: 'capitalize',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, prediction)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItemComponent onClick={handleView}>
          <VisibilityIcon sx={{ mr: 1, fontSize: 20 }} />
          View Details
        </MenuItemComponent>
        <MenuItemComponent onClick={handleDownload}>
          <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
          Download Report
        </MenuItemComponent>
        <MenuItemComponent onClick={handleDelete} sx={{ color: '#E94E77' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Delete
        </MenuItemComponent>
      </Menu>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        {selectedPrediction && (
          <>
            <DialogTitle>Prediction Details</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                <Box>
                  <Typography variant="caption" color="textSecondary">Forecast Period</Typography>
                  <Typography variant="body1" fontWeight={500}>{selectedPrediction.predictionName}</Typography>
                </Box>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Created Date & Time</Typography>
                    <Typography variant="body1">{selectedPrediction.createdDate} at {selectedPrediction.createdTime}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Data Source</Typography>
                    <Typography variant="body1">{selectedPrediction.dataSource}</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Model Used</Typography>
                    <Typography variant="body1">{selectedPrediction.modelUsed}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Forecast Horizon</Typography>
                    <Typography variant="body1">{selectedPrediction.forecastHorizon}</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Predicted Value</Typography>
                    <Typography variant="h5" fontWeight={600} color="primary">
                      {selectedPrediction.predictedValue}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Confidence Level</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={selectedPrediction.confidence} 
                        sx={{
                          flex: 1,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#E8E8E8',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: '#4A90E2',
                            borderRadius: 4,
                          }
                        }}
                      />
                      <Typography variant="body1" fontWeight={600}>{selectedPrediction.confidence}%</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="textSecondary">Trend</Typography>
                  <Chip
                    label={selectedPrediction.trend === 'increase' ? 'Increasing' : 'Decreasing'}
                    size="small"
                    icon={selectedPrediction.trend === 'increase' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
                    sx={{
                      backgroundColor: selectedPrediction.trend === 'increase' ? '#FFEBEE' : '#E8F5E9',
                      color: selectedPrediction.trend === 'increase' ? '#F44336' : '#4CAF50',
                      fontWeight: 500,
                      width: 'fit-content',
                      mt: 0.5,
                    }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" color="textSecondary" gutterBottom>Key Insights</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                    {selectedPrediction.insights.map((insight, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box sx={{ 
                          width: 6, 
                          height: 6, 
                          borderRadius: '50%', 
                          backgroundColor: '#4A90E2',
                          mt: 0.7,
                          flexShrink: 0
                        }} />
                        <Typography variant="body2">{insight}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="textSecondary">Status</Typography>
                  <Chip
                    label={selectedPrediction.status}
                    size="small"
                    icon={getStatusIcon(selectedPrediction.status)}
                    sx={{
                      backgroundColor: getStatusColor(selectedPrediction.status).bg,
                      color: getStatusColor(selectedPrediction.status).color,
                      fontWeight: 500,
                      textTransform: 'capitalize',
                      width: 'fit-content',
                      mt: 0.5,
                    }}
                  />
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
              <Button onClick={handleDownload} variant="contained">
                Download Report
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Prediction?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{selectedPrediction?.predictionName}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Prediction;