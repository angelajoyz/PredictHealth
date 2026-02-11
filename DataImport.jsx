import React, { useState } from 'react';
import {
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Avatar,
  Button,
  IconButton,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Chip,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  CloudQueue as CloudIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  CloudDone as CloudDoneIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import './Dashboard.css';

const DataImport = ({ onNavigate, onLogout }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationStatus, setValidationStatus] = useState(null); // null, 'success', 'error'
  const [validationErrors, setValidationErrors] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState(null); // null, 'success', 'error'
  const [processedDataInfo, setProcessedDataInfo] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  const menuItems = [
    { icon: <DashboardIcon />, text: 'Dashboard', active: false },
    { icon: <TrendingUpIcon />, text: 'Prediction', active: false },
    { icon: <HistoryIcon />, text: 'History', active: false },
    { icon: <CloudUploadIcon />, text: 'Data Import', active: true },
  ];

  // File drag handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  // Main file selection handler
  const handleFileSelection = (file) => {
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      alert('Please upload only CSV or Excel files');
      return;
    }

    setSelectedFile(file);
    setProcessingResult(null); // Reset any previous result
    
    // Trigger automatic validation
    validateFile(file);
  };

  // Automatic file validation (Stage 2)
  const validateFile = (file) => {
    // Simulate file validation
    // In real implementation, this would read the file and check:
    // - Required columns (Date, Cases, etc.)
    // - Date format validity
    // - Numeric values for cases
    
    setTimeout(() => {
      // Simulated validation - you can change this logic
      const isValid = Math.random() > 0.3; // 70% success rate for demo
      
      if (isValid) {
        setValidationStatus('success');
        setValidationErrors([]);
        
        // Generate preview data (first 10 rows)
        const mockPreviewData = {
          columns: ['Date', 'Barangay', 'Disease', 'Cases', 'Month', 'Year'],
          rows: [
            ['2024-01-15', 'San Nicolas', 'Dengue', '45', 'January', '2024'],
            ['2024-01-20', 'Poblacion', 'Dengue', '32', 'January', '2024'],
            ['2024-02-10', 'San Nicolas', 'Dengue', '38', 'February', '2024'],
            ['2024-02-18', 'Molino', 'Dengue', '52', 'February', '2024'],
            ['2024-03-05', 'San Nicolas', 'Dengue', '41', 'March', '2024'],
            ['2024-03-12', 'Poblacion', 'Dengue', '29', 'March', '2024'],
            ['2024-04-08', 'Molino', 'Dengue', '47', 'April', '2024'],
            ['2024-04-22', 'San Nicolas', 'Dengue', '55', 'April', '2024'],
          ]
        };
        setPreviewData(mockPreviewData);
      } else {
        setValidationStatus('error');
        const errors = [
          'Missing required column: Date',
          'Invalid date format in row 15',
        ];
        setValidationErrors(errors);
        setPreviewData(null);
      }
    }, 800); // Simulate processing time
  };

  // Process & Save Data button handler (Stage 4)
  const handleProcessData = () => {
    setIsProcessing(true);
    setProcessingResult(null);

    // Simulate backend processing (Stage 5 & 6)
    // In real implementation, send file to backend for:
    // - Data cleaning
    // - Date normalization
    // - Monthly aggregation
    // - Climate data merging
    // - Feature preparation
    // - Database storage
    
    setTimeout(() => {
      const isSuccess = Math.random() > 0.2; // 80% success rate for demo
      
      if (isSuccess) {
        setProcessingResult('success');
        setProcessedDataInfo({
          datasetRange: '2019 - 2024',
          totalRecords: 2840,
          uploadDate: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        });
      } else {
        setProcessingResult('error');
      }
      
      setIsProcessing(false);
    }, 3000); // Simulate 3 seconds processing time
  };

  // Reset everything for new upload
  const handleNewUpload = () => {
    setSelectedFile(null);
    setValidationStatus(null);
    setValidationErrors([]);
    setPreviewData(null);
    setIsProcessing(false);
    setProcessingResult(null);
    setProcessedDataInfo(null);
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
              Data Import
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              Upload and process patient health data for analysis
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

        {/* 1️⃣ Upload Section */}
        {!selectedFile && !processingResult && (
          <Card className="chart-card" sx={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
            <CardContent sx={{ width: '100%' }}>
              <Box
                className={`upload-area ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                sx={{
                  border: '2px dashed #4A90E2',
                  borderRadius: '12px',
                  padding: '60px 20px',
                  textAlign: 'center',
                  backgroundColor: dragActive ? '#F0F7FF' : '#FAFBFC',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: '#F0F7FF',
                    borderColor: '#357ABD',
                  }
                }}
              >
                <input
                  type="file"
                  id="file-upload"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
                  <CloudUploadIcon sx={{ fontSize: 80, color: '#4A90E2', mb: 2 }} />
                  <Typography variant="h5" gutterBottom fontWeight={600}>
                    Drag and drop your file here
                  </Typography>
                  <Typography variant="body1" color="textSecondary" gutterBottom>
                    or
                  </Typography>
                  <Button 
                    variant="contained" 
                    component="span" 
                    sx={{ 
                      mt: 2, 
                      textTransform: 'none',
                      px: 4,
                      py: 1.5,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)'
                    }}
                  >
                    Browse Files
                  </Button>
                  <Typography variant="body2" sx={{ mt: 3, color: '#666', fontWeight: 500 }}>
                    Supported formats: CSV, XLSX
                  </Typography>
                </label>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* File Selected + Validation Status */}
        {selectedFile && !processingResult && (
          <>
            {/* Selected File Info */}
            <Card className="chart-card" sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FileIcon sx={{ color: '#4A90E2', fontSize: 40 }} />
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {selectedFile.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton onClick={handleNewUpload} color="error">
                    <CloseIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>

            {/* 2️⃣ Validation Status */}
            {validationStatus === null && (
              <Card className="chart-card" sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body1">
                      Validating file format and structure...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}

            {validationStatus === 'success' && (
              <Alert 
                severity="success" 
                icon={<CheckCircleIcon />}
                sx={{ mb: 3, borderRadius: 2, fontSize: '1rem' }}
              >
                <Typography variant="body1" fontWeight={600}>
                  ✔️ File format valid
                </Typography>
                <Typography variant="body2">
                  All required columns detected. Data structure is correct.
                </Typography>
              </Alert>
            )}

            {validationStatus === 'error' && (
              <Alert 
                severity="error" 
                icon={<ErrorIcon />}
                sx={{ mb: 3, borderRadius: 2 }}
              >
                <Typography variant="body1" fontWeight={600} gutterBottom>
                  ❌ Validation Failed
                </Typography>
                {validationErrors.map((error, index) => (
                  <Typography key={index} variant="body2">
                    • {error}
                  </Typography>
                ))}
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={handleNewUpload}
                  sx={{ mt: 2, textTransform: 'none' }}
                >
                  Upload Different File
                </Button>
              </Alert>
            )}

            {/* 3️⃣ Data Preview Section */}
            {validationStatus === 'success' && previewData && (
              <Card className="chart-card" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" className="chart-title" sx={{ mb: 2 }}>
                    Data Preview
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Review the first few rows to confirm data accuracy before processing.
                  </Typography>
                  
                  <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #E8E8E8' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#F5F7FA' }}>
                          {previewData.columns.map((column, index) => (
                            <TableCell 
                              key={index}
                              sx={{ 
                                fontWeight: 700,
                                color: ['Date', 'Cases'].includes(column) ? '#4A90E2' : 'inherit',
                                fontSize: '0.875rem'
                              }}
                            >
                              {column}
                              {['Date', 'Cases'].includes(column) && (
                                <Chip 
                                  label="Required" 
                                  size="small" 
                                  sx={{ 
                                    ml: 1, 
                                    height: '18px',
                                    fontSize: '0.65rem',
                                    backgroundColor: '#4A90E215',
                                    color: '#4A90E2',
                                    fontWeight: 600
                                  }} 
                                />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewData.rows.map((row, rowIndex) => (
                          <TableRow 
                            key={rowIndex}
                            sx={{ 
                              '&:hover': { backgroundColor: '#FAFBFC' },
                              '&:last-child td': { borderBottom: 0 }
                            }}
                          >
                            {row.map((cell, cellIndex) => (
                              <TableCell key={cellIndex} sx={{ fontSize: '0.875rem' }}>
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2 }}>
                    Showing first {previewData.rows.length} rows of data
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* 4️⃣ Process & Save Button */}
            {validationStatus === 'success' && (
              <Card className="chart-card">
                <CardContent>
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Ready to Process
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                      Click the button below to process and save the data to the system.
                    </Typography>

                    {/* 5️⃣ Processing State */}
                    {isProcessing ? (
                      <Box sx={{ py: 2 }}>
                        <CircularProgress size={40} sx={{ mb: 2 }} />
                        <Typography variant="body1" fontWeight={600} gutterBottom>
                          Processing data. Please wait…
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          This may take a few moments depending on file size.
                        </Typography>
                      </Box>
                    ) : (
                      <Button
                        variant="contained"
                        size="large"
                        onClick={handleProcessData}
                        startIcon={<CloudDoneIcon />}
                        sx={{
                          textTransform: 'none',
                          px: 6,
                          py: 1.5,
                          fontSize: '1rem',
                          fontWeight: 600,
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #357ABD 0%, #2868A8 100%)',
                          }
                        }}
                      >
                        Process & Save Data
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* 7️⃣ Processing Result */}
        {processingResult === 'success' && (
          <Card className="chart-card">
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleIcon sx={{ fontSize: 80, color: '#4CAF50', mb: 2 }} />
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  ✅ Data processed successfully
                </Typography>
                <Typography variant="body1" color="textSecondary" sx={{ mb: 1 }}>
                  Dataset range: {processedDataInfo?.datasetRange}
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
                  Total records: {processedDataInfo?.totalRecords.toLocaleString()} • Uploaded on {processedDataInfo?.uploadDate}
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => onNavigate?.('history')}
                    sx={{
                      textTransform: 'none',
                      px: 4,
                      py: 1.5,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
                    }}
                  >
                    View History
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => onNavigate?.('dashboard')}
                    sx={{
                      textTransform: 'none',
                      px: 4,
                      py: 1.5,
                      borderRadius: '10px',
                    }}
                  >
                    Go to Dashboard
                  </Button>
                </Box>

                <Button
                  variant="text"
                  size="small"
                  onClick={handleNewUpload}
                  sx={{ mt: 3, textTransform: 'none', color: '#666' }}
                >
                  Upload Another File
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {processingResult === 'error' && (
          <Card className="chart-card">
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <ErrorIcon sx={{ fontSize: 80, color: '#F44336', mb: 2 }} />
                <Typography variant="h5" fontWeight={700} gutterBottom color="error">
                  ❌ Processing failed
                </Typography>
                <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
                  Processing failed due to invalid data format.
                </Typography>

                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 4, textAlign: 'left' }}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Common issues:
                  </Typography>
                  <Typography variant="body2">
                    • Inconsistent date formats<br/>
                    • Missing or non-numeric case values<br/>
                    • Unexpected column names or structure
                  </Typography>
                </Alert>

                <Button
                  variant="contained"
                  size="large"
                  onClick={handleNewUpload}
                  sx={{
                    textTransform: 'none',
                    px: 4,
                    py: 1.5,
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
                  }}
                >
                  Re-upload File
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default DataImport;