import React from "react";
import {
  Box, Typography, Button, Container, Grid, Card, CardContent,
} from "@mui/material";
import {
  HealthAndSafety as HealthAndSafetyIcon,
  Psychology as PsychologyIcon,
  LocationOn as LocationOnIcon,
  TrendingUp as TrendingUpIcon,
  Group as GroupIcon,
  BarChart as BarChartIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";

const T = {
  blue: "#1B4F8A",
  blueMid: "#2260A8",
  sidebarBg: "#162032",
};

const features = [
  { icon: <PsychologyIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "ML-Powered Forecasting", desc: "Predicts disease trends up to 6 months ahead using time-series machine learning models." },
  { icon: <LocationOnIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Barangay-Level Insights", desc: "Drill down to specific barangays for localized health planning and resource allocation." },
  { icon: <TrendingUpIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Multi-Disease Monitoring", desc: "Track dengue, respiratory, tuberculosis, and more — all in one dashboard." },
  { icon: <GroupIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Age & Sex Breakdown", desc: "Understand which demographics are most at risk for each disease category." },
  { icon: <BarChartIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Interactive Charts", desc: "Visual forecast charts with actual vs. predicted data for easy interpretation." },
  { icon: <HealthAndSafetyIcon sx={{ fontSize: 28, color: "#4A90D9" }} />, title: "Data-Driven Planning", desc: "Empowers health personnel to make informed decisions backed by real data." },
];

const Landing = ({ onGoToLogin, onBrowse }) => {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#F4F6F8" }}>

      {/* ── Navbar ── */}
      <Box sx={{ backgroundColor: T.sidebarBg, px: { xs: 3, md: 8 }, py: 2,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: "10px", backgroundColor: T.blue,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HealthAndSafetyIcon sx={{ fontSize: 20, color: "#fff" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
              PredictHealth
            </Typography>
            <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.32)", letterSpacing: "1px", textTransform: "uppercase" }}>
              Barangay Health Forecasting
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button onClick={onBrowse} variant="outlined"
            sx={{ textTransform: "none", fontSize: 13, fontWeight: 600, borderRadius: "8px",
              borderColor: "rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.8)",
              "&:hover": { borderColor: "#fff", color: "#fff", backgroundColor: "rgba(255,255,255,0.08)" } }}>
            Browse Data
          </Button>
          <Button onClick={onGoToLogin} variant="contained"
            sx={{ textTransform: "none", fontSize: 13, fontWeight: 600, borderRadius: "8px",
              backgroundColor: T.blue, "&:hover": { backgroundColor: T.blueMid } }}>
            Sign In
          </Button>
        </Box>
      </Box>

      {/* ── Hero ── */}
      <Box sx={{ backgroundColor: T.sidebarBg, px: { xs: 3, md: 8 }, pt: 10, pb: 12, textAlign: "center" }}>
        <Typography sx={{ fontSize: { xs: 28, md: 42 }, fontWeight: 800,
          color: "rgba(255,255,255,0.93)", letterSpacing: "-1px", lineHeight: 1.2, mb: 2 }}>
          Smarter Health Planning
          <br />
          <Box component="span" sx={{ color: "#5B9FD4" }}>Powered by Machine Learning</Box>
        </Typography>
        <Typography sx={{ fontSize: 15, color: "rgba(255,255,255,0.45)", maxWidth: 520, mx: "auto", mb: 4, lineHeight: 1.75 }}>
          An ML-based system designed to analyze barangay health data and forecast disease trends to support data-driven planning.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
          <Button onClick={onBrowse} variant="contained" size="large"
            endIcon={<ArrowForwardIcon />}
            sx={{ textTransform: "none", fontSize: 14, fontWeight: 700, borderRadius: "10px",
              px: 4, py: 1.5, backgroundColor: T.blue, "&:hover": { backgroundColor: T.blueMid } }}>
            Browse Public Data
          </Button>
          <Button onClick={onGoToLogin} variant="outlined" size="large"
            sx={{ textTransform: "none", fontSize: 14, fontWeight: 600, borderRadius: "10px",
              px: 4, py: 1.5, borderColor: "rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.8)",
              "&:hover": { borderColor: "#fff", color: "#fff" } }}>
            Sign In
          </Button>
        </Box>
      </Box>

      {/* ── Features ── */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#111827",
          textAlign: "center", mb: 1, letterSpacing: "-0.5px" }}>
          Everything you need for health forecasting
        </Typography>
        <Typography sx={{ fontSize: 14, color: "#6B7280", textAlign: "center", mb: 5 }}>
          Built for barangay health personnel and local government units.
        </Typography>
        <Grid container spacing={3}>
          {features.map((f, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ borderRadius: "12px", border: "1px solid #E5E7EB",
                boxShadow: "none", height: "100%", "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }, transition: "box-shadow 0.2s" }}>
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

      {/* ── CTA ── */}
      <Box sx={{ backgroundColor: T.sidebarBg, py: 8, textAlign: "center" }}>
        <Typography sx={{ fontSize: 24, fontWeight: 800, color: "rgba(255,255,255,0.92)", mb: 1.5 }}>
          Ready to explore the data?
        </Typography>
        <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.4)", mb: 3 }}>
          Browse public forecasts or sign in to access the full dashboard.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
          <Button onClick={onBrowse} variant="contained"
            sx={{ textTransform: "none", fontSize: 13, fontWeight: 700, borderRadius: "9px",
              px: 3.5, py: 1.25, backgroundColor: T.blue, "&:hover": { backgroundColor: T.blueMid } }}>
            Browse Data
          </Button>
          <Button onClick={onGoToLogin} variant="outlined"
            sx={{ textTransform: "none", fontSize: 13, fontWeight: 600, borderRadius: "9px",
              px: 3.5, py: 1.25, borderColor: "rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.8)",
              "&:hover": { borderColor: "#fff", color: "#fff" } }}>
            Sign In
          </Button>
        </Box>
      </Box>

      {/* ── Footer ── */}
      <Box sx={{ backgroundColor: "#0F172A", py: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
          © 2025 PredictHealth · Barangay Health Forecasting System
        </Typography>
      </Box>
    </Box>
  );
};

export default Landing;