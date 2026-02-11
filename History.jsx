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
  Tabs,
  Tab,
  Avatar,
  Switch,
  FormControlLabel,
  Menu,
  Divider,
} from '@mui/material';
import {
  HealthAndSafety as HealthAndSafetyIcon,
  Dashboard as DashboardIcon,
  Summarize as SummarizeIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  CalendarMonth as CalendarIcon,
  CloudUpload as CloudUploadIcon,
  LocalHospital as MedicalIcon,
  Group as GroupIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart } from 'recharts';
import './Dashboard.css';

const History = ({ onNavigate, onLogout }) => {
  const [selectedDisease, setSelectedDisease] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedGeography, setSelectedGeography] = useState('city');
  const [climateOverlay, setClimateOverlay] = useState(false);
  const [climateType, setClimateType] = useState('temperature');
  const [anchorEl, setAnchorEl] = useState(null);

  const menuItems = [
    { icon: <DashboardIcon />, text: 'Dashboard', active: false },
    { icon: <TrendingUpIcon />, text: 'Prediction', active: false },
    { icon: <HistoryIcon />, text: 'History', active: true },
    { icon: <CloudUploadIcon />, text: 'Data Import', active: false },
  ];

  // Disease options (from uploaded data)
  const diseases = [
    { value: 'all', label: 'All Diseases' },
    { value: 'dengue', label: 'Dengue' },
    { value: 'influenza', label: 'Influenza' },
    { value: 'flu', label: 'Flu' },
    { value: 'respiratory', label: 'Respiratory' },
    { value: 'hypertension', label: 'Hypertension' },
  ];

  // Year options
  const years = [
    { value: 'all', label: 'All Years' },
    { value: '2024', label: '2024' },
    { value: '2025', label: '2025' },
    { value: '2026', label: '2026' },
  ];

  // Month options
  const months = [
    { value: 'all', label: 'All Months' },
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  // Geographic options
  const geographicLevels = [
    { value: 'city', label: 'City/Dataset Level' },
    { value: 'barangay', label: 'Barangay' },
  ];

  // Climate overlay types
  const climateTypes = [
    { value: 'temperature', label: 'Temperature' },
    { value: 'rainfall', label: 'Rainfall' },
    { value: 'humidity', label: 'Humidity' },
  ];

  // Sample historical patient data (from user uploads)
  const monthlyPatientData = [
    { month: 'Jul', patients: 150, temperature: 28, rainfall: 120, humidity: 75 },
    { month: 'Aug', patients: 170, temperature: 29, rainfall: 140, humidity: 78 },
    { month: 'Sep', patients: 130, temperature: 27, rainfall: 100, humidity: 72 },
    { month: 'Oct', patients: 180, temperature: 28, rainfall: 130, humidity: 76 },
    { month: 'Nov', patients: 190, temperature: 26, rainfall: 90, humidity: 70 },
    { month: 'Dec', patients: 200, temperature: 25, rainfall: 80, humidity: 68 },
    { month: 'Jan', patients: 195, temperature: 24, rainfall: 85, humidity: 69 },
    { month: 'Feb', patients: 175, temperature: 26, rainfall: 95, humidity: 71 },
    { month: 'Mar', patients: 210, temperature: 28, rainfall: 110, humidity: 74 },
  ];

  // Historical records table data
  const historicalRecords = [
    { id: 1, month: 'Jul 2025', totalPatients: 195, topIllness: 'Dengue', trend: 'increase' },
    { id: 2, month: 'Aug 2025', totalPatients: 235, topIllness: 'Dengue', trend: 'increase' },
    { id: 3, month: 'Sep 2025', totalPatients: 182, topIllness: 'Flu', trend: 'decrease' },
    { id: 4, month: 'Oct 2025', totalPatients: 220, topIllness: 'Flu', trend: 'increase' },
    { id: 5, month: 'Nov 2025', totalPatients: 245, topIllness: 'Respiratory', trend: 'increase' },
    { id: 6, month: 'Dec 2025', totalPatients: 208, topIllness: 'Flu', trend: 'increase' },
    { id: 7, month: 'Jan 2026', totalPatients: 242, topIllness: 'Flu', trend: 'decrease' },
    { id: 8, month: 'Feb 2026', totalPatients: 230, topIllness: 'Flu', trend: 'decrease' },
    { id: 9, month: 'Mar 2026', totalPatients: 260, topIllness: 'Hypertension', trend: 'increase' },
  ];

  // Calculate statistics
  const totalPatients = monthlyPatientData.reduce((sum, item) => sum + item.patients, 0);
  const averageMonthlyPatients = Math.round(totalPatients / monthlyPatientData.length);
  const peakMonthlyPatients = Math.max(...monthlyPatientData.map(item => item.patients));

  // Get climate data key based on selected type
  const getClimateDataKey = () => {
    switch(climateType) {
      case 'temperature': return 'temperature';
      case 'rainfall': return 'rainfall';
      case 'humidity': return 'humidity';
      default: return 'temperature';
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
            <Typography variant="h4" className="dashboard-title">History</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              View historical disease data and trends over time
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

        {/* Filters Section */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Disease Filter */}
          <Box>
            <Typography variant="caption" sx={{ color: '#757575', mb: 0.5, display: 'block', fontSize: '0.75rem' }}>
              Disease
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

          {/* Year Filter */}
          <Box>
            <Typography variant="caption" sx={{ color: '#757575', mb: 0.5, display: 'block', fontSize: '0.75rem' }}>
              Filter by Year
            </Typography>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              displayEmpty
              sx={{ 
                minWidth: 120,
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
              {years.map(year => (
                <MenuItem key={year.value} value={year.value}>{year.label}</MenuItem>
              ))}
            </Select>
          </Box>

          {/* Month Filter */}
          <Box>
            <Typography variant="caption" sx={{ color: '#757575', mb: 0.5, display: 'block', fontSize: '0.75rem' }}>
              Month
            </Typography>
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              displayEmpty
              sx={{ 
                minWidth: 130,
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
              {months.map(month => (
                <MenuItem key={month.value} value={month.value}>{month.label}</MenuItem>
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
              {geographicLevels.map(level => (
                <MenuItem key={level.value} value={level.value}>{level.label}</MenuItem>
              ))}
            </Select>
          </Box>

          {/* Climate Overlay Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={climateOverlay}
                  onChange={(e) => setClimateOverlay(e.target.checked)}
                  color="primary"
                />
              }
              label="Climate Overlay"
              sx={{ mb: 0 }}
            />
            {climateOverlay && (
              <Select
                value={climateType}
                onChange={(e) => setClimateType(e.target.value)}
                displayEmpty
                sx={{ 
                  minWidth: 130,
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
                {climateTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            )}
          </Box>
        </Box>

        {/* Stats Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Average Monthly Patients</Typography>
                <Box className="stat-icon" sx={{ backgroundColor: '#4A90E215' }}>
                  <CalendarIcon sx={{ color: '#4A90E2', fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h4" className="stat-value">{averageMonthlyPatients}</Typography>
              <Typography variant="caption" className="stat-subtitle">
                Average Monthly Patients
              </Typography>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Peak Monthly Patients</Typography>
                <Box className="stat-icon" sx={{ backgroundColor: '#50C87815' }}>
                  <TrendingUpIcon sx={{ color: '#50C878', fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h4" className="stat-value">{peakMonthlyPatients}</Typography>
              <Typography variant="caption" className="stat-subtitle">
                Highest Month
              </Typography>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent>
              <Box className="stat-header">
                <Typography variant="caption" className="stat-title">Total Patient (Period)</Typography>
                <Box className="stat-icon" sx={{ backgroundColor: '#9B59B615' }}>
                  <GroupIcon sx={{ color: '#9B59B6', fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h4" className="stat-value">{totalPatients}</Typography>
              <Typography variant="caption" className="stat-subtitle">
                Total Patient (Period)
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Chart Section */}
        <Card className="chart-card" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" className="chart-title">
              Historical Patient Count
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              {climateOverlay ? (
                <ComposedChart data={monthlyPatientData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: '#999' }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: '#999' }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: '#999' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E8E8E8', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  <Bar yAxisId="left" dataKey="patients" fill="#4A90E2" name="Patients" radius={[8, 8, 0, 0]} />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey={getClimateDataKey()} 
                    stroke={climateType === 'temperature' ? '#FF6B6B' : climateType === 'rainfall' ? '#4ECDC4' : '#95E1D3'} 
                    name={climateType.charAt(0).toUpperCase() + climateType.slice(1)}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              ) : (
                <BarChart data={monthlyPatientData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: '#999' }} />
                  <YAxis axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: '#999' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E8E8E8', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  <Bar dataKey="patients" fill="#4A90E2" name="Patients" radius={[8, 8, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Historical Records Table */}
        <Card className="chart-card">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" className="chart-title">
                Historical Records
              </Typography>
            </Box>

            {historicalRecords.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <MedicalIcon sx={{ fontSize: 64, color: '#E0E0E0', mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  No patient data for this period
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Upload patient data to see historical trends
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Month</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Total Patients</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Top Illness</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Trend</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historicalRecords.map((record) => (
                      <TableRow key={record.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {record.month}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {record.totalPatients.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {record.topIllness}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={record.trend === 'increase' ? '↑ Increase' : '↓ Decrease'}
                            size="small"
                            icon={record.trend === 'increase' ? <TrendingUpIcon /> : <TrendingDownIcon />}
                            sx={{
                              backgroundColor: record.trend === 'increase' ? '#E8F5E9' : '#FFEBEE',
                              color: record.trend === 'increase' ? '#4CAF50' : '#F44336',
                              fontWeight: 500,
                            }}
                          />
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
    </Box>
  );
};

export default History;