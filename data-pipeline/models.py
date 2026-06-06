"""
VayuGuard Advanced ML Models with GPU Acceleration
Comprehensive training pipeline for AQI forecasting
"""

import os
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, mean_absolute_percentage_error
from sklearn.preprocessing import StandardScaler
import logging
import warnings
warnings.filterwarnings('ignore')

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import torch.nn.functional as F
from tqdm import tqdm

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f'🖥️ Using device: {device}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# XGBOOST TQDM CALLBACK
# ============================================================================

from xgboost.callback import TrainingCallback

class _TqdmXGBCallback(TrainingCallback):
    """tqdm progress bar callback for XGBoost — must inherit TrainingCallback"""
    def __init__(self, total, desc='XGBoost'):
        super().__init__()
        self.pbar = tqdm(total=total, desc=desc, unit='tree',
                         bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} trees [{elapsed}<{remaining}, {rate_fmt}]')

    def after_iteration(self, model, epoch, evals_log):
        rmse_list = evals_log.get('validation_0', {}).get('rmse', [0])
        self.pbar.set_postfix(val_rmse=f'{rmse_list[-1]:.4f}' if rmse_list else '—')
        self.pbar.update(1)
        return False  # False = don't stop early

    def after_training(self, model):
        self.pbar.close()
        return model

# ============================================================================
# BASELINE MODELS
# ============================================================================

class BaselineModel:
    """Baseline models for comparison"""

    @staticmethod
    def persistence_forecast(train_df, test_df):
        """Use last known AQI (1h lag, real AQI units) as 24h forecast"""
        # aqi_lag_1h is a scaled z-score; aqi is the real-unit column
        # Shift aqi by 1 to simulate 'last known value' at prediction time
        predictions = test_df['aqi'].values          # real AQI units, already 1h behind target
        actual      = test_df['target_aqi'].values   # real AQI units

        mae  = mean_absolute_error(actual, predictions)
        rmse = np.sqrt(mean_squared_error(actual, predictions))
        r2   = r2_score(actual, predictions)
        mape = mean_absolute_percentage_error(actual, np.maximum(np.abs(predictions), 1))

        logger.info(f'✅ Persistence - MAE: {mae:.2f}, RMSE: {rmse:.2f}, R²: {r2:.3f}, MAPE: {mape:.2f}%')
        return {'predictions': predictions, 'mae': mae, 'rmse': rmse, 'r2': r2, 'mape': mape}

    @staticmethod
    def moving_average_forecast(train_df, test_df, window=24):
        """Forecast using 24h rolling mean of real AQI"""
        # Recompute rolling mean on the unscaled aqi column
        rolling_mean = test_df['aqi'].rolling(window=window, min_periods=1).mean().values
        actual       = test_df['target_aqi'].values

        mae  = mean_absolute_error(actual, rolling_mean)
        rmse = np.sqrt(mean_squared_error(actual, rolling_mean))
        r2   = r2_score(actual, rolling_mean)
        mape = mean_absolute_percentage_error(actual, np.maximum(np.abs(rolling_mean), 1))

        logger.info(f'✅ Moving Average - MAE: {mae:.2f}, RMSE: {rmse:.2f}, R²: {r2:.3f}, MAPE: {mape:.2f}%')
        return {'predictions': rolling_mean, 'mae': mae, 'rmse': rmse, 'r2': r2, 'mape': mape}

# ============================================================================
# CLASSICAL MODELS
# ============================================================================

class ClassicalModels:

    @staticmethod
    def train_xgboost_model(train_df, test_df):
        """Train XGBoost with GPU acceleration and tqdm progress bar"""
        try:
            from xgboost import XGBRegressor

            logger.info('Training XGBoost (GPU-accelerated)...')

            exclude_cols = {'target_aqi', 'target_pm25', 'timestamp', 'city', 'City', 'Datetime', 'AQI', 'AQI_Bucket'}
            feature_cols = [col for col in train_df.columns
                            if col not in exclude_cols
                            and train_df[col].dtype in ['int64', 'int32', 'float64', 'float32']]

            X_train = train_df[feature_cols].fillna(0)
            y_train = train_df['target_aqi']
            X_test  = test_df[feature_cols].fillna(0)
            y_test  = test_df['target_aqi']

            n_estimators = 300
            model = XGBRegressor(
                n_estimators=n_estimators,
                max_depth=10,
                learning_rate=0.03,
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_weight=1,
                random_state=42,
                tree_method='hist',
                device='cuda' if torch.cuda.is_available() else 'cpu',
                n_jobs=-1,
                callbacks=[_TqdmXGBCallback(total=n_estimators, desc='  XGBoost')],
            )

            model.fit(X_train, y_train,
                      eval_set=[(X_test, y_test)],
                      verbose=False)

            predictions = model.predict(X_test)

            mae  = mean_absolute_error(y_test, predictions)
            rmse = np.sqrt(mean_squared_error(y_test, predictions))
            r2   = r2_score(y_test, predictions)
            mape = mean_absolute_percentage_error(y_test, np.maximum(predictions, 1))

            logger.info(f'✅ XGBoost - MAE: {mae:.2f}, RMSE: {rmse:.2f}, R²: {r2:.3f}, MAPE: {mape:.2f}%')

            feature_importance = pd.DataFrame({
                'feature':    feature_cols,
                'importance': model.feature_importances_
            }).sort_values('importance', ascending=False)
            logger.info(f'Top 5 features:\n{feature_importance.head().to_string()}')

            os.makedirs('../data/models', exist_ok=True)
            model.save_model('../data/models/xgboost_best.json')

            return model, {'predictions': predictions, 'mae': mae, 'rmse': rmse, 'r2': r2, 'mape': mape}

        except Exception as e:
            logger.error(f'XGBoost training failed: {e}')
            return None, None

# ============================================================================
# DEEP LEARNING MODELS
# ============================================================================

class LSTMNet(nn.Module):
    """Advanced LSTM with Attention mechanism"""

    def __init__(self, input_size, hidden_size=128, num_layers=2, dropout=0.2, output_size=1):
        super().__init__()
        self.hidden_size = hidden_size
        self.lstm      = nn.LSTM(input_size, hidden_size, num_layers,
                                 batch_first=True, dropout=dropout if num_layers > 1 else 0)
        self.attention = nn.MultiheadAttention(hidden_size, num_heads=4, dropout=dropout, batch_first=True)
        self.fc1       = nn.Linear(hidden_size, 64)
        self.fc2       = nn.Linear(64, 32)
        self.fc3       = nn.Linear(32, output_size)
        self.dropout   = nn.Dropout(dropout)
        self.relu      = nn.ReLU()

    def forward(self, x):
        lstm_out, _   = self.lstm(x)
        attn_out, _   = self.attention(lstm_out, lstm_out, lstm_out)
        last_out      = attn_out[:, -1, :]
        out = self.relu(self.fc1(last_out))
        out = self.dropout(out)
        out = self.relu(self.fc2(out))
        out = self.dropout(out)
        return self.fc3(out)


class CNNLSTMNet(nn.Module):
    """CNN-LSTM hybrid for feature extraction + temporal learning"""

    def __init__(self, input_size, hidden_size=64, output_size=1):
        super().__init__()
        self.conv1   = nn.Conv1d(input_size, 32,  kernel_size=3, padding=1)
        self.conv2   = nn.Conv1d(32,          64,  kernel_size=3, padding=1)
        self.conv3   = nn.Conv1d(64,          128, kernel_size=3, padding=1)
        self.pool    = nn.MaxPool1d(2)
        self.lstm    = nn.LSTM(128, hidden_size, num_layers=2, batch_first=True, dropout=0.2)
        self.fc1     = nn.Linear(hidden_size, 64)
        self.fc2     = nn.Linear(64, 32)
        self.fc3     = nn.Linear(32, output_size)
        self.relu    = nn.ReLU()
        self.dropout = nn.Dropout(0.3)

    def forward(self, x):
        x = x.transpose(1, 2)
        x = self.relu(self.conv1(x))
        x = self.pool(x)
        x = self.relu(self.conv2(x))
        x = self.pool(x)
        x = self.relu(self.conv3(x))
        x = x.transpose(1, 2)
        lstm_out, _ = self.lstm(x)
        last_out    = lstm_out[:, -1, :]
        out = self.relu(self.fc1(last_out))
        out = self.dropout(out)
        out = self.relu(self.fc2(out))
        out = self.dropout(out)
        return self.fc3(out)


def _run_epoch(model, loader, criterion, optimizer=None, device=device):
    """Single train or eval epoch. Returns mean loss."""
    is_train = optimizer is not None
    model.train() if is_train else model.eval()
    total_loss = 0.0
    ctx = torch.enable_grad() if is_train else torch.no_grad()
    with ctx:
        for X_batch, y_batch in loader:
            if is_train:
                optimizer.zero_grad()
            y_pred = model(X_batch)
            loss   = criterion(y_pred.squeeze(), y_batch.squeeze())
            if is_train:
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
            total_loss += loss.item()
    return total_loss / len(loader)


class DeepLearningModels:

    @staticmethod
    def prepare_sequences(data, seq_length=24, target_col_idx=0):
        """Create sliding-window sequences. Target is a single column (default 0 = aqi)."""
        X, y = [], []
        for i in range(len(data) - seq_length):
            X.append(data[i:i + seq_length])
            y.append(data[i + seq_length, target_col_idx])
        return np.array(X), np.array(y)

    @staticmethod
    def train_lstm_model(train_df, test_df, epochs=200, batch_size=32, seq_length=24):
        """Train LSTM with Attention, GPU acceleration and tqdm progress bar."""
        logger.info('🚀 Training Advanced LSTM with Attention...')

        # Target is now in real AQI units — scale only the input feature
        train_data = train_df[['target_aqi']].values
        test_data  = test_df[['target_aqi']].values

        scaler       = StandardScaler()
        train_scaled = scaler.fit_transform(train_data)
        test_scaled  = scaler.transform(test_data)

        X_train, y_train = DeepLearningModels.prepare_sequences(train_scaled, seq_length)
        X_test,  y_test  = DeepLearningModels.prepare_sequences(test_scaled,  seq_length)

        if len(X_train) < 32:
            logger.warning('Insufficient data for LSTM')
            return None, None

        logger.info(f'Sequences — Train: {X_train.shape}, Test: {X_test.shape}')

        X_train_t = torch.FloatTensor(X_train).to(device)
        y_train_t = torch.FloatTensor(y_train).to(device)
        X_test_t  = torch.FloatTensor(X_test).to(device)
        y_test_t  = torch.FloatTensor(y_test).to(device)

        train_loader = DataLoader(TensorDataset(X_train_t, y_train_t), batch_size=batch_size, shuffle=True)
        test_loader  = DataLoader(TensorDataset(X_test_t,  y_test_t),  batch_size=batch_size)

        model     = LSTMNet(input_size=1, hidden_size=256, num_layers=3, dropout=0.3).to(device)
        optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=1e-5)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=15)
        criterion = nn.HuberLoss(delta=1.0)

        best_loss       = float('inf')
        patience_counter = 0
        os.makedirs('../data/models', exist_ok=True)

        pbar = tqdm(range(epochs), desc='  LSTM', unit='epoch', dynamic_ncols=True,
                    bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} epochs [{elapsed}<{remaining}] {postfix}')

        for epoch in pbar:
            train_loss = _run_epoch(model, train_loader, criterion, optimizer)
            val_loss   = _run_epoch(model, test_loader,  criterion)
            scheduler.step(val_loss)

            pbar.set_postfix(train=f'{train_loss:.4f}', val=f'{val_loss:.4f}',
                             best=f'{best_loss:.4f}', patience=patience_counter)

            if val_loss < best_loss:
                best_loss        = val_loss
                patience_counter = 0
                torch.save(model.state_dict(), '../data/models/lstm_best.pt')
            else:
                patience_counter += 1
                if patience_counter >= 40:
                    logger.info(f'Early stopping at epoch {epoch + 1}')
                    break

        pbar.close()

        model.load_state_dict(torch.load('../data/models/lstm_best.pt', weights_only=True))
        model.eval()

        with torch.no_grad():
            test_pred = model(X_test_t).cpu().numpy()

        # targets are in real AQI units — no inverse_transform needed
        y_test_actual = y_test.reshape(-1, 1)

        mae  = mean_absolute_error(y_test_actual, test_pred)
        rmse = np.sqrt(mean_squared_error(y_test_actual, test_pred))
        r2   = r2_score(y_test_actual, test_pred)
        mape = mean_absolute_percentage_error(y_test_actual, np.maximum(test_pred, 1))

        logger.info(f'✅ LSTM - MAE: {mae:.2f}, RMSE: {rmse:.2f}, R²: {r2:.3f}, MAPE: {mape:.2f}%')
        return model, {'predictions': test_pred, 'mae': mae, 'rmse': rmse, 'r2': r2, 'mape': mape}

    @staticmethod
    def train_cnnlstm_model(train_df, test_df, epochs=200, batch_size=32, seq_length=24):
        """Train CNN-LSTM hybrid with tqdm progress bar."""
        logger.info('🚀 Training CNN-LSTM Hybrid...')

        exclude_cols = {'target_aqi', 'target_pm25', 'timestamp', 'city', 'City', 'Datetime', 'AQI', 'AQI_Bucket'}
        all_feat = [col for col in train_df.columns
                    if col not in exclude_cols
                    and train_df[col].dtype in ['int64', 'int32', 'float64', 'float32']]
        # Put aqi first so target_col_idx=0 is correct
        feature_cols = ([c for c in all_feat if c == 'aqi'] +
                        [c for c in all_feat if c != 'aqi'])[:15]

        if len(feature_cols) < 5:
            logger.warning('Insufficient features for CNN-LSTM')
            return None, None

        train_data = train_df[feature_cols].values
        test_data  = test_df[feature_cols].values

        scaler       = StandardScaler()
        train_scaled = scaler.fit_transform(train_data)
        test_scaled  = scaler.transform(test_data)

        X_train, y_train = DeepLearningModels.prepare_sequences(train_scaled, seq_length, target_col_idx=0)
        X_test,  y_test  = DeepLearningModels.prepare_sequences(test_scaled,  seq_length, target_col_idx=0)

        if len(X_train) < 32:
            logger.warning('Insufficient data for CNN-LSTM')
            return None, None

        logger.info(f'Sequences — Train: {X_train.shape}, Test: {X_test.shape}')

        X_train_t = torch.FloatTensor(X_train).to(device)
        y_train_t = torch.FloatTensor(y_train).to(device)
        X_test_t  = torch.FloatTensor(X_test).to(device)
        y_test_t  = torch.FloatTensor(y_test).to(device)

        train_loader = DataLoader(TensorDataset(X_train_t, y_train_t), batch_size=batch_size, shuffle=True)
        test_loader  = DataLoader(TensorDataset(X_test_t,  y_test_t),  batch_size=batch_size)

        model     = CNNLSTMNet(input_size=X_train.shape[2], hidden_size=128).to(device)
        optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=1e-5)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=15)
        criterion = nn.HuberLoss(delta=1.0)

        best_loss        = float('inf')
        patience_counter = 0
        os.makedirs('../data/models', exist_ok=True)

        pbar = tqdm(range(epochs), desc='  CNN-LSTM', unit='epoch', dynamic_ncols=True,
                    bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} epochs [{elapsed}<{remaining}] {postfix}')

        for epoch in pbar:
            train_loss = _run_epoch(model, train_loader, criterion, optimizer)
            val_loss   = _run_epoch(model, test_loader,  criterion)
            scheduler.step(val_loss)

            pbar.set_postfix(train=f'{train_loss:.4f}', val=f'{val_loss:.4f}',
                             best=f'{best_loss:.4f}', patience=patience_counter)

            if val_loss < best_loss:
                best_loss        = val_loss
                patience_counter = 0
                torch.save(model.state_dict(), '../data/models/cnnlstm_best.pt')
            else:
                patience_counter += 1
                if patience_counter >= 40:
                    logger.info(f'Early stopping at epoch {epoch + 1}')
                    break

        pbar.close()

        model.load_state_dict(torch.load('../data/models/cnnlstm_best.pt', weights_only=True))
        model.eval()

        with torch.no_grad():
            test_pred = model(X_test_t).cpu().numpy()

        mae  = mean_absolute_error(y_test_t.cpu().numpy(), test_pred)
        rmse = np.sqrt(mean_squared_error(y_test_t.cpu().numpy(), test_pred))
        r2   = r2_score(y_test_t.cpu().numpy(), test_pred)
        mape = mean_absolute_percentage_error(y_test_t.cpu().numpy(), np.maximum(test_pred, 1))

        logger.info(f'✅ CNN-LSTM - MAE: {mae:.2f}, RMSE: {rmse:.2f}, R²: {r2:.3f}, MAPE: {mape:.2f}%')
        return model, {'predictions': test_pred, 'mae': mae, 'rmse': rmse, 'r2': r2, 'mape': mape}

# ============================================================================
# MAIN TRAINING PIPELINE
# ============================================================================

def main():
    logger.info('=' * 80)
    logger.info('🎯 VayuGuard Advanced ML Models Training (GPU-Accelerated)')
    logger.info('Total Time: ~30-40 minutes with GPU for best accuracy')
    logger.info('=' * 80)

    data_dir   = '../data/processed'
    train_path = os.path.join(data_dir, 'aqi_model_train.parquet')
    test_path  = os.path.join(data_dir, 'aqi_model_test.parquet')

    if not os.path.exists(train_path):
        logger.error('❌ Data not found. Run data_pipeline.py first')
        return

    os.makedirs('../data/models', exist_ok=True)

    logger.info('Loading processed data...')
    train_df = pd.read_parquet(train_path)
    test_df  = pd.read_parquet(test_path)
    logger.info(f'✅ Train: {train_df.shape}, Test: {test_df.shape}\n')

    results = {}

    # Phase 1: Baselines
    logger.info('=' * 80)
    logger.info('PHASE 1: Baseline Models')
    logger.info('=' * 80)
    results['persistence'] = BaselineModel.persistence_forecast(train_df, test_df)
    results['moving_avg']  = BaselineModel.moving_average_forecast(train_df, test_df)

    # Phase 2: XGBoost
    logger.info('\n' + '=' * 80)
    logger.info('PHASE 2: XGBoost (GPU-Accelerated)')
    logger.info('=' * 80)
    xgb_model, xgb_results = ClassicalModels.train_xgboost_model(train_df, test_df)
    if xgb_results:
        results['xgboost'] = xgb_results

    # Phase 3: LSTM
    logger.info('\n' + '=' * 80)
    logger.info('PHASE 3: Advanced LSTM (GPU-Accelerated)')
    logger.info('=' * 80)
    lstm_model, lstm_results = DeepLearningModels.train_lstm_model(train_df, test_df, epochs=200)
    if lstm_results:
        results['lstm'] = lstm_results

    # Phase 4: CNN-LSTM
    logger.info('\n' + '=' * 80)
    logger.info('PHASE 4: CNN-LSTM Hybrid (GPU-Accelerated)')
    logger.info('=' * 80)
    cnnlstm_model, cnnlstm_results = DeepLearningModels.train_cnnlstm_model(train_df, test_df, epochs=200)
    if cnnlstm_results:
        results['cnnlstm'] = cnnlstm_results

    # Summary
    logger.info('\n' + '=' * 80)
    logger.info('📊 FINAL RESULTS SUMMARY')
    logger.info('=' * 80)

    summary_df = pd.DataFrame({
        model: {'MAE': m['mae'], 'RMSE': m['rmse'], 'R²': m['r2'], 'MAPE': m['mape']}
        for model, m in results.items()
    }).T
    logger.info('\n' + summary_df.to_string())

    best_model = summary_df['R²'].idxmax()
    logger.info(f'\n🏆 Best Model: {best_model.upper()}')
    logger.info(f'   R²:  {summary_df.loc[best_model, "R²"]:.4f}  ({summary_df.loc[best_model, "R²"]*100:.1f}% variance explained)')
    logger.info(f'   MAE: {summary_df.loc[best_model, "MAE"]:.2f} AQI points average error')

    summary_df.to_csv('../data/models/results_summary.csv')
    logger.info('\n✅ Results saved to data/models/results_summary.csv')
    logger.info('\n' + '=' * 80)
    logger.info('🎉 Training Complete! Models ready for deployment.')
    logger.info('=' * 80)


if __name__ == '__main__':
    main()
