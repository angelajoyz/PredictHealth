import React, { useState, useEffect } from "react";
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
  MedicalServices as MedicalServicesIcon,
  Lock as LockIcon,
  OpenInFull as OpenInFullIcon,
} from "@mui/icons-material";
import Dashboard from "./Dashboard";

const T = {
  blue:      "#1B4F8A",
  blueMid:   "#2260A8",
  blueLight: "#4A90D9",
  sidebarBg: "#162032",
  cavite:    "#0E7C3A", // green accent — Cavite province color
};

const features = [
  {
    icon: <PsychologyIcon sx={{ fontSize: 28, color: T.blueLight }} />,
    title: "LSTM-Based Disease Forecasting",
    desc:  "Predicts disease case volumes up to 12 months ahead using time-series machine learning trained on General Trias health records.",
  },
  {
    icon: <LocationOnIcon sx={{ fontSize: 28, color: T.blueLight }} />,
    title: "Per-Barangay Analysis",
    desc:  "Drill down to each barangay in General Trias — from Alingaro to Zulueta — for localized health planning and resource allocation.",
  },
  {
    icon: <TrendingUpIcon sx={{ fontSize: 28, color: T.blueLight }} />,
    title: "Multi-Disease Monitoring",
    desc:  "Track dengue, respiratory illness, tuberculosis, hypertension, diarrhea, and more — all sourced from CHO General Trias records.",
  },
  {
    icon: <GroupIcon sx={{ fontSize: 28, color: T.blueLight }} />,
    title: "Age & Sex Breakdown",
    desc:  "Understand which age groups and sex are most at risk per disease category in each barangay health center catchment area.",
  },
  {
    icon: <BarChartIcon sx={{ fontSize: 28, color: T.blueLight }} />,
    title: "Actual vs. Predicted Charts",
    desc:  "Compare CHO-reported actual case counts against LSTM predictions to assess forecast accuracy and seasonal patterns.",
  },
  {
    icon: <MedicalServicesIcon sx={{ fontSize: 28, color: T.blueLight }} />,
    title: "CHO-Integrated Data Pipeline",
    desc:  "Data is sourced directly from the City Health Office of General Trias — ensuring forecasts reflect real local health conditions.",
  },
];

// ── Animated counter ──────────────────────────────────────────────────────────
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
  { value: 64,   suffix: "",  label: "Barangays Covered",      sub: "All barangays in General Trias" },
  { value: 20,   suffix: "+", label: "Disease Categories",     sub: "From CHO morbidity data"        },
  { value: 12,   suffix: "",  label: "Months Forecasted",      sub: "Full-year disease outlook"       },
  { value: 2024, suffix: "",  label: "Latest Data Year",       sub: "CHO General Trias records"       },
];

// ── Logo SVG ─────────────────────────────────────────────────────────────────
const PredictHealthLogo = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
    </defs>
    <path d="M50 85 C50 85 15 62 15 38 C15 26 24 18 35 18 C41 18 47 21 50 26 C53 21 59 18 65 18 C76 18 85 26 85 38 C85 62 50 85 50 85Z"
      fill="url(#lg1)" opacity="0.92"/>
    <polyline points="20,44 32,44 37,32 42,56 47,38 52,44 64,44"
      stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <rect x="68" y="14" width="5" height="14" rx="1.5" fill="white" opacity="0.95"/>
    <rect x="64" y="18" width="13" height="5" rx="1.5" fill="white" opacity="0.95"/>
  </svg>
);

// ── Main Landing Component ────────────────────────────────────────────────────
const Landing = ({ onGoToLogin, onBrowse }) => {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#F4F6F8" }}>

      {/* ── Navbar ── */}
      <Box sx={{
        backgroundColor: T.sidebarBg,
        px: { xs: 3, md: 8 }, py: 1.75,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <PredictHealthLogo size={34} />
          <Box>
            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: "rgba(255,255,255,0.92)", lineHeight: 1.2 }}>
              PredictHealth
            </Typography>
            <Typography sx={{ fontSize: 8.5, color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase" }}>
              General Trias · Barangay Health Forecasting
            </Typography>
          </Box>
        </Box>

        {/* CHO badge */}
        <Box sx={{
          display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1,
          px: 1.5, py: 0.6, borderRadius: "20px",
          backgroundColor: "rgba(14,124,58,0.2)",
          border: "1px solid rgba(14,124,58,0.4)",
        }}>
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#4ADE80", flexShrink: 0,
            boxShadow: "0 0 6px #4ADE80", animation: "pulse 2s infinite",
            "@keyframes pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.4 } },
          }} />
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#4ADE80" }}>
            CHO General Trias — Live Data
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.25 }}>
          <Button onClick={onBrowse} variant="outlined"
            sx={{
              textTransform: "none", fontSize: 12.5, fontWeight: 600, borderRadius: "8px",
              borderColor: "rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.75)", px: 2,
              "&:hover": { borderColor: "#fff", color: "#fff", backgroundColor: "rgba(255,255,255,0.07)" },
            }}>
            Browse Data
          </Button>
          <Button onClick={onGoToLogin} variant="contained"
            sx={{
              textTransform: "none", fontSize: 12.5, fontWeight: 700, borderRadius: "8px",
              backgroundColor: T.blue, px: 2.5,
              "&:hover": { backgroundColor: T.blueMid },
            }}>
            Sign In
          </Button>
        </Box>
      </Box>

      {/* ── Hero ── */}
      <Box sx={{
        backgroundColor: T.sidebarBg,
        px: { xs: 3, md: 8 }, pt: { xs: 8, md: 11 }, pb: { xs: 8, md: 13 },
        textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        {/* Background glow */}
        <Box sx={{
          position: "absolute", width: 600, height: 600,
          top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(74,144,217,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Location badge */}
        <Box sx={{
          display: "inline-flex", alignItems: "center", gap: 0.75,
          px: 1.75, py: 0.6, borderRadius: "20px", mb: 3,
          backgroundColor: "rgba(74,144,217,0.12)",
          border: "1px solid rgba(74,144,217,0.3)",
        }}>
          <LocationOnIcon sx={{ fontSize: 13, color: T.blueLight }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.blueLight }}>
            General Trias City, Cavite
          </Typography>
        </Box>

        <Typography sx={{
          fontSize: { xs: 26, md: 44 }, fontWeight: 800,
          color: "rgba(255,255,255,0.93)", letterSpacing: "-1px", lineHeight: 1.18, mb: 2,
        }}>
          Health Forecasting for
          <br />
          <Box component="span" sx={{ color: "#5B9FD4" }}>Barangay Health Centers</Box>
        </Typography>

        <Typography sx={{
          fontSize: { xs: 13, md: 15 }, color: "rgba(255,255,255,0.42)",
          maxWidth: 560, mx: "auto", mb: 1.5, lineHeight: 1.8,
        }}>
          Powered by machine learning and data from the{" "}
          <Box component="span" sx={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
            City Health Office of General Trias
          </Box>
          {" "}— forecasting disease trends across all{" "}
          <Box component="span" sx={{ color: "#5B9FD4", fontWeight: 600 }}>
            64 barangays
          </Box>{" "}
          to support health planning and early intervention.
        </Typography>

        <Typography sx={{
          fontSize: 12, color: "rgba(255,255,255,0.25)", mb: 4.5,
          fontStyle: "italic",
        }}>
          Data pinagtipunan ng CHO General Trias para sa mas epektibong serbisyong pangkalusugan.
        </Typography>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
          <Button onClick={onBrowse} variant="contained" size="large"
            endIcon={<ArrowForwardIcon />}
            sx={{
              textTransform: "none", fontSize: 14, fontWeight: 700, borderRadius: "10px",
              px: 4, py: 1.5, backgroundColor: T.blue,
              boxShadow: "0 4px 20px rgba(27,79,138,0.45)",
              "&:hover": { backgroundColor: T.blueMid, transform: "translateY(-1px)", boxShadow: "0 6px 24px rgba(27,79,138,0.5)" },
              transition: "all 0.18s ease",
            }}>
            View Public Forecasts
          </Button>
          <Button onClick={onGoToLogin} variant="outlined" size="large"
            sx={{
              textTransform: "none", fontSize: 14, fontWeight: 600, borderRadius: "10px",
              px: 4, py: 1.5, borderColor: "rgba(255,255,255,0.28)", color: "rgba(255,255,255,0.78)",
              "&:hover": { borderColor: "#fff", color: "#fff", backgroundColor: "rgba(255,255,255,0.05)" },
            }}>
            Sign In to Dashboard
          </Button>
        </Box>
      </Box>

      {/* ── Stats strip ── */}
      <Box sx={{ backgroundColor: "#0F172A", py: 0 }}>
        <Box sx={{
          display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" },
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          {stats.map((s, i) => (
            <Box key={i} sx={{
              py: 3.5, px: 3, textAlign: "center",
              borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <Typography sx={{ fontSize: { xs: 28, md: 34 }, fontWeight: 800, color: "#fff", lineHeight: 1, mb: 0.5 }}>
                <Counter target={s.value} suffix={s.suffix} />
              </Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.6)", mb: 0.3 }}>
                {s.label}
              </Typography>
              <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.28)" }}>
                {s.sub}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── About section ── */}
      <Box sx={{ backgroundColor: "#fff", py: { xs: 6, md: 8 }, px: { xs: 3, md: 8 } }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 6, alignItems: "center",
          }}>
            <Box>
              <Box sx={{
                display: "inline-flex", alignItems: "center", gap: 0.75,
                px: 1.5, py: 0.5, borderRadius: "20px", mb: 2,
                backgroundColor: "rgba(14,124,58,0.08)",
                border: "1px solid rgba(14,124,58,0.2)",
              }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.cavite }}>
                  🏥 About This System
                </Typography>
              </Box>
              <Typography sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 800, color: "#0F172A", mb: 2, lineHeight: 1.3 }}>
                Built for the BHCs of General Trias, Cavite
              </Typography>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563", lineHeight: 1.85, mb: 2 }}>
                PredictHealth is an ML-based health forecasting system developed specifically for the
                {" "}<strong>Barangay Health Centers (BHC)</strong> of General Trias City, Cavite.
                It uses LSTM (Long Short-Term Memory) neural networks trained on historical morbidity data
                compiled by the <strong>City Health Office (CHO)</strong>.
              </Typography>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563", lineHeight: 1.85, mb: 3 }}>
                The system helps health personnel, BHC midwives, and CHO staff anticipate disease surges,
                allocate resources proactively, and plan health interventions across all barangays —
                from Alingaro to Zulueta.
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {[
                  "Data sourced exclusively from CHO General Trias morbidity records",
                  "Covers all 64 barangays under the City Health Office",
                  "Supports BHC-level health planning and budgeting",
                  "Accessible to authorized CHO and BHC health personnel",
                ].map((item, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                    <Box sx={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0, mt: "1px",
                      backgroundColor: "rgba(27,79,138,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Typography sx={{ fontSize: 10, color: T.blue }}>✓</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{item}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Right: visual info cards */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                {
                  icon: "🏛️",
                  title: "City Health Office (CHO)",
                  desc: "General Trias City, Cavite — primary data source for all morbidity records and disease surveillance.",
                  color: "#1B4F8A", bg: "#EFF6FF", border: "#BFDBFE",
                },
                {
                  icon: "🏥",
                  title: "Barangay Health Centers (BHC)",
                  desc: "Serving all 64 barangays of General Trias — the frontline of community health in Cavite.",
                  color: "#0E7C3A", bg: "#F0FDF4", border: "#BBF7D0",
                },
                {
                  icon: "🤖",
                  title: "LSTM Machine Learning Model",
                  desc: "Trained on years of CHO morbidity data to forecast disease trends month-by-month for each barangay.",
                  color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE",
                },
              ].map((card, i) => (
                <Box key={i} sx={{
                  p: 2.5, borderRadius: "12px",
                  backgroundColor: card.bg,
                  border: `1px solid ${card.border}`,
                  display: "flex", alignItems: "flex-start", gap: 2,
                }}>
                  <Box sx={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>{card.icon}</Box>
                  <Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: card.color, mb: 0.4 }}>
                      {card.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                      {card.desc}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── Features ── */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Box sx={{ textAlign: "center", mb: 5 }}>
          <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, color: "#111827", mb: 1, letterSpacing: "-0.5px" }}>
            Everything CHO & BHC staff need
          </Typography>
          <Typography sx={{ fontSize: 14, color: "#6B7280" }}>
            Designed specifically for the health forecasting needs of General Trias City.
          </Typography>
        </Box>
        <Grid container spacing={2.5}>
          {features.map((f, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{
                borderRadius: "12px", border: "1px solid #E5E7EB",
                boxShadow: "none", height: "100%",
                "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.08)", transform: "translateY(-2px)" },
                transition: "all 0.2s ease",
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ mb: 1.5 }}>{f.icon}</Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827", mb: 0.75 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>
                    {f.desc}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ── Live Dashboard Preview ── */}
      <Box sx={{ backgroundColor: "#F1F5F9", py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          {/* Section header */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Box sx={{
              display: "inline-flex", alignItems: "center", gap: 0.75,
              px: 1.75, py: 0.6, borderRadius: "20px", mb: 2,
              backgroundColor: "rgba(27,79,138,0.08)",
              border: "1px solid rgba(27,79,138,0.2)",
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: T.blue, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.blue }}>
                Live Public Data
              </Typography>
            </Box>
            <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, color: "#0F172A", mb: 1, letterSpacing: "-0.5px" }}>
              See the actual forecast data
            </Typography>
            <Typography sx={{ fontSize: 14, color: "#6B7280", maxWidth: 480, mx: "auto" }}>
              Real-time CHO General Trias disease forecasts — publicly viewable below.
              Sign in to unlock full barangay-level analysis and export tools.
            </Typography>
          </Box>

          {/* Dashboard preview frame */}
          <Box sx={{ position: "relative", borderRadius: "16px", overflow: "hidden",
            border: "1px solid #E2E8F0", boxShadow: "0 8px 40px rgba(0,0,0,0.10)" }}>

            {/* Browser chrome top bar */}
            <Box sx={{
              backgroundColor: "#1E293B", px: 2, py: 1.25,
              display: "flex", alignItems: "center", gap: 1.5,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <Box sx={{ display: "flex", gap: 0.6 }}>
                {["#FF5F57","#FEBC2E","#28C840"].map((c, i) => (
                  <Box key={i} sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: c }} />
                ))}
              </Box>
              <Box sx={{
                flex: 1, mx: 2, py: 0.4, px: 1.5, borderRadius: "6px",
                backgroundColor: "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 0.75,
              }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4ADE80", flexShrink: 0 }} />
                <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
                  predicthealth.app/browse · CHO General Trias
                </Typography>
              </Box>
              <Button
                onClick={onBrowse}
                size="small"
                startIcon={<OpenInFullIcon sx={{ fontSize: 11 }} />}
                sx={{
                  textTransform: "none", fontSize: 11, fontWeight: 600, borderRadius: "6px",
                  color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)",
                  px: 1.25, py: 0.4, minWidth: "auto",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.08)", color: "#fff" },
                }}>
                Open
              </Button>
            </Box>

            {/* Clipped Dashboard — only top portion visible */}
            <Box sx={{
              height: { xs: 420, md: 540 },
              overflow: "hidden",
              position: "relative",
              backgroundColor: "#F8FAFC",
              // scale down slightly so it fits nicely
              "& > *": {
                transform: "scale(0.92)",
                transformOrigin: "top left",
                width: "109%",         // compensate for scale
                height: "109%",
                pointerEvents: "none", // prevent interaction inside preview
              },
            }}>
              <Dashboard
                onNavigate={() => {}}
                onLogout={() => {}}
                isPublic={true}
                _isEmbedded={true}
              />
            </Box>

            {/* Fade + CTA overlay at bottom */}
            <Box sx={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              pt: 10, pb: 3, px: 3, textAlign: "center",
              background: "linear-gradient(to bottom, transparent 0%, rgba(248,250,252,0.85) 35%, #F8FAFC 70%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}>
              <Box sx={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
                p: "18px 28px", borderRadius: "14px",
                backgroundColor: "rgba(255,255,255,0.92)",
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                backdropFilter: "blur(8px)",
                maxWidth: 420,
              }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LockIcon sx={{ fontSize: 15, color: T.blue }} />
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                    Full access requires sign in
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 12.5, color: "#6B7280", textAlign: "center", lineHeight: 1.6 }}>
                  View per-barangay forecasts, age & sex breakdowns, export reports, and more — available to authorized CHO & BHC staff.
                </Typography>
                <Box sx={{ display: "flex", gap: 1.5, mt: 0.5 }}>
                  <Button onClick={onBrowse} variant="outlined" size="small"
                    sx={{
                      textTransform: "none", fontSize: 12.5, fontWeight: 600, borderRadius: "8px",
                      borderColor: "#CBD5E1", color: "#374151", px: 2,
                      "&:hover": { borderColor: T.blue, color: T.blue },
                    }}>
                    Browse Public Data
                  </Button>
                  <Button onClick={onGoToLogin} variant="contained" size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 13 }} />}
                    sx={{
                      textTransform: "none", fontSize: 12.5, fontWeight: 700, borderRadius: "8px",
                      backgroundColor: T.blue, px: 2,
                      "&:hover": { backgroundColor: T.blueMid },
                    }}>
                    Sign In
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── CTA ── */}
      <Box sx={{ backgroundColor: T.sidebarBg, py: { xs: 7, md: 9 }, textAlign: "center", px: 3 }}>
        <Box sx={{
          display: "inline-flex", alignItems: "center", gap: 0.75,
          px: 1.75, py: 0.6, borderRadius: "20px", mb: 2.5,
          backgroundColor: "rgba(74,144,217,0.12)",
          border: "1px solid rgba(74,144,217,0.25)",
        }}>
          <Typography sx={{ fontSize: 12, color: T.blueLight, fontWeight: 600 }}>
            🏙️ General Trias City, Cavite
          </Typography>
        </Box>
        <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, color: "rgba(255,255,255,0.93)", mb: 1.25, letterSpacing: "-0.5px" }}>
          Ready to explore the health data?
        </Typography>
        <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.38)", mb: 3.5, maxWidth: 460, mx: "auto", lineHeight: 1.7 }}>
          Browse public forecasts from CHO General Trias — or sign in to access the full BHC dashboard and analysis tools.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
          <Button onClick={onBrowse} variant="contained"
            sx={{
              textTransform: "none", fontSize: 13.5, fontWeight: 700, borderRadius: "9px",
              px: 3.5, py: 1.25, backgroundColor: T.blue,
              "&:hover": { backgroundColor: T.blueMid },
            }}>
            Browse CHO Data
          </Button>
          <Button onClick={onGoToLogin} variant="outlined"
            sx={{
              textTransform: "none", fontSize: 13.5, fontWeight: 600, borderRadius: "9px",
              px: 3.5, py: 1.25, borderColor: "rgba(255,255,255,0.28)", color: "rgba(255,255,255,0.78)",
              "&:hover": { borderColor: "#fff", color: "#fff" },
            }}>
            Sign In — BHC Staff
          </Button>
        </Box>
      </Box>

      {/* ── Footer ── */}
      <Box sx={{ backgroundColor: "#0A0F1A", py: 3, textAlign: "center", px: 3 }}>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.18)", mb: 0.5 }}>
          © 2025 PredictHealth · Barangay Health Forecasting System
        </Typography>
        <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.12)" }}>
          Data source: City Health Office (CHO), General Trias City, Cavite · For authorized BHC health personnel only
        </Typography>
      </Box>
    </Box>
  );
};

export default Landing;