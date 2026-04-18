import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Card, CardContent,
  Select, MenuItem, CircularProgress,
} from "@mui/material";
import {
  HealthAndSafety as HealthAndSafetyIcon,
  LocationOn as LocationOnIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Lock as LockIcon,
} from "@mui/icons-material";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const T = {
  blue: "#1B4F8A",
  blueMid: "#2260A8",
  blueDim: "#EFF6FF",
  sidebarBg: "#162032",
  border: "#E5E7EB",
  textHead: "#111827",
  textBody: "#374151",
  textMuted: "#6B7280",
  pageBg: "#F4F6F8",
  ok: "#16A34A",
  okBg: "#F0FDF4",
  okBorder: "#86EFAC",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
};

const DISEASE_MAP = {
  dengue_cases:           { label: "Dengue",         color: "#2563EB", icon: "🦟" },
  respiratory_cases:      { label: "Respiratory",    color: "#0EA5E9", icon: "🫁" },
  tuberculosis_cases:     { label: "Tuberculosis",   color: "#92400E", icon: "🫁" },
  diarrhea_cases:         { label: "Diarrhea",       color: "#0EA5E9", icon: "💧" },
  hypertension_cases:     { label: "Hypertension",   color: "#F87171", icon: "❤️" },
  diabetes_cases:         { label: "Diabetes",       color: "#F59E0B", icon: "🩸" },
  covid_cases:            { label: "COVID-19",       color: "#7C3AED", icon: "🦠" },
  malnutrition_cases:     { label: "Malnutrition",   color: "#A3A3A3", icon: "⚕️" },
  pneumonia_cases:        { label: "Pneumonia",      color: "#6366F1", icon: "🫁" },
  leptospirosis_cases:    { label: "Leptospirosis",  color: "#065F46", icon: "🐀" },
};

const getDiseaseInfo = (col) => {
  if (DISEASE_MAP[col]) return DISEASE_MAP[col];
  const label = col.replace(/_cases$/, "").replace(/_/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase());
  return { label, color: T.blue, icon: "🏥" };
};

const getTrend = (preds) => {
  if (!preds || preds.length < 2) return "stable";
  const diff = preds[preds.length - 1] - preds[0];
  return diff > 0.5 ? "increasing" : diff < -0.5 ? "decreasing" : "stable";
};

const TrendIcon = ({ trend }) => {
  if (trend === "increasing") return <TrendingUpIcon sx={{ fontSize: 14, color: T.danger }} />;
  if (trend === "decreasing") return <TrendingDownIcon sx={{ fontSize: 14, color: T.ok }} />;
  return <RemoveIcon sx={{ fontSize: 14, color: T.textMuted }} />;
};

const PublicBrowse = ({ onGoToLogin }) => {
  const [barangays,        setBarangays]        = useState([]);
  const [diseases,         setDiseases]         = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState("__ALL__");
  const [selectedDisease,  setSelectedDisease]  = useState("all");
  const [forecastData,     setForecastData]     = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [initialLoading,   setInitialLoading]   = useState(true);
  const [cityLabel,        setCityLabel]        = useState("");

  // Load public dataset info
  useEffect(() => {
    fetch(`${API_BASE_URL}/public/dataset-info`)
      .then(r => r.json())
      .then(data => {
        if (data.barangays?.length)       setBarangays(data.barangays);
        if (data.disease_columns?.length) setDiseases(data.disease_columns);
        if (data.city)                    setCityLabel(data.city);
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  // Load forecast when barangay changes
  useEffect(() => {
    if (!barangays.length) return;
    setLoading(true);
    setForecastData(null);
    fetch(`${API_BASE_URL}/public/forecast?barangay=${encodeURIComponent(selectedBarangay)}`)
      .then(r => r.json())
      .then(data => { if (!data.not_found) setForecastData(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedBarangay, barangays]);

  const activeDiseases = forecastData
    ? (selectedDisease === "all"
        ? Object.keys(forecastData.predictions || {})
        : [selectedDisease].filter(d => forecastData.predictions?.[d]))
    : [];

  const chartData = forecastData
    ? (forecastData.forecast_dates || []).map((date, i) => {
        let value = 0;
        activeDiseases.forEach(d => {
          value += (forecastData.predictions[d] || [])[i] || 0;
        });
        return { month: date.slice(0, 7), value: Math.round(value) };
      })
    : [];

  const chartColor = selectedDisease !== "all" && DISEASE_MAP[selectedDisease]
    ? DISEASE_MAP[selectedDisease].color : T.blue;

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: T.pageBg }}>

      {/* ── Navbar ── */}
      <Box sx={{ backgroundColor: T.sidebarBg, px: { xs: 2, md: 4 }, py: 1.75,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: "9px", backgroundColor: T.blue,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HealthAndSafetyIcon sx={{ fontSize: 18, color: "#fff" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
              PredictHealth
            </Typography>
            <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.32)",
              letterSpacing: "1px", textTransform: "uppercase" }}>
              Barangay Health Forecasting
            </Typography>
          </Box>
        </Box>
        <Button onClick={onGoToLogin} variant="contained"
          startIcon={<LockIcon sx={{ fontSize: 13 }} />}
          sx={{ textTransform: "none", fontSize: 12, fontWeight: 700,
            borderRadius: "8px", px: 2.5, py: 0.85,
            backgroundColor: T.blue, "&:hover": { backgroundColor: T.blueMid } }}>
          Sign In
        </Button>
      </Box>

      {/* ── Header ── */}
      <Box sx={{ backgroundColor: T.sidebarBg, px: { xs: 2, md: 4 }, pt: 4, pb: 5 }}>
        <Typography sx={{ fontSize: { xs: 20, md: 28 }, fontWeight: 800,
          color: "rgba(255,255,255,0.93)", letterSpacing: "-0.5px", mb: 0.75 }}>
          Public Health Forecast Data
        </Typography>
        <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.4)", mb: 3, maxWidth: 480 }}>
          Browse disease forecasts for {cityLabel || "barangays"}. Sign in to access the full dashboard and generate new forecasts.
        </Typography>

        {/* Filters */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Select value={selectedBarangay} size="small"
            onChange={e => setSelectedBarangay(e.target.value)}
            sx={{ backgroundColor: "#fff", borderRadius: "8px", fontSize: 13,
              minWidth: 160, "& .MuiSelect-select": { py: "7px", px: "12px" } }}>
            <MenuItem value="__ALL__" sx={{ fontSize: 13 }}>All Barangays</MenuItem>
            {barangays.map(b => (
              <MenuItem key={b} value={b} sx={{ fontSize: 13 }}>{b}</MenuItem>
            ))}
          </Select>
          <Select value={selectedDisease} size="small"
            onChange={e => setSelectedDisease(e.target.value)}
            sx={{ backgroundColor: "#fff", borderRadius: "8px", fontSize: 13,
              minWidth: 150, "& .MuiSelect-select": { py: "7px", px: "12px" } }}>
            <MenuItem value="all" sx={{ fontSize: 13 }}>All Diseases</MenuItem>
            {diseases.map(d => (
              <MenuItem key={d} value={d} sx={{ fontSize: 13 }}>{getDiseaseInfo(d).label}</MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      {/* ── Content ── */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3, maxWidth: 1100, mx: "auto" }}>

        {initialLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress sx={{ color: T.blue }} />
          </Box>
        )}

        {!initialLoading && !barangays.length && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography sx={{ fontSize: 14, color: T.textMuted }}>
              No public forecast data available yet.
            </Typography>
          </Box>
        )}

        {!initialLoading && barangays.length > 0 && (
          <>
            {/* Chart */}
            <Card sx={{ borderRadius: "12px", border: `1px solid ${T.border}`,
              boxShadow: "none", mb: 2 }}>
              <CardContent sx={{ p: "18px 20px 14px", "&:last-child": { pb: "14px" } }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 2 }}>
                  Predicted Patient Volume
                </Typography>
                {loading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", height: 200, alignItems: "center" }}>
                    <CircularProgress size={24} sx={{ color: T.blue }} />
                  </Box>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false}
                        style={{ fontSize: 10, fill: T.textMuted }} />
                      <YAxis axisLine={false} tickLine={false}
                        style={{ fontSize: 10, fill: T.textMuted }} />
                      <RechartsTooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                      <Line type="monotone" dataKey="value" name="Predicted"
                        stroke={chartColor} strokeWidth={2} strokeDasharray="5 3"
                        dot={{ fill: chartColor, r: 3 }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography sx={{ fontSize: 13, color: T.textMuted }}>No forecast data available.</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Disease Cards */}
            {forecastData && !loading && (
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5, mb: 3 }}>
                {activeDiseases.slice(0, 8).map(d => {
                  const info  = getDiseaseInfo(d);
                  const preds = forecastData.predictions[d] || [];
                  const trend = getTrend(preds);
                  const latest = Math.round(preds[preds.length - 1] ?? 0);
                  return (
                    <Card key={d} sx={{ borderRadius: "10px", border: `1px solid ${T.border}`, boxShadow: "none" }}>
                      <CardContent sx={{ p: "14px", "&:last-child": { pb: "14px" } }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                          <Typography sx={{ fontSize: 18 }}>{info.icon}</Typography>
                          <TrendIcon trend={trend} />
                        </Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textHead, mb: 0.25 }}>
                          {info.label}
                        </Typography>
                        <Typography sx={{ fontSize: 20, fontWeight: 700, color: info.color }}>
                          {latest.toLocaleString()}
                        </Typography>
                        <Typography sx={{ fontSize: 10.5, color: T.textMuted }}>projected last month</Typography>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            )}

            {/* Sign In CTA */}
            <Card sx={{ borderRadius: "12px", border: `1px solid #BFDBFE`,
              boxShadow: "none", backgroundColor: T.blueDim }}>
              <CardContent sx={{ p: "20px 24px", "&:last-child": { pb: "20px" },
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.blue, mb: 0.5 }}>
                    🔒 Want full access?
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: T.textBody }}>
                    Sign in to generate forecasts, view detailed breakdowns, and export reports.
                  </Typography>
                </Box>
                <Button onClick={onGoToLogin} variant="contained"
                  sx={{ textTransform: "none", fontSize: 13, fontWeight: 700,
                    borderRadius: "9px", px: 3, py: 1,
                    backgroundColor: T.blue, "&:hover": { backgroundColor: T.blueMid } }}>
                  Sign In to Dashboard
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </Box>
  );
};

export default PublicBrowse;