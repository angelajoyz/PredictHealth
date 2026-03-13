import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from datetime import datetime
import requests

class DataProcessor:
    def __init__(self, sequence_length=6):
        # ✅ Reduced from 12 to 6 — better for 36-month datasets
        self.sequence_length = sequence_length
        self.scalers = {}

    # ─────────────────────────────────────────────────────────────────────────
    # LOAD FROM FILE (kept for backward compatibility)
    # ─────────────────────────────────────────────────────────────────────────

    def load_and_filter_data(self, file_path, barangay):
        xl     = pd.ExcelFile(file_path)
        sheets = xl.sheet_names

        if 'Unified_Data' in sheets:
            df = pd.read_excel(file_path, sheet_name='Unified_Data')
            if 'Health_Data' in sheets:
                df_health = pd.read_excel(file_path, sheet_name='Health_Data')
                new_cols  = [c for c in df_health.columns
                             if c.endswith('_cases') and c not in df.columns]
                if new_cols:
                    keys = [k for k in ['city','barangay','year','month']
                            if k in df.columns and k in df_health.columns]
                    df = df.merge(df_health[keys + new_cols], on=keys, how='left')
        elif 'Health_Data' in sheets:
            df = pd.read_excel(file_path, sheet_name='Health_Data')
        else:
            df = pd.read_excel(file_path)

        return self.load_and_filter_data_from_df(df, barangay)

    # ─────────────────────────────────────────────────────────────────────────
    # LOAD FROM DATAFRAME (used by /api/forecast with DB data)
    # ─────────────────────────────────────────────────────────────────────────

    def load_and_filter_data_from_df(self, df, barangay, aggregate_all=False):
        """
        Filter DataFrame by barangay and build date column.
        If aggregate_all=True or barangay='__ALL__', aggregate across all barangays.
        """
        if aggregate_all or barangay == '__ALL__' or barangay is None:
            # Sum all disease cases across all barangays per year+month
            disease_cols = [c for c in df.columns
                            if c.endswith('_cases') or c == 'malnutrition_prevalence_pct']
            group_cols   = ['year', 'month']
            agg_dict     = {c: 'sum' for c in disease_cols if c in df.columns}

            # Keep city from first occurrence
            if 'city' in df.columns:
                agg_dict['city'] = 'first'

            df_filtered = df.groupby(group_cols, as_index=False).agg(agg_dict)
            df_filtered['barangay'] = '__ALL__'
            print(f"   📊 Aggregated all barangays — {len(df_filtered)} monthly records")
        else:
            df_filtered = df[df['barangay'] == barangay].copy()
            if df_filtered.empty:
                # Try case-insensitive match
                mask        = df['barangay'].str.upper() == barangay.upper()
                df_filtered = df[mask].copy()

            if df_filtered.empty:
                available = df['barangay'].unique().tolist()[:10]
                raise ValueError(
                    f"No data found for barangay '{barangay}'. "
                    f"Available: {available}"
                )

        df_filtered = df_filtered.sort_values(['year', 'month']).reset_index(drop=True)
        df_filtered['date'] = pd.to_datetime(
            df_filtered['year'].astype(str) + '-' +
            df_filtered['month'].astype(str).str.zfill(2) + '-01'
        )
        return df_filtered

    # ─────────────────────────────────────────────────────────────────────────
    # CLIMATE DATA FETCHER (from Open-Meteo API)
    # ─────────────────────────────────────────────────────────────────────────

    def fetch_climate_data(self, city: str, start_date: str, end_date: str) -> pd.DataFrame:
        """
        Fetch monthly climate data from Open-Meteo API.
        Returns DataFrame with columns: year, month, temperature, rainfall, humidity
        Returns empty DataFrame if fetch fails (graceful fallback).
        """
        print(f"   🌤️  Fetching climate data for '{city}' ({start_date} → {end_date})...")

        try:
            # Geocode city
            geo = requests.get(
                'https://geocoding-api.open-meteo.com/v1/search',
                params={'name': city, 'count': 1, 'country_code': 'PH',
                        'language': 'en', 'format': 'json'},
                timeout=10
            ).json()

            if not geo.get('results'):
                # Retry without country code
                geo = requests.get(
                    'https://geocoding-api.open-meteo.com/v1/search',
                    params={'name': city, 'count': 1, 'language': 'en', 'format': 'json'},
                    timeout=10
                ).json()

            if not geo.get('results'):
                print(f"   ⚠️  Could not geocode '{city}' — skipping climate features")
                return pd.DataFrame()

            lat = geo['results'][0]['latitude']
            lng = geo['results'][0]['longitude']

            # Fetch monthly climate
            climate = requests.get(
                'https://archive-api.open-meteo.com/v1/archive',
                params={
                    'latitude':   lat,
                    'longitude':  lng,
                    'start_date': start_date,
                    'end_date':   end_date,
                    'monthly':    'temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean',
                    'timezone':   'Asia/Manila',
                },
                timeout=30
            ).json()

            if 'monthly' not in climate:
                print(f"   ⚠️  No climate data returned — skipping climate features")
                return pd.DataFrame()

            monthly = climate['monthly']
            records = []
            for i, t in enumerate(monthly.get('time', [])):
                dt = pd.to_datetime(t)
                records.append({
                    'year':        dt.year,
                    'month':       dt.month,
                    'temperature': monthly.get('temperature_2m_mean', [None])[i],
                    'rainfall':    monthly.get('precipitation_sum',   [None])[i],
                    'humidity':    monthly.get('relative_humidity_2m_mean', [None])[i],
                })

            df_climate = pd.DataFrame(records)
            print(f"   ✅ Climate data fetched — {len(df_climate)} months")
            return df_climate

        except Exception as e:
            print(f"   ⚠️  Climate fetch failed: {e} — skipping climate features")
            return pd.DataFrame()

    # ─────────────────────────────────────────────────────────────────────────
    # FEATURE ENGINEERING
    # ─────────────────────────────────────────────────────────────────────────

    def prepare_features(self, df, target_columns, city: str = ''):
        """
        Build feature matrix for LSTM training.

        Features (in priority order):
        1. Climate features (from Open-Meteo API if city provided)
        2. Seasonal features (sin/cos month encoding)
        3. Lag features (1, 2, 3 months back per disease)
        4. Rolling averages (3-month, 6-month per disease)
        5. Disease case counts (targets — always last)

        This significantly improves accuracy for short datasets (2-3 years).
        """
        df = df.copy()
        feature_cols = []

        # ── 1. Climate features ──────────────────────────────────────────────
        if city:
            start_str = df['date'].min().strftime('%Y-%m-%d')
            end_str   = df['date'].max().strftime('%Y-%m-%d')
            df_climate = self.fetch_climate_data(city, start_str, end_str)

            if not df_climate.empty:
                df = df.merge(df_climate, on=['year', 'month'], how='left')
                climate_cols = ['temperature', 'rainfall', 'humidity']
                # Fill missing climate values with column mean
                for col in climate_cols:
                    if col in df.columns:
                        df[col] = df[col].fillna(df[col].mean())
                        feature_cols.append(col)
                print(f"   🌤️  Climate features added: {climate_cols}")

        # Also use any existing climate columns from the dataframe
        existing_climate = [
            'avg_temperature_c', 'total_rainfall_mm', 'avg_humidity_pct',
            'max_temperature_c', 'min_temperature_c', 'wind_speed_mps',
            'flood_incidence', 'air_quality_index',
        ]
        for col in existing_climate:
            if col in df.columns and col not in feature_cols:
                feature_cols.append(col)

        # ── 2. Seasonal features (sin/cos encoding) ──────────────────────────
        # Captures cyclical patterns like dengue season (Jul-Oct)
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
        feature_cols += ['month_sin', 'month_cos']
        print(f"   📅 Seasonal encoding added (month_sin, month_cos)")

        # ── 3. Lag features per disease ──────────────────────────────────────
        # Previous months' cases are strong predictors
        lag_cols = []
        for col in target_columns:
            if col in df.columns:
                for lag in [1, 2, 3]:
                    lag_name = f'{col}_lag{lag}'
                    df[lag_name] = df[col].shift(lag)
                    lag_cols.append(lag_name)
        feature_cols += lag_cols
        if lag_cols:
            print(f"   🔄 Lag features added: {len(lag_cols)} columns (1-3 months)")

        # ── 4. Rolling averages per disease ──────────────────────────────────
        roll_cols = []
        for col in target_columns:
            if col in df.columns:
                for window in [3, 6]:
                    if len(df) >= window:
                        roll_name = f'{col}_roll{window}'
                        df[roll_name] = df[col].rolling(window=window, min_periods=1).mean()
                        roll_cols.append(roll_name)
        feature_cols += roll_cols
        if roll_cols:
            print(f"   📈 Rolling averages added: {len(roll_cols)} columns (3-month, 6-month)")

        # ── 5. Disease targets (always last — required by lstm_model.py) ─────
        feature_cols += [c for c in target_columns if c in df.columns]

        # Remove duplicates while preserving order
        seen = set()
        feature_cols_clean = []
        for c in feature_cols:
            if c not in seen and c in df.columns:
                seen.add(c)
                feature_cols_clean.append(c)
        feature_cols = feature_cols_clean

        df_features = df[feature_cols].copy()

        # Fill NaN values (from lag/rolling at start of series)
        df_features = df_features.fillna(0)

        # Scale each feature independently with MinMaxScaler
        scaled_data = {}
        for col in feature_cols:
            scaler = MinMaxScaler(feature_range=(0, 1))
            scaled_data[col] = scaler.fit_transform(df_features[[col]]).flatten()
            self.scalers[col] = scaler

        scaled_df = pd.DataFrame(scaled_data)
        print(f"   ✅ Total features used ({len(feature_cols)}): {feature_cols}")
        return scaled_df, feature_cols

    # ─────────────────────────────────────────────────────────────────────────
    # SEQUENCE CREATION
    # ─────────────────────────────────────────────────────────────────────────

    def create_sequences(self, data, target_col_indices):
        """Create LSTM input sequences."""
        X, y        = [], []
        data_array  = data.values

        for i in range(len(data_array) - self.sequence_length):
            X.append(data_array[i : i + self.sequence_length])
            y.append(data_array[i + self.sequence_length, target_col_indices])

        return np.array(X), np.array(y)

    # ─────────────────────────────────────────────────────────────────────────
    # INVERSE TRANSFORM
    # ─────────────────────────────────────────────────────────────────────────

    def inverse_transform_predictions(self, predictions, target_columns):
        """Convert scaled predictions back to original scale."""
        result = {}
        for i, col in enumerate(target_columns):
            scaler       = self.scalers[col]
            pred_reshape = predictions[:, i].reshape(-1, 1)
            values       = scaler.inverse_transform(pred_reshape).flatten()
            result[col]  = np.clip(values, 0, None)  # No negative cases
        return result