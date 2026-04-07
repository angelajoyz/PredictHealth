import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  InsertDriveFile as FileIcon,
  CloudQueue as CloudIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudDone as CloudDoneIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  LocationOn as LocationIcon,
  Biotech as BiotechIcon,
  Storage as StorageIcon,
  ArrowForward as ArrowForwardIcon,
  LocationCity as CityIcon,
} from "@mui/icons-material";
import Sidebar, { T } from "./Sidebar";
import { getBarangays } from "./services/api";

// ── Shared sub-components ─────────────────────────────────────────────────────
const SCard = ({ children, sx = {} }) => (
  <Card
    sx={{
      borderRadius: "10px",
      backgroundColor: "#FFFFFF",
      border: `1px solid ${T.border}`,
      boxShadow: "none",
      ...sx,
    }}
  >
    {children}
  </Card>
);

const CardHead = ({ title, icon }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      pb: 1.5,
      mb: 1.75,
      borderBottom: `1px solid ${T.borderSoft}`,
    }}
  >
    {icon && (
      <Box sx={{ color: T.blue, display: "flex", alignItems: "center" }}>
        {icon}
      </Box>
    )}
    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>
      {title}
    </Typography>
  </Box>
);

// ── File validation ───────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const VALID_FILE_TYPES = {
  ".csv": [
    "text/csv",
    "application/csv",
    "text/plain",
    "application/octet-stream",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
  ],
  ".xls": ["application/vnd.ms-excel", "application/octet-stream"],
};

const validateFileType = (file) => {
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!Object.keys(VALID_FILE_TYPES).includes(ext)) return false;
  const allowedMimes = VALID_FILE_TYPES[ext];
  if (file.type && !allowedMimes.includes(file.type)) return false;
  return true;
};

const formatFileSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(2)} KB`;

// ── Animated processing indicator ─────────────────────────────────────────────
const STEPS = [
  "Reading file structure…",
  "Detecting barangays…",
  "Identifying disease columns…",
  "Counting data records…",
  "Finalizing dataset summary…",
];

const ProcessingIndicator = ({ fileName }) => {
  const [stepIndex, setStepIndex] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 900);
    return () => clearInterval(id);
  }, []);
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  return (
    <Box
      sx={{
        p: "16px 18px",
        borderRadius: "10px",
        backgroundColor: T.blueDim,
        border: `1px solid rgba(27,79,138,0.18)`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
        <CircularProgress
          size={14}
          thickness={5}
          sx={{ color: T.blue, flexShrink: 0 }}
        />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.blue }}>
          Processing file…
        </Typography>
        <Typography
          sx={{
            fontSize: 11,
            color: T.textMuted,
            ml: "auto",
            maxWidth: 180,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {fileName}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          mb: 1.5,
          height: 4,
          borderRadius: 4,
          backgroundColor: "rgba(27,79,138,0.12)",
          "& .MuiLinearProgress-bar": {
            backgroundColor: T.blue,
            borderRadius: 4,
            transition: "transform 0.85s ease",
          },
        }}
      />
      <Box sx={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {STEPS.map((step, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {i < stepIndex ? (
              <CheckCircleIcon
                sx={{ fontSize: 13, color: T.ok, flexShrink: 0 }}
              />
            ) : i === stepIndex ? (
              <Box
                sx={{
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  flexShrink: 0,
                  border: `2px solid ${T.blue}`,
                  animation: "diPulse 1s ease-in-out infinite",
                  "@keyframes diPulse": {
                    "0%,100%": { opacity: 1 },
                    "50%": { opacity: 0.35 },
                  },
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  flexShrink: 0,
                  border: `1.5px solid rgba(27,79,138,0.2)`,
                }}
              />
            )}
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: i === stepIndex ? 600 : 400,
                color:
                  i < stepIndex ? T.ok : i === stepIndex ? T.blue : T.textFaint,
                transition: "color 0.3s",
              }}
            >
              {step}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ── Uniform chip ──────────────────────────────────────────────────────────────
const UniChip = ({ label, color, bg, border }) => (
  <Box
    sx={{
      width: 148,
      height: 26,
      px: "10px",
      borderRadius: "5px",
      backgroundColor: bg,
      border: `1px solid ${border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
    }}
  >
    <Typography
      sx={{
        fontSize: 11.5,
        fontWeight: 500,
        color,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        lineHeight: 1,
        width: "100%",
        textAlign: "center",
      }}
    >
      {label}
    </Typography>
  </Box>
);

// ── Preview stat tile ─────────────────────────────────────────────────────────
const PreviewTile = ({
  icon,
  label,
  value,
  color = T.blue,
  bg = T.blueDim,
  border = "rgba(27,79,138,0.18)",
}) => (
  <Box
    sx={{
      flex: 1,
      p: "12px 14px",
      borderRadius: "8px",
      backgroundColor: bg,
      border: `1px solid ${border}`,
      display: "flex",
      alignItems: "center",
      gap: 1.25,
    }}
  >
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: "8px",
        flexShrink: 0,
        backgroundColor: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${border}`,
      }}
    >
      {React.cloneElement(icon, { sx: { fontSize: 16, color } })}
    </Box>
    <Box>
      <Typography
        sx={{ fontSize: 18, fontWeight: 700, color: T.textHead, lineHeight: 1 }}
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: 11, color: T.textMuted, mt: 0.25 }}>
        {label}
      </Typography>
    </Box>
  </Box>
);

// ── DataImport ────────────────────────────────────────────────────────────────
const DataImport = ({ onNavigate, onLogout, onDataUploaded }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationStatus, setValidationStatus] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [diseaseColumns, setDiseaseColumns] = useState([]);
  const [rowCount, setRowCount] = useState(null);
  const [datasetCity, setDatasetCity] = useState(null);
  const [dialogType, setDialogType] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [dialogMeta, setDialogMeta] = useState(null);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) trySelectFile(e.dataTransfer.files[0]);
  };
  const handleFileInput = (e) => {
    if (e.target.files?.[0]) trySelectFile(e.target.files[0]);
    e.target.value = "";
  };

  // ── Smart detection ───────────────────────────────────────────────────────
  const detectDialogType = async (file) => {
    try {
      const response = await getBarangays(file);
      const newBarangays = response.barangays || [];
      const newDiseases = response.disease_columns || [];
      const existingBarangays = JSON.parse(
        localStorage.getItem("availableBarangays") || "[]",
      );
      const existingDiseases = JSON.parse(
        localStorage.getItem("diseaseColumns") || "[]",
      );
      const sameBarangays =
        newBarangays.length === existingBarangays.length &&
        newBarangays.every((b) => existingBarangays.includes(b));
      const sameDiseases =
        newDiseases.length === existingDiseases.length &&
        newDiseases.every((d) => existingDiseases.includes(d));
      setPendingFile({ file, scannedResponse: response });
      setDialogMeta({
        barangaysMatch: sameBarangays,
        diseasesMatch: sameDiseases,
      });
      if (sameBarangays && sameDiseases) setDialogType("extension");
      else if (!sameBarangays && !sameDiseases) setDialogType("replacement");
      else setDialogType("conflict");
    } catch {
      setPendingFile({ file, scannedResponse: null });
      setDialogMeta({ barangaysMatch: false, diseasesMatch: false });
      setDialogType("replacement");
    }
  };

  const trySelectFile = (file) => {
    const existingData = localStorage.getItem("uploadedData");
    const existingHistory = localStorage.getItem("forecastHistory");
    const hasExisting =
      existingData ||
      (existingHistory && JSON.parse(existingHistory)?.length > 0);
    if (hasExisting) detectDialogType(file);
    else handleFileSelection(file);
  };

  const closeDialog = () => {
    setDialogType(null);
    setPendingFile(null);
    setDialogMeta(null);
  };

  const handleConfirmExtend = () => {
    const { file, scannedResponse } = pendingFile;
    closeDialog();
    [
      "uploadedData",
      "cachedForecastData",
      "cachedForecastBarangay",
      "cachedForecastHorizon",
      "cachedForecastDisease",
      "dashboardSnapshot",
    ].forEach((k) => localStorage.removeItem(k));
    scannedResponse
      ? applyScannedResponse(file, scannedResponse)
      : handleFileSelection(file);
  };
  const handleConfirmReplace = async () => {
    const { file } = pendingFile;
    closeDialog();
    clearLocalStorageData();
    setSelectedFile(file);
    setValidationStatus("loading");
    setBarangays([]);
    setDiseaseColumns([]);
    setValidationErrors([]);
    setRowCount(null);
    setDatasetCity(null);
    try {
      const [response] = await Promise.all([
        getBarangays(file, { replace: true }),
        new Promise((r) => setTimeout(r, 4500)),
      ]);
      applyScannedResponse(file, response);
    } catch (error) {
      setValidationStatus("error");
      setValidationErrors([error.message]);
    }
  };
  const handleConfirmConflictContinue = () => {
    const { file, scannedResponse } = pendingFile;
    closeDialog();
    [
      "uploadedData",
      "cachedForecastData",
      "cachedForecastBarangay",
      "cachedForecastHorizon",
      "cachedForecastDisease",
      "dashboardSnapshot",
    ].forEach((k) => localStorage.removeItem(k));
    scannedResponse
      ? applyScannedResponse(file, scannedResponse)
      : handleFileSelection(file);
  };

  const applyScannedResponse = (file, response) => {
    setSelectedFile(file);
    const receivedBarangays = response.barangays || [];
    const receivedDiseases = response.disease_columns || [];
    setBarangays(receivedBarangays);
    setDiseaseColumns(receivedDiseases);
    if (response.row_count != null) setRowCount(response.row_count);
    if (response.city) setDatasetCity(response.city);
    if (receivedBarangays.length > 0)
      localStorage.setItem(
        "availableBarangays",
        JSON.stringify(receivedBarangays),
      );
    if (receivedDiseases.length > 0)
      localStorage.setItem("diseaseColumns", JSON.stringify(receivedDiseases));
    if (response.city) localStorage.setItem("datasetCity", response.city);
    if (response.start_date)
      localStorage.setItem("datasetStartDate", response.start_date);
    if (response.end_date)
      localStorage.setItem("datasetEndDate", response.end_date);
    setValidationStatus("success");
  };

  const clearLocalStorageData = () => {
    [
      "uploadedData",
      "availableBarangays",
      "diseaseColumns",
      "forecastHistory",
      "cachedForecastData",
      "cachedForecastBarangay",
      "cachedForecastHorizon",
      "cachedForecastDisease",
      "dashboardSnapshot",
      "datasetCity",
      "datasetStartDate",
      "datasetEndDate",
    ].forEach((k) => localStorage.removeItem(k));
  };

  const handleFileSelection = async (file) => {
    if (!validateFileType(file)) {
      setSelectedFile(file);
      setValidationStatus("error");
      setValidationErrors([
        `"${file.name}" is not a supported file type. Please upload .xlsx, .xls, or .csv only.`,
      ]);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(file);
      setValidationStatus("error");
      setValidationErrors([
        `File is too large (${formatFileSize(file.size)}). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`,
      ]);
      return;
    }
    setSelectedFile(file);
    setValidationStatus("loading");
    setBarangays([]);
    setDiseaseColumns([]);
    setValidationErrors([]);
    setRowCount(null);
    setDatasetCity(null);
    try {
      const [response] = await Promise.all([
        getBarangays(file),
        new Promise((r) => setTimeout(r, 4500)),
      ]);
      const receivedBarangays = response.barangays || [];
      const receivedDiseases = response.disease_columns || [];
      setBarangays(receivedBarangays);
      setDiseaseColumns(receivedDiseases);
      if (response.row_count != null) setRowCount(response.row_count);
      if (response.city) setDatasetCity(response.city);
      if (receivedBarangays.length > 0)
        localStorage.setItem(
          "availableBarangays",
          JSON.stringify(receivedBarangays),
        );
      if (receivedDiseases.length > 0)
        localStorage.setItem(
          "diseaseColumns",
          JSON.stringify(receivedDiseases),
        );
      if (response.city) localStorage.setItem("datasetCity", response.city);
      if (response.start_date)
        localStorage.setItem("datasetStartDate", response.start_date);
      if (response.end_date)
        localStorage.setItem("datasetEndDate", response.end_date);
      setValidationStatus("success");
    } catch (error) {
      setValidationStatus("error");
      setValidationErrors([error.message]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setValidationStatus(null);
    setValidationErrors([]);
    setBarangays([]);
    setDiseaseColumns([]);
    setRowCount(null);
    setDatasetCity(null);
    clearLocalStorageData();
  };

  const handleSaveAndContinue = () => {
    const now = new Date().toISOString();
    // I-save sa localStorage MUNA
    localStorage.setItem(
      "uploadedData",
      JSON.stringify({
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        uploadDate: now,
      }),
    );
    // I-update ang App.jsx state
    if (onDataUploaded) onDataUploaded({ file: selectedFile, uploadDate: now });
    // Mag-navigate AFTER state update — gamit ang setTimeout para masigurong na-update na ang state
    setTimeout(() => onNavigate?.("dashboard"), 50);
  };

  return (
    <Box
      sx={{ display: "flex", minHeight: "100vh", backgroundColor: T.pageBg }}
    >
      <Sidebar
        currentPage="dataimport"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <Box
        sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
      >
        {/* Sticky header — border removed */}
        <Box
          sx={{
            px: "24px",
            minHeight: 64,
            display: "flex",
            alignItems: "center",
            backgroundColor: "#FFFFFF",
            position: "sticky",
            top: 0,
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              fontSize: 16,
              fontWeight: 700,
              color: T.textHead,
              letterSpacing: "-0.2px",
            }}
          >
            Data Import
          </Typography>
        </Box>

        <Box
          sx={{
            px: "24px",
            pt: "20px",
            pb: "28px",
            overflow: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Step 1 */}
          <SCard
            sx={{
              mb: "14px",
              flex: validationStatus !== "success" ? 1 : "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <CardContent
              sx={{
                p: 2.25,
                "&:last-child": { pb: 2.25 },
                flex: 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <CardHead
                title="Step 1: Upload Dataset"
                icon={<CloudIcon sx={{ fontSize: 16 }} />}
              />

              {!selectedFile ? (
                <Box
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-input").click()}
                  sx={{
                    flex: 1,
                    border: `2px dashed ${dragActive ? T.blue : T.borderSoft}`,
                    borderRadius: "10px",
                    p: "24px",
                    textAlign: "center",
                    backgroundColor: dragActive ? T.blueDim : T.pageBg,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    "&:hover": {
                      borderColor: T.blue,
                      backgroundColor: T.blueDim,
                    },
                  }}
                >
                  <CloudUploadIcon
                    sx={{
                      fontSize: 48,
                      color: dragActive ? T.blue : T.textFaint,
                      mb: 1.5,
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: T.textHead,
                      mb: 0.5,
                    }}
                  >
                    Drag and drop your file here
                  </Typography>
                  <Typography
                    sx={{ fontSize: 12, color: T.textMuted, mb: 0.5 }}
                  >
                    or click to browse
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: T.textFaint }}>
                    Supported formats: .xlsx, .xls, .csv · Max size:{" "}
                    {MAX_FILE_SIZE_MB} MB
                  </Typography>
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInput}
                    style={{ display: "none" }}
                  />
                </Box>
              ) : (
                <Box>
                  {/* File row */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: "10px 14px",
                      borderRadius: "8px",
                      backgroundColor: T.pageBg,
                      border: `1px solid ${T.borderSoft}`,
                      mb: 1.5,
                    }}
                  >
                    <FileIcon
                      sx={{ fontSize: 20, color: T.blue, flexShrink: 0 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: T.textHead,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {selectedFile.name}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 11,
                          color:
                            selectedFile.size > MAX_FILE_SIZE_BYTES * 0.8
                              ? T.warnAccent
                              : T.textMuted,
                        }}
                      >
                        {formatFileSize(selectedFile.size)}
                        {selectedFile.size > MAX_FILE_SIZE_BYTES * 0.8 &&
                          selectedFile.size <= MAX_FILE_SIZE_BYTES &&
                          " · near size limit"}
                      </Typography>
                    </Box>
                    {validationStatus !== "loading" && (
                      <Box
                        onClick={handleRemoveFile}
                        sx={{
                          cursor: "pointer",
                          p: 0.5,
                          borderRadius: "4px",
                          color: T.textMuted,
                          "&:hover": {
                            color: T.danger,
                            backgroundColor: T.dangerBg,
                          },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </Box>
                    )}
                  </Box>

                  {validationStatus === "loading" && (
                    <ProcessingIndicator fileName={selectedFile.name} />
                  )}

                  {validationStatus === "error" && (
                    <Box
                      sx={{
                        p: "10px 14px",
                        borderRadius: "8px",
                        backgroundColor: T.dangerBg,
                        border: `1px solid ${T.dangerBorder}`,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <ErrorIcon sx={{ fontSize: 15, color: T.danger }} />
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: T.danger,
                          }}
                        >
                          Validation Failed
                        </Typography>
                      </Box>
                      {validationErrors.map((err, i) => (
                        <Typography
                          key={i}
                          sx={{ fontSize: 12, color: T.danger, pl: 3 }}
                        >
                          • {err}
                        </Typography>
                      ))}
                    </Box>
                  )}

                  {validationStatus === "success" && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        p: "9px 14px",
                        borderRadius: "8px",
                        backgroundColor: T.okBg,
                        border: `1px solid ${T.okBorder}`,
                      }}
                    >
                      <CheckCircleIcon
                        sx={{ fontSize: 15, color: T.ok, flexShrink: 0 }}
                      />
                      <Typography
                        sx={{ fontSize: 12.5, color: T.ok, fontWeight: 500 }}
                      >
                        File validated successfully — found {barangays.length}{" "}
                        barangay{barangays.length !== 1 ? "s" : ""},{" "}
                        {diseaseColumns.length} disease type
                        {diseaseColumns.length !== 1 ? "s" : ""}.
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </SCard>

          {/* Step 2 */}
          {validationStatus === "success" && (
            <SCard sx={{ mb: "14px" }}>
              <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
                <CardHead
                  title="Step 2: Dataset Summary"
                  icon={<StorageIcon sx={{ fontSize: 16 }} />}
                />

                <Box
                  sx={{ display: "flex", gap: "10px", mb: 2, flexWrap: "wrap" }}
                >
                  {datasetCity && (
                    <PreviewTile
                      icon={<CityIcon />}
                      label="City / Municipality"
                      value={datasetCity}
                      color="#7c3aed"
                      bg="rgba(124,58,237,0.07)"
                      border="rgba(124,58,237,0.2)"
                    />
                  )}
                  <PreviewTile
                    icon={<LocationIcon />}
                    label="Barangays found"
                    value={barangays.length}
                    color={T.blue}
                    bg={T.blueDim}
                    border="rgba(27,79,138,0.18)"
                  />
                  <PreviewTile
                    icon={<BiotechIcon />}
                    label="Disease types"
                    value={diseaseColumns.length}
                    color={T.ok}
                    bg={T.okBg}
                    border={T.okBorder}
                  />
                  {rowCount != null && (
                    <PreviewTile
                      icon={<StorageIcon />}
                      label="Data records"
                      value={rowCount.toLocaleString()}
                      color={T.warnAccent}
                      bg={T.warnBg}
                      border={T.warnBorder}
                    />
                  )}
                </Box>

                {barangays.length > 0 && (
                  <Box sx={{ mb: 1.75 }}>
                    <Typography
                      sx={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: T.textMuted,
                        mb: 0.75,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Barangays in dataset ({barangays.length})
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {barangays.map((b) => (
                        <UniChip
                          key={b}
                          label={b}
                          color={T.textBody}
                          bg={T.pageBg}
                          border={T.borderSoft}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {diseaseColumns.length > 0 && (
                  <Box sx={{ mb: 1.75 }}>
                    <Typography
                      sx={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: T.textMuted,
                        mb: 0.75,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Detected disease types ({diseaseColumns.length})
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {diseaseColumns.map((col) => (
                        <UniChip
                          key={col}
                          label={col}
                          color={T.blue}
                          bg={T.blueDim}
                          border="rgba(27,79,138,0.2)"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                <Box
                  sx={{
                    p: "10px 14px",
                    borderRadius: "8px",
                    backgroundColor: T.blueDim,
                    border: `1px solid rgba(27,79,138,0.18)`,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1,
                  }}
                >
                  <LocationIcon
                    sx={{
                      fontSize: 14,
                      color: T.blue,
                      mt: "2px",
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    sx={{ fontSize: 12, color: T.blue, lineHeight: 1.6 }}
                  >
                    You'll choose a specific barangay and generate forecasts
                    from the <strong>Dashboard</strong> after saving your
                    dataset here.
                  </Typography>
                </Box>
              </CardContent>
            </SCard>
          )}

          {/* Step 3 */}
          {validationStatus === "success" && (
            <SCard>
              <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
                <CardHead
                  title="Step 3: Save & Continue"
                  icon={<CloudDoneIcon sx={{ fontSize: 16 }} />}
                />
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleSaveAndContinue}
                  sx={{
                    backgroundColor: T.blue,
                    color: "#fff",
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: 13.5,
                    borderRadius: "8px",
                    py: 1.25,
                    boxShadow: "0 2px 10px rgba(27,79,138,0.25)",
                    "&:hover": {
                      backgroundColor: T.blueMid,
                      boxShadow: "0 3px 14px rgba(27,79,138,0.32)",
                    },
                  }}
                >
                  Save & Go to Dashboard
                </Button>
                <Typography
                  sx={{
                    fontSize: 11.5,
                    color: T.textFaint,
                    textAlign: "center",
                    mt: 1.5,
                  }}
                >
                  Your dataset will be saved — generate forecasts from the
                  Dashboard
                </Typography>
              </CardContent>
            </SCard>
          )}
        </Box>
      </Box>

      {/* Smart Dataset Dialog */}
      <Dialog
        open={!!dialogType}
        onClose={closeDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: "12px", border: `1px solid ${T.border}` },
        }}
      >
        {dialogType === "extension" && (
          <>
            <DialogTitle
              sx={{
                fontSize: 15,
                fontWeight: 700,
                color: T.textHead,
                pb: 1,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 18, color: T.ok }} /> Dataset
              Extension Detected
            </DialogTitle>
            <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
            <DialogContent sx={{ pt: 2.5 }}>
              <Typography
                sx={{
                  fontSize: 13,
                  color: T.textBody,
                  lineHeight: 1.7,
                  mb: 1.5,
                }}
              >
                The new file appears to be a <strong>continuation</strong> of
                your existing dataset — same barangays and disease types
                detected.
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  mb: 1.5,
                }}
              >
                {["Barangays match", "Disease types match"].map((label) => (
                  <Box
                    key={label}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: "8px 12px",
                      borderRadius: "7px",
                      backgroundColor: T.okBg,
                      border: `1px solid ${T.okBorder}`,
                    }}
                  >
                    <CheckCircleIcon sx={{ fontSize: 14, color: T.ok }} />
                    <Typography
                      sx={{ fontSize: 12.5, color: T.ok, fontWeight: 500 }}
                    >
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box
                sx={{
                  p: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: T.blueDim,
                  border: `1px solid rgba(27,79,138,0.18)`,
                }}
              >
                <Typography sx={{ fontSize: 12.5, color: T.blue }}>
                  Your existing forecast history will be <strong>kept</strong>.
                  New forecasts will be added on top.
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
              <Button
                onClick={closeDialog}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontSize: 13,
                  color: T.textMuted,
                  border: `1px solid ${T.border}`,
                  px: 2,
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirmExtend}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: T.ok,
                  "&:hover": { backgroundColor: "#15803D" },
                  px: 2,
                }}
              >
                Continue with Extended Dataset
              </Button>
            </DialogActions>
          </>
        )}

        {dialogType === "replacement" && (
          <>
            <DialogTitle
              sx={{
                fontSize: 15,
                fontWeight: 700,
                color: T.textHead,
                pb: 1,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <WarningIcon sx={{ fontSize: 18, color: T.warnAccent }} /> Replace
              Existing Dataset?
            </DialogTitle>
            <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
            <DialogContent sx={{ pt: 2.5 }}>
              <Typography
                sx={{
                  fontSize: 13,
                  color: T.textBody,
                  lineHeight: 1.7,
                  mb: 1.5,
                }}
              >
                This dataset looks <strong>different</strong> from your existing
                one — barangays and disease types do not match.
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  mb: 1.5,
                }}
              >
                {["Barangays differ", "Disease types differ"].map((label) => (
                  <Box
                    key={label}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: "8px 12px",
                      borderRadius: "7px",
                      backgroundColor: T.dangerBg,
                      border: `1px solid ${T.dangerBorder}`,
                    }}
                  >
                    <ErrorIcon sx={{ fontSize: 14, color: T.danger }} />
                    <Typography
                      sx={{ fontSize: 12.5, color: T.danger, fontWeight: 500 }}
                    >
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box
                sx={{
                  p: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: T.dangerBg,
                  border: `1px solid ${T.dangerBorder}`,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 12.5,
                    color: T.danger,
                    fontWeight: 600,
                    mb: 0.5,
                  }}
                >
                  This will permanently clear:
                </Typography>
                <Typography sx={{ fontSize: 12, color: T.danger }}>
                  • All previous forecast history
                </Typography>
                <Typography sx={{ fontSize: 12, color: T.danger }}>
                  • Cached predictions and barangay data
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
              <Button
                onClick={closeDialog}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontSize: 13,
                  color: T.textMuted,
                  border: `1px solid ${T.border}`,
                  px: 2,
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirmReplace}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: T.danger,
                  "&:hover": { backgroundColor: "#B91C1C" },
                  px: 2,
                }}
              >
                Yes, Replace Dataset
              </Button>
            </DialogActions>
          </>
        )}

        {dialogType === "conflict" && (
          <>
            <DialogTitle
              sx={{
                fontSize: 15,
                fontWeight: 700,
                color: T.textHead,
                pb: 1,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <WarningIcon sx={{ fontSize: 18, color: T.warnAccent }} /> Partial
              Match Detected
            </DialogTitle>
            <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
            <DialogContent sx={{ pt: 2.5 }}>
              <Typography
                sx={{
                  fontSize: 13,
                  color: T.textBody,
                  lineHeight: 1.7,
                  mb: 1.5,
                }}
              >
                The new file <strong>partially matches</strong> your existing
                dataset. Some things align, others don't.
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  mb: 1.5,
                }}
              >
                {[
                  ["Barangays", dialogMeta?.barangaysMatch],
                  ["Disease types", dialogMeta?.diseasesMatch],
                ].map(([label, matches]) => (
                  <Box
                    key={label}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: "8px 12px",
                      borderRadius: "7px",
                      backgroundColor: matches ? T.okBg : T.dangerBg,
                      border: `1px solid ${matches ? T.okBorder : T.dangerBorder}`,
                    }}
                  >
                    {matches ? (
                      <CheckCircleIcon sx={{ fontSize: 14, color: T.ok }} />
                    ) : (
                      <ErrorIcon sx={{ fontSize: 14, color: T.danger }} />
                    )}
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: matches ? T.ok : T.danger,
                      }}
                    >
                      {label} {matches ? "match ✓" : "differ ✗"}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>
                How do you want to proceed?
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: "wrap" }}>
              <Button
                onClick={closeDialog}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontSize: 13,
                  color: T.textMuted,
                  border: `1px solid ${T.border}`,
                  px: 2,
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outlined"
                onClick={handleConfirmConflictContinue}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.warnAccent,
                  borderColor: T.warnBorder,
                  px: 2,
                }}
              >
                Continue Anyway
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirmReplace}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: T.danger,
                  "&:hover": { backgroundColor: "#B91C1C" },
                  px: 2,
                }}
              >
                Replace Everything
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default DataImport;
