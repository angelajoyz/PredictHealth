// src/services/api.js
const API_BASE_URL = "http://localhost:5000/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not logged in. Please log in first.");
  return { Authorization: `Bearer ${token}` };
};

export const getCurrentUser = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error("Failed to get user info");
    }

    return await response.json();
  } catch (error) {
    console.error("Get current user failed:", error);
    throw error;
  }
};

export const getBarangays = async (file, { replace = false } = {}) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (replace) formData.append("replace", "true");

    const response = await fetch(`${API_BASE_URL}/barangays`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error(error.error || "Failed to get barangays");
    }

    return await response.json();
  } catch (error) {
    console.error("Get barangays failed:", error);
    throw error;
  }
};

export const getForecast = async (
  file,
  barangay,
  diseases,
  forecastMonths = 6,
  city = "",
) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("barangay", barangay);
    formData.append("forecast_months", forecastMonths);
    if (city) formData.append("city", city);
    diseases.forEach((disease) => {
      formData.append("diseases", disease);
    });

    const response = await fetch(`${API_BASE_URL}/forecast`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error(error.error || "Forecast failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Forecast failed:", error);
    throw error;
  }
};

export const forecastFromDb = async (
  barangay,
  diseases,
  forecastMonths = 6,
  city = "",
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/forecast-from-db`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        barangay,
        diseases,
        forecast_months: forecastMonths,
        city,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error(error.error || "Forecast failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Forecast from DB failed:", error);
    throw error;
  }
};

/**
 * Generate forecast for ALL barangays at once and save to DB.
 * This is a long-running operation (may take several minutes).
 */
export const forecastAll = async (diseases, forecastMonths = 6, city = "") => {
  try {
    const response = await fetch(`${API_BASE_URL}/forecast-all`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ diseases, forecast_months: forecastMonths, city }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error(error.error || "Forecast all failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Forecast all failed:", error);
    throw error;
  }
};

/**
 * Fetch a saved forecast for a barangay from DB — no training, instant result.
 * Returns null if no saved forecast exists.
 */
export const getSavedForecast = async (barangay, city = "") => {
  try {
    const params = new URLSearchParams({ barangay });
    if (city) params.append("city", city);

    const response = await fetch(`${API_BASE_URL}/forecast-saved?${params}`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 404) {
      return null; // No saved forecast — caller should prompt user to Generate All
    }

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      const err = await response.json();
      throw new Error(err.error || "Failed to fetch saved forecast");
    }

    return await response.json();
  } catch (error) {
    console.error("Get saved forecast failed:", error);
    throw error;
  }
};

export const getSavedForecasts = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/forecasts`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error("Failed to fetch forecasts");
    }

    return await response.json();
  } catch (error) {
    console.error("Get forecasts failed:", error);
    throw error;
  }
};

export const DISEASE_MAPPING = {
  dengue_cases: "Dengue",
  diarrhea_cases: "Diarrhea",
  respiratory_cases: "Respiratory",
  malnutrition_prevalence_pct: "Malnutrition",
  tuberculosis_cases: "Tuberculosis",
  hypertension_cases: "Hypertension",
  diabetes_cases: "Diabetes",
  pneumonia_cases: "Pneumonia",
  influenza_cases: "Influenza",
  typhoid_cases: "Typhoid",
  leptospirosis_cases: "Leptospirosis",
  cholera_cases: "Cholera",
  hepatitis_cases: "Hepatitis",
  measles_cases: "Measles",
  covid_cases: "COVID-19",
};

export const getDiseaseName = (columnName) => {
  return (
    DISEASE_MAPPING[columnName] ||
    columnName
      .replace(/_cases$/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
  );
};

export const getDiseaseBreakdown = async (
  category,
  barangay = "__ALL__",
  city = "",
  topN = 5,
) => {
  try {
    const params = new URLSearchParams({ category, barangay, top_n: topN });
    if (city) params.append("city", city);

    const response = await fetch(
      `${API_BASE_URL}/disease-breakdown?${params}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      const err = await response.json();
      throw new Error(err.error || "Failed to fetch disease breakdown");
    }

    return await response.json();
  } catch (error) {
    console.error("Disease breakdown failed:", error);
    throw error;
  }
};

export const getAgeSexBreakdown = async (
  category,
  barangay = "__ALL__",
  city = "",
) => {
  try {
    const params = new URLSearchParams({ category, barangay });
    if (city) params.append("city", city);
    const response = await fetch(
      `${API_BASE_URL}/age-sex-breakdown?${params}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to fetch age/sex breakdown");
    }
    return await response.json();
  } catch (error) {
    console.error("Age/sex breakdown failed:", error);
    throw error;
  }
};

export const checkFilename = async (filename) => {
  try {
    const params = new URLSearchParams({ filename });
    const response = await fetch(`${API_BASE_URL}/check-filename?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error("Failed to check filename");
    }
    return await response.json();
  } catch (error) {
    console.error("Check filename failed:", error);
    throw error;
  }
};

export const scanFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/scan-file`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error(error.error || "Failed to scan file");
    }
    return await response.json();
  } catch (error) {
    console.error("Scan file failed:", error);
    throw error;
  }
};