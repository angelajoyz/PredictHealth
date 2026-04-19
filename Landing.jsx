import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Container, Grid, Card, CardContent,
  CircularProgress,
} from "@mui/material";
import {
  Psychology as PsychologyIcon,
  LocationOn as LocationOnIcon,
  TrendingUp as TrendingUpIcon,
  Group as GroupIcon,
  BarChart as BarChartIcon,
  MedicalServices as MedicalServicesIcon,
  CheckCircle as CheckCircleIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from "@mui/icons-material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  blue:      "#2563EB",
  blueMid:   "#1D4ED8",
  blueDim:   "#EFF6FF",
  border:    "#E2E8F0",
  textHead:  "#0F172A",
  textMuted: "#64748B",
  textFaint: "#94A3B8",
  ok:        "#22C55E",
  okBg:      "#F0FDF4",
  okBorder:  "#BBF7D0",
};

// ── Disease label map ─────────────────────────────────────────────────────────
const DISEASE_LABELS = {
  respiratory_cases:           "Respiratory",
  dengue_cases:                "Dengue",
  tuberculosis_cases:          "Tuberculosis",
  diarrhea_cases:              "Diarrhea",
  hypertension_cases:          "Hypertension",
  diabetes_cases:              "Diabetes",
  pneumonia_cases:             "Pneumonia",
  covid_cases:                 "COVID-19",
  cardiovascular_cases:        "Cardiovascular",
  gastrointestinal_cases:      "Gastrointestinal",
  malnutrition_cases:          "Malnutrition",
  malnutrition_prevalence_pct: "Malnutrition %",
  urinary_cases:               "Urinary/Renal",
  skin_cases:                  "Skin Disease",
  musculoskeletal_cases:       "Musculoskeletal",
  injury_cases:                "Injury/Trauma",
  infectious_cases:            "Other Infectious",
  viral_infection_cases:       "Viral Infection",
  blood_metabolic_cases:       "Blood/Metabolic",
  neurological_cases:          "Neurological",
  sensory_cases:               "Eye/Ear",
  mental_health_cases:         "Mental Health",
  maternal_cases:              "Maternal/OB",
  neoplasm_cases:              "Neoplasm/Cancer",
  leptospirosis_cases:         "Leptospirosis",
};

const getLabel = (col) =>
  DISEASE_LABELS[col] ||
  col.replace(/_cases$/, "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const trendBg     = (t) => t === "increasing" ? "#FEF2F2" : t === "decreasing" ? "#F0FDF4" : t === "warning" ? "#FFFBEB" : "#F9FAFB";
const trendBorder = (t) => t === "increasing" ? "#FECACA" : t === "decreasing" ? "#BBF7D0" : t === "warning" ? "#FDE68A" : "#E5E7EB";
const trendColor  = (t) => t === "increasing" ? "#EF4444" : t === "decreasing" ? "#22C55E" : t === "warning" ? "#F59E0B" : "#64748B";
const trendIcon   = (t) => t === "increasing" ? "↑" : t === "decreasing" ? "↓" : t === "warning" ? "⚠" : "—";

const getTrend = (preds) => {
  if (!preds || preds.length < 2) return "stable";
  const diff = preds[preds.length - 1] - preds[0];
  return diff > 0.5 ? "increasing" : diff < -0.5 ? "decreasing" : "stable";
};

const getPct = (preds) => {
  if (!preds || preds.length < 2 || !preds[0]) return null;
  const pct = ((preds[preds.length - 1] - preds[0]) / preds[0]) * 100;
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, icon, topColor, value, valueSub, sub }) => (
  <Box sx={{
    flex: 1, p: "14px 16px", borderRadius: "10px", backgroundColor: "#fff",
    border: `1px solid ${T.border}`, borderTop: `3px solid ${topColor}`, minWidth: 0,
  }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.25 }}>
      <Typography sx={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.6px", color: T.textFaint }}>
        {label}
      </Typography>
      <Box sx={{ width: 26, height: 26, borderRadius: "6px", backgroundColor: T.blueDim,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </Box>
    </Box>
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: T.textHead, lineHeight: 1, letterSpacing: "-0.5px" }}>
        {value}
      </Typography>
      {valueSub && (
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>{valueSub}</Typography>
      )}
    </Box>
    <Typography sx={{ fontSize: 10, color: T.textFaint, mt: 0.3 }}>{sub}</Typography>
  </Box>
);

// ── Custom Chart Tooltip ──────────────────────────────────────────────────────
const ComboTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: "8px",
      p: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.textHead, mb: 0.5 }}>{label}</Typography>
      {payload.map((entry, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: entry.color }} />
          <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>{entry.name}:</Typography>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: T.textHead }}>{entry.value}</Typography>
        </Box>
      ))}
    </Box>
  );
};

// ── Dashboard Preview ─────────────────────────────────────────────────────────
const DashboardPreview = () => {
  const [barangays,      setBarangays]      = useState([]);
  const [selectedBrgy,   setSelectedBrgy]   = useState("__ALL__");
  const [selectedDisease, setSelectedDisease] = useState("__ALL__");
  const [forecastData,   setForecastData]   = useState(null);
  const [cityLabel,      setCityLabel]      = useState("");
  const [loading,        setLoading]        = useState(true);
  const [brgyOpen,       setBrgyOpen]       = useState(false);
  const [diseaseOpen,    setDiseaseOpen]    = useState(false);

  // Fetch dataset info (barangay list + city)
  useEffect(() => {
    fetch(`${API_BASE_URL}/public/dataset-info`)
      .then((r) => r.json())
      .then((d) => {
        if (d.barangays?.length) setBarangays(d.barangays);
        if (d.city)              setCityLabel(d.city);
      })
      .catch(() => {});
  }, []);

  // Fetch forecast whenever barangay selection changes
  useEffect(() => {
    setLoading(true);
    setForecastData(null);
    setSelectedDisease("__ALL__"); // reset disease on barangay change
    fetch(`${API_BASE_URL}/public/forecast?barangay=${encodeURIComponent(selectedBrgy)}`)
      .then((r) => r.json())
      .then((d) => { if (!d.not_found) setForecastData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedBrgy]);

  // Derived values from real forecast data
  const forecastDates  = forecastData?.forecast_dates  || [];
  const predictions    = forecastData?.predictions     || {};
  const diseaseColumns = forecastData?.disease_columns || Object.keys(predictions);

  // Active columns based on disease selection
  const activeCols = selectedDisease === "__ALL__" ? diseaseColumns : [selectedDisease];

  // Sum active diseases per month for chart
  const chartData = forecastDates.map((date, i) => {
    const total = activeCols.reduce((sum, d) => sum + ((predictions[d] || [])[i] || 0), 0);
    return { month: date.slice(0, 7), predicted: Math.round(total) };
  });

  // Current & next month values
  const now        = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextKey    = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}`;
  const currentIdx = forecastDates.findIndex((d) => d.slice(0, 7) === currentKey);
  const nextIdx    = forecastDates.findIndex((d) => d.slice(0, 7) === nextKey);
  const getSum = (idx) =>
    idx >= 0
      ? Math.round(activeCols.reduce((s, d) => s + ((predictions[d] || [])[idx] || 0), 0))
      : null;
  const thisMonthVal = getSum(currentIdx) ?? (chartData[0]?.predicted ?? null);
  const nextMonthVal = getSum(nextIdx)    ?? (chartData[1]?.predicted ?? null);
  const currentLabel = now.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  const nextDate     = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextLabel    = nextDate.toLocaleDateString("en-PH", { month: "long", year: "numeric" });

  const forecastPeriodLabel = forecastDates.length
    ? `${forecastDates[0].slice(0, 7)} – ${forecastDates[forecastDates.length - 1].slice(0, 7)}`
    : "—";

  // Build trend results
  const buildTrends = () => {
    if (!forecastData || diseaseColumns.length === 0) return [];
    const items = [];
    const increasing = [];
    const targetCols = selectedDisease === "__ALL__" ? diseaseColumns : [selectedDisease];
    targetCols.forEach((d) => {
      const preds = predictions[d] || [];
      const trend = getTrend(preds);
      const pct   = getPct(preds);
      const label = getLabel(d);
      const loc   = selectedBrgy === "__ALL__" ? "all barangays" : selectedBrgy;
      if (trend === "increasing") {
        increasing.push(d);
        items.push({ type: "increasing", text: `${label} cases are projected to increase${pct ? " by " + pct : ""} in ${loc} — monitoring recommended.` });
      } else if (trend === "decreasing") {
        items.push({ type: "decreasing", text: `${label} cases are projected to decline${pct ? " by " + pct : ""} in ${loc} — positive outlook.` });
      } else {
        items.push({ type: "stable", text: `${label} cases are expected to remain stable in ${loc}.` });
      }
    });
    if (selectedDisease === "__ALL__" && increasing.length >= 2) {
      items.unshift({ type: "warning", text: `${increasing.length} disease categories are trending upward simultaneously — health interventions may be needed.` });
    }
    return items;
  };

  const trendItems = buildTrends();
  const brgyLabel    = selectedBrgy    === "__ALL__" ? "All Barangays" : selectedBrgy;
  const diseaseLabel = selectedDisease === "__ALL__" ? "All Categories" : getLabel(selectedDisease);

  // Chart legend label
  const chartLegendLabel = selectedDisease === "__ALL__" ? "All Categories" : getLabel(selectedDisease);

  return (
    <Box sx={{ backgroundColor: "#F8FAFC", p: "18px", display: "flex", flexDirection: "column", gap: "11px",
      borderRadius: "12px", border: `1px solid ${T.border}` }}>

      {/* Controls bar */}
      <Box sx={{ p: "11px 14px", borderRadius: "10px", backgroundColor: "#fff", border: `1px solid ${T.border}` }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>

          {/* Barangay selector */}
          <Box sx={{ position: "relative" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Barangay:</Typography>
              <Box
                onClick={() => { setBrgyOpen((p) => !p); setDiseaseOpen(false); }}
                sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer",
                  border: `1px solid ${T.border}`, borderRadius: "8px", px: 1.25, py: "5px",
                  backgroundColor: "#fff", "&:hover": { borderColor: T.blue } }}>
                <Typography sx={{ fontSize: 12.5, color: T.textHead, maxWidth: 160,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {brgyLabel}
                </Typography>
                <ArrowDownIcon sx={{ fontSize: 14, color: T.textFaint,
                  transform: brgyOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </Box>
            </Box>
            {brgyOpen && (
              <Box sx={{ position: "absolute", top: "110%", left: 60, zIndex: 50,
                backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto", minWidth: 200 }}>
                {[{ value: "__ALL__", label: "All Barangays" }, ...barangays.map((b) => ({ value: b, label: b }))].map((opt) => (
                  <Box key={opt.value}
                    onClick={() => { setSelectedBrgy(opt.value); setBrgyOpen(false); }}
                    sx={{ px: 2, py: 1.1, fontSize: 12.5,
                      color: opt.value === selectedBrgy ? T.blue : T.textHead,
                      fontWeight: opt.value === selectedBrgy ? 600 : 400,
                      cursor: "pointer",
                      backgroundColor: opt.value === selectedBrgy ? T.blueDim : "transparent",
                      "&:hover": { backgroundColor: "#F8FAFC" } }}>
                    {opt.label}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Disease selector */}
          <Box sx={{ position: "relative" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Disease:</Typography>
              <Box
                onClick={() => { setDiseaseOpen((p) => !p); setBrgyOpen(false); }}
                sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer",
                  border: `1px solid ${T.border}`, borderRadius: "8px", px: 1.25, py: "5px",
                  backgroundColor: "#fff", "&:hover": { borderColor: T.blue } }}>
                <Typography sx={{ fontSize: 12.5, color: T.textHead, maxWidth: 160,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {diseaseLabel}
                </Typography>
                <ArrowDownIcon sx={{ fontSize: 14, color: T.textFaint,
                  transform: diseaseOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </Box>
            </Box>
            {diseaseOpen && (
              <Box sx={{ position: "absolute", top: "110%", left: 60, zIndex: 50,
                backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto", minWidth: 200 }}>
                {[
                  { value: "__ALL__", label: "All Categories" },
                  ...diseaseColumns.map((d) => ({ value: d, label: getLabel(d) })),
                ].map((opt) => (
                  <Box key={opt.value}
                    onClick={() => { setSelectedDisease(opt.value); setDiseaseOpen(false); }}
                    sx={{ px: 2, py: 1.1, fontSize: 12.5,
                      color: opt.value === selectedDisease ? T.blue : T.textHead,
                      fontWeight: opt.value === selectedDisease ? 600 : 400,
                      cursor: "pointer",
                      backgroundColor: opt.value === selectedDisease ? T.blueDim : "transparent",
                      "&:hover": { backgroundColor: "#F8FAFC" } }}>
                    {opt.label}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

        </Box>
      </Box>

      {/* Status banner */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1,
        borderRadius: "8px", backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
        <CheckCircleIcon sx={{ fontSize: 14, color: T.ok }} />
        <Typography sx={{ fontSize: 12.5, color: "#1E293B" }}>
          Public preview showing forecast for <strong>{brgyLabel}</strong>
          {selectedDisease !== "__ALL__" && <> · <strong>{diseaseLabel}</strong></>}
        </Typography>
      </Box>

      {/* Stat cards */}
      <Box sx={{ display: "flex", gap: "10px" }}>
        <StatCard
          label="Location" topColor={T.blue}
          value={cityLabel || "—"} sub={brgyLabel}
          icon={<LocationOnIcon sx={{ fontSize: 14, color: T.blue }} />}
        />
        <StatCard
          label="This Month" topColor={T.blue}
          value={loading ? "…" : (thisMonthVal !== null ? thisMonthVal.toLocaleString() : "—")}
          sub={currentLabel}
          icon={<GroupIcon sx={{ fontSize: 14, color: T.blue }} />}
        />
        <StatCard
          label="Next Month" topColor="#EF4444"
          value={loading ? "…" : (nextMonthVal !== null ? nextMonthVal.toLocaleString() : "—")}
          sub={nextLabel}
          icon={<TrendingUpIcon sx={{ fontSize: 14, color: "#EF4444" }} />}
        />
        <StatCard
          label="Forecast Period" topColor={T.ok}
          value={forecastDates.length || "—"}
          valueSub={forecastDates.length ? " Months" : ""}
          sub={forecastPeriodLabel}
          icon={<BarChartIcon sx={{ fontSize: 14, color: T.ok }} />}
        />
      </Box>

      {/* Chart */}
      <Box sx={{ px: 0.5, pt: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>Predicted Patient Volume</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: "10px", py: "3px",
            borderRadius: "20px", backgroundColor: `${T.blue}18`, border: `1px solid ${T.blue}40` }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: T.blue }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.blue }}>{chartLegendLabel}</Typography>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180 }}>
            <CircularProgress size={24} sx={{ color: T.blue }} />
          </Box>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false}
                style={{ fontSize: 10, fill: T.textFaint }} />
              <YAxis axisLine={false} tickLine={false}
                style={{ fontSize: 10, fill: T.textFaint }} />
              <RechartsTooltip content={<ComboTooltip />} />
              <Line type="monotone" dataKey="predicted" name="Predicted" stroke={T.blue}
                strokeWidth={2} strokeDasharray="5 3"
                dot={{ fill: T.blue, r: 2.5, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: T.blue, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180 }}>
            <Typography sx={{ fontSize: 13, color: T.textMuted }}>No forecast data available yet.</Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", justifyContent: "center", mt: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 18, height: 2, borderRadius: 1,
              backgroundImage: `repeating-linear-gradient(90deg,${T.blue} 0,${T.blue} 5px,transparent 5px,transparent 8px)` }} />
            <Typography sx={{ fontSize: 11, color: T.textMuted }}>Predicted</Typography>
          </Box>
        </Box>
      </Box>

      {/* Results */}
      <Box sx={{ px: 0.5, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>Results</Typography>
          <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>{diseaseLabel} · {brgyLabel}</Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 3 }}>
            <CircularProgress size={20} sx={{ color: T.blue }} />
          </Box>
        ) : trendItems.length === 0 ? (
          <Box sx={{ py: 2, textAlign: "center" }}>
            <Typography sx={{ fontSize: 13, color: T.textMuted }}>No forecast data available yet.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {trendItems.map((item, i) => (
              <Box key={i} sx={{
                display: "flex", alignItems: "center", gap: 1.5, p: "9px 12px",
                borderRadius: "8px", backgroundColor: trendBg(item.type),
                border: `1px solid ${trendBorder(item.type)}`,
              }}>
                <Box sx={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: trendBg(item.type), border: `1px solid ${trendBorder(item.type)}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: trendColor(item.type) }}>
                  {trendIcon(item.type)}
                </Box>
                <Typography sx={{ fontSize: 12.5, color: "#1E293B", lineHeight: 1.5, flex: 1 }}>
                  {item.text}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ── Animated Counter ──────────────────────────────────────────────────────────
const Counter = ({ target, suffix = "", duration = 1800 }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{count.toLocaleString()}{suffix}</>;
};

const stats = [
  { value: 33,   suffix: "",  label: "Barangays Covered",  sub: "All barangays in General Trias" },
  { value: 20,   suffix: "+", label: "Disease Categories", sub: "From CHO morbidity data"        },
  { value: 12,   suffix: "",  label: "Months Forecasted",  sub: "Full-year disease outlook"       },
  { value: 2024, suffix: "",  label: "Latest Data Year",   sub: "CHO General Trias records"       },
];

const features = [
  { icon: <PsychologyIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "LSTM-Based Disease Forecasting", desc: "Predicts disease case volumes up to 12 months ahead using time-series machine learning trained on General Trias health records." },
  { icon: <LocationOnIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Per-Barangay Analysis", desc: "Explore forecasts for each of the 33 barangays in General Trias for localized health insights." },
  { icon: <TrendingUpIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Multi-Disease Monitoring", desc: "Track dengue, respiratory illness, tuberculosis, hypertension, diarrhea, and more — all sourced from CHO records." },
  { icon: <GroupIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Select by Disease Category", desc: "Filter forecasts by specific disease types or view all categories together." },
  { icon: <BarChartIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Trend Analysis", desc: "View health trends and forecasted patterns to understand disease progression and seasonal variations." },
  { icon: <MedicalServicesIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Data from CHO General Trias", desc: "All forecasts are based on official morbidity records from the City Health Office Pinagtipunan of General Trias." },
];

const PredictHealthLogo = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" /><stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
    </defs>
    <path d="M50 85 C50 85 15 62 15 38 C15 26 24 18 35 18 C41 18 47 21 50 26 C53 21 59 18 65 18 C76 18 85 26 85 38 C85 62 50 85 50 85Z" fill="url(#lg1)" opacity="0.92"/>
    <polyline points="20,44 32,44 37,32 42,56 47,38 52,44 64,44" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <rect x="68" y="14" width="5" height="14" rx="1.5" fill="white" opacity="0.95"/>
    <rect x="64" y="18" width="13" height="5" rx="1.5" fill="white" opacity="0.95"/>
  </svg>
);

// ── Main Landing ──────────────────────────────────────────────────────────────
const Landing = ({ onGoToLogin }) => {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#F4F6F8" }}>

      {/* ── Navbar ── */}
      <Box sx={{ backgroundColor: "#162032", px: { xs: 3, md: 8 }, py: 1.75,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <PredictHealthLogo size={34} />
          <Box>
            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: "rgba(255,255,255,0.92)", lineHeight: 1.2 }}>PredictHealth</Typography>
            <Typography sx={{ fontSize: 8.5, color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase" }}>General Trias · Disease Forecasting System</Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Hero ── */}
      <Box sx={{ backgroundColor: "#162032", px: { xs: 3, md: 8 }, pt: { xs: 8, md: 11 }, pb: { xs: 8, md: 13 },
        textAlign: "center", position: "relative", overflow: "hidden" }}>
        <Box sx={{ position: "absolute", width: 600, height: 600, top: "50%", left: "50%",
          transform: "translate(-50%,-50%)", borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(74,144,217,0.08) 0%, transparent 70%)" }} />
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75,
          px: 1.75, py: 0.6, borderRadius: "20px", mb: 3,
          backgroundColor: "rgba(74,144,217,0.12)", border: "1px solid rgba(74,144,217,0.3)" }}>
          <LocationOnIcon sx={{ fontSize: 13, color: "#4A90D9" }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#4A90D9" }}>General Trias City, Cavite</Typography>
        </Box>
        <Typography sx={{ fontSize: { xs: 26, md: 44 }, fontWeight: 800,
          color: "rgba(255,255,255,0.93)", letterSpacing: "-1px", lineHeight: 1.18, mb: 2 }}>
            Health Trends Forecasting<br />
          <Box component="span" sx={{ color: "#5B9FD4" }}>for General Trias City</Box>
        </Typography>
        <Typography sx={{ fontSize: { xs: 13, md: 15 }, color: "rgba(255,255,255,0.42)",
          maxWidth: 560, mx: "auto", mb: 1.5, lineHeight: 1.8 }}>
          Powered by machine learning and data from the{" "}
          <Box component="span" sx={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>City Health Office of General Trias</Box>
          {" "}— forecasting disease trends across all{" "}
          <Box component="span" sx={{ color: "#5B9FD4", fontWeight: 600 }}>33 barangays</Box>
          {" "} to support community health awareness and public health planning.
        </Typography>
      </Box>

      {/* ── About ── */}
      <Box sx={{ backgroundColor: "#fff", py: { xs: 6, md: 8 }, px: { xs: 3, md: 8 } }}>
        <Container maxWidth="lg">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 6, alignItems: "center" }}>
            <Box>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75,
                px: 1.5, py: 0.5, borderRadius: "20px", mb: 2,
                backgroundColor: "rgba(14,124,58,0.08)", border: "1px solid rgba(14,124,58,0.2)" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#0E7C3A" }}>🏥 About This System</Typography>
              </Box>
              <Typography sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 800, color: "#0F172A", mb: 2, lineHeight: 1.3 }}>
                Health Trends Forecasting for General Trias
              </Typography>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563", lineHeight: 1.85, mb: 2 }}>
                PredictHealth is an ML-based health forecasting system developed for the{" "}
                <strong>City of General Trias, Cavite</strong>.
                It uses LSTM neural networks trained on morbidity data records compiled by the{" "}
                <strong>City Health Office (CHO) Pinagtipunan</strong>.
              </Typography>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563", lineHeight: 1.85, mb: 3 }}>
                The system helps the public understand disease trends and supports health personnel in planning community health interventions across all barangays.
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {["Data sourced from CHO morbidity records","Covers all 33 barangays of General Trias City","Supports community health awareness and planning"].map((item, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                    <Box sx={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, mt: "1px",
                      backgroundColor: "rgba(27,79,138,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Typography sx={{ fontSize: 10, color: "#1B4F8A" }}>✓</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{item}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { icon: "🏛️", title: "City Health Office (CHO)", desc: "General Trias City, Cavite — provides all morbidity records and disease surveillance data for forecasting.", color: "#1B4F8A", bg: "#EFF6FF", border: "#BFDBFE" },
                { icon: "🏥", title: "Barangay Health Centers (BHCs)", desc: "Present in all 33 barangays — the frontline of community health services in General Trias.", color: "#0E7C3A", bg: "#F0FDF4", border: "#BBF7D0" },
                { icon: "🤖", title: "LSTM Machine Learning", desc: "Trained on years of CHO data to forecast disease trends month-by-month for each barangay.", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
              ].map((card, i) => (
                <Box key={i} sx={{ p: 2.5, borderRadius: "12px", backgroundColor: card.bg,
                  border: `1px solid ${card.border}`, display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <Box sx={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>{card.icon}</Box>
                  <Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: card.color, mb: 0.4 }}>{card.title}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>{card.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── Features ── */}
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 8 }, pb: { xs: 3, md: 4 } }}>
        <Box sx={{ textAlign: "center", mb: 5 }}>
          <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, color: "#111827", mb: 1, letterSpacing: "-0.5px" }}>
            Accessible and Reliable Health Information
          </Typography>
          <Typography sx={{ fontSize: 14, color: "#6B7280" }}>Explore disease forecasts and trends for General Trias City.</Typography>
        </Box>
        <Grid container spacing={2.5}>
          {features.map((f, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "none", height: "100%",
                "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.08)", transform: "translateY(-2px)" }, transition: "all 0.2s ease" }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ mb: 1.5 }}>{f.icon}</Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827", mb: 0.75 }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{f.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ── Dashboard Preview ── */}
      <Box sx={{ backgroundColor: "#F1F5F9", pt: { xs: 2, md: 3 }, pb: { xs: 4, md: 6 } }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 800, color: "#0F172A", mb: 1 }}>
              Explore Disease Forecasts
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 3 }}>
              View 12-month disease forecasts for all barangays in General Trias. Select a barangay and disease category to see predicted case volumes and trends.
            </Typography>
          </Box>
          <DashboardPreview />
        </Container>
      </Box>

      {/* ── Footer ── */}
      <Box sx={{ backgroundColor: "#0A0F1A", py: 3, textAlign: "center", px: 3 }}>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.18)", mb: 0.5 }}>
          © PredictHealth · Health Forecasting System
        </Typography>
        <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.12)" }}>
          Data source: City Health Office Pinagtipunan ·{" "}
          <Box
            component="span"
            onClick={onGoToLogin}
            sx={{
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationColor: "rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.18)",
              "&:hover": { color: "rgba(255,255,255,0.35)" },
              transition: "color 0.2s",
            }}
          >
            For authorized personnel only
          </Box>
        </Typography>
      </Box>

    </Box>
  );
};

export default Landing;