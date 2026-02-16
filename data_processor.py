import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from datetime import datetime, timedelta

class DataProcessor:
    def __init__(self, sequence_length=12):
        self.sequence_length = sequence_length
        self.scalers = {}
        
    def load_and_filter_data(self, file_path, barangay):
        """
        Load Excel and filter by barangay.
        Supports multi-sheet files (uses Unified_Data or Health_Data + merges climate).
        Falls back to reading the first sheet for single-sheet files.
        """
        xl = pd.ExcelFile(file_path)
        sheets = xl.sheet_names

        if 'Unified_Data' in sheets:
            # ── Multi-sheet: start with Unified_Data ──────────────
            df = pd.read_excel(file_path, sheet_name='Unified_Data')

            # Merge Health_Data to pull extra disease columns not in Unified_Data
            if 'Health_Data' in sheets:
                df_health = pd.read_excel(file_path, sheet_name='Health_Data')
                new_disease_cols = [
                    c for c in df_health.columns
                    if c.endswith('_cases') and c not in df.columns
                ]
                if new_disease_cols:
                    merge_keys = [k for k in ['city', 'barangay', 'year', 'month']
                                  if k in df.columns and k in df_health.columns]
                    df = df.merge(df_health[merge_keys + new_disease_cols],
                                  on=merge_keys, how='left')

        elif 'Health_Data' in sheets:
            # ── Multi-sheet without Unified_Data ──────────────────
            df = pd.read_excel(file_path, sheet_name='Health_Data')
            for sheet in ['Climate_Data', 'Environmental_Data']:
                if sheet in sheets:
                    other = pd.read_excel(file_path, sheet_name=sheet)
                    merge_keys = [k for k in ['city', 'barangay', 'year', 'month']
                                  if k in df.columns and k in other.columns]
                    df = df.merge(other, on=merge_keys, how='left')

        else:
            # ── Single-sheet file (original behaviour) ─────────────
            df = pd.read_excel(file_path)

        return self.load_and_filter_data_from_df(df, barangay)

    def load_and_filter_data_from_df(self, df, barangay):
        """Filter a pre-merged DataFrame by barangay and build the date column."""
        df_filtered = df[df['barangay'] == barangay].copy()

        if df_filtered.empty:
            raise ValueError(f"No data found for barangay: {barangay}")

        df_filtered = df_filtered.sort_values(['year', 'month']).reset_index(drop=True)

        # ✅ Zero-pad month so datetime parsing never fails (e.g. '2021-01-01')
        df_filtered['date'] = pd.to_datetime(
            df_filtered['year'].astype(str) + '-' +
            df_filtered['month'].astype(str).str.zfill(2) + '-01'
        )

        return df_filtered

    def prepare_features(self, df, target_columns):
        """
        Prepare ALL available climate, environmental, and socioeconomic features for LSTM.

        Feature priority list covers every column that may appear across sheet versions.
        Only columns that actually exist in the dataframe are included.
        Target disease columns are always placed LAST — required by lstm_model.py forecast().
        """
        feature_priority = [
            # ── Climate ──────────────────────────────────────────────
            'avg_temperature_c',        # heat → dengue / respiratory
            'max_temperature_c',        # peak heat stress
            'min_temperature_c',        # cold → respiratory infections
            'total_rainfall_mm',        # rain → dengue breeding, diarrhea
            'avg_humidity_pct',         # humidity → mosquito survival
            'wind_speed_mps',           # wind → respiratory spread
            'solar_radiation_wm2',      # solar radiation
            'pressure_hpa',             # atmospheric pressure

            # ── Environmental ─────────────────────────────────────────
            'flood_incidence',          # flooding → diarrhea, dengue
            'air_quality_index',        # air pollution → respiratory
            'pm25_ugm3',                # fine particulates → respiratory
            'pm10_ugm3',                # coarse particulates → respiratory
            'solid_waste_collection_coverage_pct',  # waste → dengue breeding
            'water_quality_index',      # ✅ relevant to diarrhea
            'ndvi',                     # vegetation index
            'distance_to_water_m',      # proximity to water bodies

            # ── Socioeconomic ──────────────────────────────────────────
            'population_density_per_km2',   # crowding → disease spread
            'poverty_incidence_pct',         # poverty → all diseases
            'employment_rate_pct',           # socioeconomic proxy
            'health_facilities_count',       # healthcare access
            'literacy_rate_pct',             # education proxy
        ]

        # Only use columns that exist in df AND are not target disease columns
        feature_cols = [
            c for c in feature_priority
            if c in df.columns and c not in target_columns
        ]

        # ✅ Targets always go LAST (required by lstm_model.py forecast())
        feature_cols = feature_cols + target_columns

        # ✅ Only keep columns that actually exist in the dataframe
        feature_cols = [col for col in feature_cols if col in df.columns]

        df_features = df[feature_cols].copy()

        # ✅ Fill any NaN values just in case
        df_features = df_features.fillna(df_features.mean())

        # Scale each feature independently
        scaled_data = {}
        for col in feature_cols:
            scaler = MinMaxScaler(feature_range=(0, 1))
            scaled_data[col] = scaler.fit_transform(df_features[[col]]).flatten()
            self.scalers[col] = scaler

        scaled_df = pd.DataFrame(scaled_data)
        print(f"✅ Features used ({len(feature_cols)}): {feature_cols}")
        return scaled_df, feature_cols
    
    def create_sequences(self, data, target_col_indices):
        """Create sequences for LSTM training"""
        X, y = [], []
        data_array = data.values
        
        for i in range(len(data_array) - self.sequence_length):
            X.append(data_array[i:i + self.sequence_length])
            y.append(data_array[i + self.sequence_length, target_col_indices])
        
        return np.array(X), np.array(y)
    
    def inverse_transform_predictions(self, predictions, target_columns):
        """Convert scaled predictions back to original scale, clipping negatives"""
        result = {}
        for i, col in enumerate(target_columns):
            scaler = self.scalers[col]
            pred_reshaped = predictions[:, i].reshape(-1, 1)
            values = scaler.inverse_transform(pred_reshaped).flatten()
            # ✅ Disease cases can't be negative
            result[col] = np.clip(values, 0, None)
        return result