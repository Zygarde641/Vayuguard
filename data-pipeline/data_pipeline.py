"""
Data Pipeline for VayuGuard - Processes raw data into training datasets for AQI forecasting models
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataPipeline:
    """Main data processing pipeline"""
    
    def __init__(self, data_dir='../data'):
        self.data_dir = data_dir
        self.raw_dir = os.path.join(data_dir, 'raw')
        self.processed_dir = os.path.join(data_dir, 'processed')
        os.makedirs(self.raw_dir, exist_ok=True)
        os.makedirs(self.processed_dir, exist_ok=True)
    
    def load_raw_data(self, filename):
        """Load raw AQI data from CSV"""
        filepath = os.path.join(self.raw_dir, filename)
        df = pd.read_csv(filepath)
        logger.info(f'Loaded {len(df)} records from {filename}')
        return df

    def clean_raw_data(self, df):
        """
        Clean raw data before feature engineering:
        - Parse timestamps
        - Sort by City + time
        - Interpolate short gaps (≤24h) per city instead of bulk dropna
        - Encode City as an integer so models can use it
        - Drop rows where AQI is still missing after interpolation
        - Drop raw duplicate columns that will be renamed
        """
        df = df.copy()

        # --- Parse & sort ---
        df['timestamp'] = pd.to_datetime(df['Datetime'])
        df = df.sort_values(['City', 'timestamp']).reset_index(drop=True)

        # --- Rename raw pollutant/AQI columns to lowercase immediately ---
        rename_map = {
            'AQI':    'aqi',
            'PM2.5':  'pm25',
            'PM10':   'pm10',
            'NO':     'no',
            'NO2':    'no2',
            'NOx':    'nox',
            'NH3':    'nh3',
            'CO':     'co',
            'SO2':    'so2',
            'O3':     'o3',
            'Benzene':  'benzene',
            'Toluene':  'toluene',
            'Xylene':   'xylene',
        }
        df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

        # --- Per-city linear interpolation (max gap = 24 h) ---
        pollutant_cols = ['aqi', 'pm25', 'pm10', 'no', 'no2', 'nox',
                          'nh3', 'co', 'so2', 'o3', 'benzene', 'toluene', 'xylene']
        for col in pollutant_cols:
            if col in df.columns:
                df[col] = (
                    df.groupby('City')[col]
                      .transform(lambda s: s.interpolate(method='linear', limit=24))
                )

        # --- Encode City as integer (so models can use it as a feature) ---
        city_codes = {city: idx for idx, city in enumerate(sorted(df['City'].unique()))}
        df['city_encoded'] = df['City'].map(city_codes)
        logger.info(f'Encoded {len(city_codes)} cities: {city_codes}')

        # --- Drop original string columns that are now redundant ---
        df = df.drop(columns=[c for c in ['Datetime', 'AQI_Bucket'] if c in df.columns])

        # --- Drop rows where AQI is still missing after interpolation ---
        before = len(df)
        df = df.dropna(subset=['aqi'])
        logger.info(f'Dropped {before - len(df)} rows with no AQI even after interpolation')

        logger.info(f'Clean data shape: {df.shape}')
        return df, city_codes

    def create_feature_engineering(self, df):
        """
        Engineer features for ML models.

        FIX — lag/rolling windows are now in HOURS (data is hourly):
            lag_1h   = 1 hour ago    (was wrongly called lag_1d  = shift(1))
            lag_24h  = 24 hours ago  (1 day)
            lag_168h = 168 hours ago (7 days)
            lag_720h = 720 hours ago (30 days)
            rolling_24h_mean/std, rolling_168h_mean

        FIX — all lags computed PER CITY via groupby so values never bleed
              across city boundaries.

        FIX — all raw duplicate columns (Datetime, AQI, PM2.5 …) are already
              cleaned before this step; no duplicate columns created here.
        """
        df = df.copy()

        # Data is already sorted by City + timestamp from clean_raw_data
        # Compute lag / rolling features grouped by city
        lag_hours = [1, 24, 168, 720]   # 1h, 1d, 7d, 30d

        for lag in lag_hours:
            if 'aqi' in df.columns:
                df[f'aqi_lag_{lag}h'] = df.groupby('City')['aqi'].transform(lambda s: s.shift(lag))
            if 'pm25' in df.columns:
                df[f'pm25_lag_{lag}h'] = df.groupby('City')['pm25'].transform(lambda s: s.shift(lag))

        # Rolling statistics (per city)
        if 'aqi' in df.columns:
            df['aqi_rolling_24h_mean']  = df.groupby('City')['aqi'].transform(
                lambda s: s.rolling(window=24,  min_periods=1).mean())
            df['aqi_rolling_24h_std']   = df.groupby('City')['aqi'].transform(
                lambda s: s.rolling(window=24,  min_periods=1).std().fillna(0))
            df['aqi_rolling_168h_mean'] = df.groupby('City')['aqi'].transform(
                lambda s: s.rolling(window=168, min_periods=1).mean())
        if 'pm25' in df.columns:
            df['pm25_rolling_24h_mean'] = df.groupby('City')['pm25'].transform(
                lambda s: s.rolling(window=24,  min_periods=1).mean())

        # Time-based features
        df['hour']        = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['month']       = df['timestamp'].dt.month
        df['quarter']     = df['timestamp'].dt.quarter

        # Cyclical encoding
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['day_sin']  = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_cos']  = np.cos(2 * np.pi * df['day_of_week'] / 7)
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)

        # Drop NaN rows created by the longest lag (720h per city)
        df = df.dropna()

        logger.info(f'Feature engineering completed. Shape: {df.shape}')
        return df
    
    def create_target_variable(self, df, horizon_hours=24):
        """
        Create target variable for forecasting.
        horizon_hours: predict AQI this many hours ahead.
        Shift is done per city so the last horizon_hours rows of each city
        (which have no future label) are cleanly dropped.
        """
        df = df.copy()

        if 'aqi' in df.columns:
            df['target_aqi'] = df.groupby('City')['aqi'].transform(
                lambda s: s.shift(-horizon_hours))
        if 'pm25' in df.columns:
            df['target_pm25'] = df.groupby('City')['pm25'].transform(
                lambda s: s.shift(-horizon_hours))

        target_cols = [c for c in ['target_aqi', 'target_pm25'] if c in df.columns]
        if target_cols:
            df = df.dropna(subset=target_cols)

        logger.info(f'Target variable created for {horizon_hours}h forecast. Shape: {df.shape}')
        return df
    
    def split_train_test(self, df, test_size=0.2):
        """
        Time-series aware train-test split (no shuffle).
        Split is done on the global timeline so no future data leaks into training.
        """
        # Sort by timestamp globally before splitting
        df = df.sort_values('timestamp').reset_index(drop=True)
        split_idx = int(len(df) * (1 - test_size))
        train = df.iloc[:split_idx].copy()
        test  = df.iloc[split_idx:].copy()

        logger.info(f'Train: {len(train)} rows  ({train["timestamp"].min()} → {train["timestamp"].max()})')
        logger.info(f'Test:  {len(test)} rows  ({test["timestamp"].min()} → {test["timestamp"].max()})')
        return train, test
    
    def normalize_data(self, train_df, test_df):
        """
        Normalize numeric FEATURE columns using training-set statistics only.

        FIX — target columns (target_aqi, target_pm25) are intentionally
              excluded from scaling so models.py can evaluate on real AQI
              values without needing a separate inverse_transform step.
              String / timestamp columns are also excluded automatically.
        """
        from sklearn.preprocessing import StandardScaler

        # Columns that must NOT be scaled
        exclude_from_scaling = {
            'target_aqi', 'target_pm25',   # keep targets in original AQI units
            'timestamp', 'City',            # non-numeric / identifier
            'city_encoded',                 # integer category — scaling distorts meaning
            'hour', 'day_of_week', 'month', 'quarter',  # already small integers; cyclical versions are better
        }

        numeric_cols = [
            col for col in train_df.select_dtypes(include=[np.number]).columns
            if col not in exclude_from_scaling
        ]

        scaler = StandardScaler()
        train_df = train_df.copy()
        test_df  = test_df.copy()
        train_df[numeric_cols] = scaler.fit_transform(train_df[numeric_cols])
        test_df[numeric_cols]  = scaler.transform(test_df[numeric_cols])

        logger.info(f'Normalized {len(numeric_cols)} feature columns (targets kept in original AQI units)')
        return train_df, test_df, scaler
    
    def save_processed_data(self, train_df, test_df, prefix='aqi_model'):
        """Save processed datasets"""
        train_path = os.path.join(self.processed_dir, f'{prefix}_train.parquet')
        test_path  = os.path.join(self.processed_dir, f'{prefix}_test.parquet')

        # Drop string columns that cannot be stored cleanly in parquet for model use
        for col in ['City', 'timestamp']:
            train_df = train_df.drop(columns=[col], errors='ignore')
            test_df  = test_df.drop(columns=[col], errors='ignore')

        train_df.to_parquet(train_path, index=False)
        test_df.to_parquet(test_path, index=False)

        logger.info(f'Saved → {train_path}  |  {test_path}')
        logger.info(f'Train columns ({len(train_df.columns)}): {train_df.columns.tolist()}')
        return train_path, test_path


def main():
    """Example usage of the data pipeline"""
    logger.info('Starting data pipeline...')

    pipeline = DataPipeline()

    try:
        raw_data = pipeline.load_raw_data('city_hour.csv')
        logger.info(f'Raw data shape: {raw_data.shape}')

        # Step 1: Clean (interpolate, encode city, rename columns)
        clean_data, city_codes = pipeline.clean_raw_data(raw_data)
        logger.info(f'Clean data shape: {clean_data.shape}')

        # Step 2: Feature engineering (correct hourly lags, per-city groupby)
        features_df = pipeline.create_feature_engineering(clean_data)
        logger.info(f'Features shape: {features_df.shape}')

        # Step 3: Create target variable (per-city shift)
        target_df = pipeline.create_target_variable(features_df, horizon_hours=24)
        logger.info(f'Target shape: {target_df.shape}')

        # Step 4: Temporal train/test split
        train_df, test_df = pipeline.split_train_test(target_df, test_size=0.2)

        # Step 5: Normalize features (targets excluded from scaling)
        train_df, test_df, scaler = pipeline.normalize_data(train_df, test_df)

        # Step 6: Save
        train_path, test_path = pipeline.save_processed_data(train_df, test_df)
        logger.info('✅ Data pipeline completed successfully!')
        logger.info(f'Train: {train_path}')
        logger.info(f'Test:  {test_path}')

    except FileNotFoundError as e:
        logger.error(f'File not found: {e}')
    except Exception as e:
        logger.error(f'Error processing data: {e}')
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
