// src/services/api.js
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Get JWT token from localStorage
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Not logged in. Please log in first.');
  return { 'Authorization': `Bearer ${token}` };
};

/**
 * Health check endpoint (no auth needed)
 */
export const healthCheck = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

/**
 * Get list of barangays from uploaded file
 * @param {File} file - Excel (.xlsx/.xls) or CSV file
 * @returns {Promise<{barangays: string[], disease_columns: string[], city: string}>}
 */
export const getBarangays = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/barangays`, {
      method: 'POST',
      headers: getAuthHeaders(),   // ← JWT token
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      // If token expired, clear it so user gets redirected to login
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired. Please log in again.');
      }
      throw new Error(error.error || 'Failed to get barangays');
    }

    return await response.json();
  } catch (error) {
    console.error('Get barangays failed:', error);
    throw error;
  }
};

/**
 * Generate forecast using LSTM model
 * @param {File} file - Excel/CSV file with health data
 * @param {string} barangay - Selected barangay name
 * @param {string[]} diseases - Array of disease columns to forecast
 * @param {number} forecastMonths - Number of months to forecast (default: 6)
 * @param {string} city - City name (optional)
 * @returns {Promise<ForecastData>}
 */
export const getForecast = async (file, barangay, diseases, forecastMonths = 6, city = '') => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('barangay', barangay);
    formData.append('forecast_months', forecastMonths);
    if (city) formData.append('city', city);

    diseases.forEach(disease => {
      formData.append('diseases', disease);
    });

    const response = await fetch(`${API_BASE_URL}/forecast`, {
      method: 'POST',
      headers: getAuthHeaders(),   // ← JWT token
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired. Please log in again.');
      }
      throw new Error(error.error || 'Forecast failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Forecast failed:', error);
    throw error;
  }
};

/**
 * Generate forecast using data already in the database (no file needed)
 * @param {string} barangay - Selected barangay or '__ALL__'
 * @param {string[]} diseases - Array of disease columns
 * @param {number} forecastMonths - Number of months to forecast
 * @param {string} city - City name (optional)
 */
export const forecastFromDb = async (barangay, diseases, forecastMonths = 6, city = '') => {
  try {
    const response = await fetch(`${API_BASE_URL}/forecast-from-db`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ barangay, diseases, forecast_months: forecastMonths, city }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired. Please log in again.');
      }
      throw new Error(error.error || 'Forecast failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Forecast from DB failed:', error);
    throw error;
  }
};


export const getSavedForecasts = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/forecasts`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired. Please log in again.');
      }
      throw new Error('Failed to fetch forecasts');
    }

    return await response.json();
  } catch (error) {
    console.error('Get forecasts failed:', error);
    throw error;
  }
};

/**
 * Disease name mapping (column names → display names)
 */
export const DISEASE_MAPPING = {
  'dengue_cases':                 'Dengue',
  'diarrhea_cases':               'Diarrhea',
  'respiratory_cases':            'Respiratory',
  'malnutrition_prevalence_pct':  'Malnutrition',
  'tuberculosis_cases':           'Tuberculosis',
  'hypertension_cases':           'Hypertension',
  'diabetes_cases':               'Diabetes',
  'pneumonia_cases':              'Pneumonia',
  'influenza_cases':              'Influenza',
  'typhoid_cases':                'Typhoid',
  'leptospirosis_cases':          'Leptospirosis',
  'cholera_cases':                'Cholera',
  'hepatitis_cases':              'Hepatitis',
  'measles_cases':                'Measles',
  'covid_cases':                  'COVID-19',
};

/**
 * Get disease display name
 */
export const getDiseaseName = (columnName) => {
  return DISEASE_MAPPING[columnName] ||
    columnName
      .replace(/_cases$/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Get top specific diseases under a category for a given barangay
 * @param {string} category - e.g. 'respiratory'
 * @param {string} barangay - barangay name or '__ALL__'
 * @param {string} city     - optional city filter
 * @param {number} topN     - how many top diseases to return (default 5)
 */
export const getDiseaseBreakdown = async (category, barangay = '__ALL__', city = '', topN = 5) => {
  try {
    const params = new URLSearchParams({ category, barangay, top_n: topN });
    if (city) params.append('city', city);

    const response = await fetch(`${API_BASE_URL}/disease-breakdown?${params}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired. Please log in again.');
      }
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch disease breakdown');
    }

    return await response.json();
  } catch (error) {
    console.error('Disease breakdown failed:', error);
    throw error;
  }
};