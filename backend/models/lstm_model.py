import numpy as np
import warnings
import os

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore', category=UserWarning)


class LSTMForecaster:
    """
    LSTM Forecaster using Keras Functional API.

    Optimized for small health datasets (24–48 months):
    - Lazy TensorFlow/Keras imports (faster startup)
    - Deeper architecture (64/32/16 LSTM units) for better accuracy
    - Proper autoregressive forecast() that updates lag/rolling features
    - EarlyStopping with min_delta for stable convergence
    """

    def __init__(self, sequence_length=6, n_features=3, n_outputs=1):
        self.sequence_length = sequence_length
        self.n_features      = n_features
        self.n_outputs       = n_outputs
        self.model           = None

    def _get_keras(self):
        import tensorflow as tf
        from tensorflow.keras.models import Model
        from tensorflow.keras.layers import Input, LSTM, Dense, Dropout
        from tensorflow.keras.callbacks import EarlyStopping
        from tensorflow.keras.optimizers import Adam
        return tf, Model, Input, LSTM, Dense, Dropout, EarlyStopping, Adam

    def build_model(self):
        tf, Model, Input, LSTM, Dense, Dropout, _, Adam = self._get_keras()

        inputs = Input(shape=(self.sequence_length, self.n_features))

        x = LSTM(64, activation='tanh', return_sequences=True)(inputs)
        x = Dropout(0.2)(x)

        x = LSTM(32, activation='tanh', return_sequences=True)(x)
        x = Dropout(0.2)(x)

        x = LSTM(16, activation='tanh', return_sequences=False)(x)
        x = Dropout(0.1)(x)

        x = Dense(32, activation='relu')(x)
        x = Dropout(0.1)(x)

        x = Dense(16, activation='relu')(x)

        outputs = Dense(self.n_outputs)(x)

        self.model = Model(inputs=inputs, outputs=outputs)
        self.model.compile(
            optimizer=Adam(learning_rate=0.0005),
            loss='huber',
            metrics=['mae'],
        )

        print(f"✅ LSTM Model built successfully")
        print(f"   Input shape:  ({self.sequence_length}, {self.n_features})")
        print(f"   Output shape: ({self.n_outputs},)")

        return self.model

    def train(self, X, y, epochs=100, batch_size=16,
              validation_split=0.2, patience=15, verbose=0):
        if self.model is None:
            self.build_model()

        _, _, _, _, _, _, EarlyStopping, _ = self._get_keras()

        early_stop = EarlyStopping(
            monitor='val_loss' if validation_split > 0 else 'loss',
            patience=patience,
            restore_best_weights=True,
            min_delta=1e-4,
            verbose=0,
        )

        print(f"🧠 Training LSTM model...")
        print(f"   Epochs: {epochs}  |  Batch size: {batch_size}")
        print(f"   Patience: {patience}  |  Val split: {validation_split}")

        history = self.model.fit(
            X, y,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            callbacks=[early_stop],
            verbose=verbose,
        )

        epochs_trained = len(history.history['loss'])
        print(f"✅ Training complete — {epochs_trained} epochs (early stopped)")

        return history

    def forecast(self, last_sequence, n_months=6, target_indices=None, feature_cols=None):
        """
        Generate forecasts using proper autoregressive (rolling) prediction.

        KEY FIX for flat-line problem:
        After each prediction step, the new row is updated with:
          1. The predicted disease value (target column)
          2. lag-1 ← current prediction
          3. lag-2 ← what was lag-1 in the previous step
          4. roll3 ← mean of last 2 values + current prediction
          5. month_sin/cos ← advanced by 1 month

        This ensures each future step sees DIFFERENT inputs → no flat line.

        Args:
            last_sequence:  shape (sequence_length, n_features)
            n_months:       number of months to forecast
            target_indices: list of int — which columns are disease targets
            feature_cols:   list of str — feature column names in order

        Returns:
            predictions:    shape (n_months, n_outputs)
        """
        if self.model is None:
            raise ValueError("Model not built. Call build_model() first.")

        if target_indices is None:
            target_indices = list(range(self.n_outputs))

        predictions      = []
        current_sequence = np.copy(last_sequence).astype(float)

        for step in range(n_months):
            # ── Predict ───────────────────────────────────────────────────────
            batch_input = current_sequence[np.newaxis, :, :]
            pred        = self.model.predict(batch_input, verbose=0)[0]
            predictions.append(pred.copy())

            # ── Build updated row ─────────────────────────────────────────────
            new_row = np.copy(current_sequence[-1])

            if feature_cols is not None:
                for out_idx, feat_idx in enumerate(target_indices):
                    pred_val   = float(pred[out_idx])
                    target_col = feature_cols[feat_idx]

                    # 1. Update target column with prediction
                    new_row[feat_idx] = pred_val

                    # 2. lag-1 ← current prediction
                    lag1_col = f"{target_col}_lag1"
                    if lag1_col in feature_cols:
                        lag1_idx          = feature_cols.index(lag1_col)
                        new_row[lag1_idx] = pred_val

                    # 3. lag-2 ← what was lag-1 before this step
                    lag2_col = f"{target_col}_lag2"
                    if lag2_col in feature_cols:
                        lag2_idx = feature_cols.index(lag2_col)
                        if lag1_col in feature_cols:
                            old_lag1_idx      = feature_cols.index(lag1_col)
                            new_row[lag2_idx] = float(current_sequence[-1][old_lag1_idx])
                        else:
                            new_row[lag2_idx] = float(current_sequence[-1][feat_idx])

                    # 4. roll3 ← mean of 2 previous values + current prediction
                    roll3_col = f"{target_col}_roll3"
                    if roll3_col in feature_cols:
                        roll3_idx  = feature_cols.index(roll3_col)
                        prev_vals  = [
                            float(current_sequence[-2][feat_idx]) if len(current_sequence) >= 2
                            else float(current_sequence[-1][feat_idx]),
                            float(current_sequence[-1][feat_idx]),
                        ]
                        new_row[roll3_idx] = float(np.mean(prev_vals + [pred_val]))

                # 5. Advance month_sin/cos by 1 month
                if 'month_sin' in feature_cols and 'month_cos' in feature_cols:
                    sin_idx = feature_cols.index('month_sin')
                    cos_idx = feature_cols.index('month_cos')
                    current_angle    = np.arctan2(
                        float(current_sequence[-1][sin_idx]),
                        float(current_sequence[-1][cos_idx])
                    )
                    next_angle       = current_angle + (2 * np.pi / 12)
                    new_row[sin_idx] = float(np.sin(next_angle))
                    new_row[cos_idx] = float(np.cos(next_angle))

            else:
                # Fallback: no feature_cols provided
                for out_idx, feat_idx in enumerate(target_indices):
                    new_row[feat_idx] = float(pred[out_idx])
                    if feat_idx + 1 < self.n_features:
                        new_row[feat_idx + 1] = float(pred[out_idx])
                    if feat_idx + 2 < self.n_features:
                        new_row[feat_idx + 2] = float(current_sequence[-1][feat_idx])

            # ── Slide window ──────────────────────────────────────────────────
            current_sequence = np.vstack([
                current_sequence[1:],
                new_row[np.newaxis, :],
            ])

        return np.array(predictions)   # (n_months, n_outputs)

    def save_model(self, filepath):
        if self.model is None:
            raise ValueError("Model not built. Call build_model() first.")
        self.model.save(filepath, save_format='keras')
        print(f"💾 Model saved to {filepath}")

    def load_model(self, filepath):
        tf, *_ = self._get_keras()
        try:
            self.model = tf.keras.models.load_model(filepath)
            print(f"✅ Model loaded from {filepath}")
        except Exception as e:
            raise ValueError(f"Failed to load model: {e}")

    def summary(self):
        if self.model is None:
            print("❌ Model not built yet. Call build_model() first.")
        else:
            self.model.summary()


# ============================================================================
# LEGACY SUPPORT
# ============================================================================

class SimpleLSTM(LSTMForecaster):
    """Alias for backward compatibility."""
    pass


# ============================================================================
# QUICK TEST — verifies flat-line fix
# ============================================================================

if __name__ == '__main__':
    print("🧪 Testing flat-line fix...")

    feature_cols = [
        'month_sin', 'month_cos',
        'dengue_cases_lag1', 'dengue_cases_lag2', 'dengue_cases_roll3',
        'dengue_cases',
    ]
    n_features   = len(feature_cols)
    target_index = feature_cols.index('dengue_cases')

    X_train = np.random.randn(60, 6, n_features)
    y_train = np.random.randn(60, 1)

    forecaster = LSTMForecaster(sequence_length=6, n_features=n_features, n_outputs=1)
    forecaster.build_model()
    forecaster.train(X_train, y_train, epochs=5, patience=3, verbose=0)

    last_seq    = X_train[-1]
    predictions = forecaster.forecast(
        last_seq,
        n_months=12,
        target_indices=[target_index],
        feature_cols=feature_cols,
    )

    print(f"✅ Done! 12-month forecast: {predictions.flatten().round(4)}")
    print(f"   Flat line? {np.allclose(predictions[0], predictions[5])} ← should be False")