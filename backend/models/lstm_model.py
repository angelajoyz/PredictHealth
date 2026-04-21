import numpy as np
import warnings
import os

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore', category=UserWarning)


class LSTMForecaster:
    """
    LSTM Forecaster using Keras Functional API.

    Optimized for small health datasets (24–48 months):
    - Lazy TensorFlow/Keras imports (faster startup)
    - Deeper architecture (64/32/16 LSTM units) for better accuracy
    - forecast() accepts target_indices so it knows which columns to update
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
        Generate forecasts using autoregressive (rolling) prediction.

        Correctly updates only the target + lag + rolling columns each step,
        leaving climate and other exogenous features unchanged.

        Args:
            last_sequence:  shape (sequence_length, n_features)
            n_months:       number of months to forecast
            target_indices: list of int — which feature columns are the targets
                            e.g. [8] if dengue_cases is at index 8
                            Defaults to [0] for backward compatibility
            feature_cols:   list of str — feature column names in order
                            Used to find lag/rolling columns automatically

        Returns:
            predictions:    shape (n_months, n_outputs)
        """
        if self.model is None:
            raise ValueError("Model not built. Call build_model() first.")

        # Default: assume target is index 0 (old behavior)
        if target_indices is None:
            target_indices = list(range(self.n_outputs))

        predictions      = []
        current_sequence = np.copy(last_sequence)

        for _ in range(n_months):
            batch_input = current_sequence[np.newaxis, :, :]
            pred        = self.model.predict(batch_input, verbose=0)[0]  # (n_outputs,)
            predictions.append(pred)

            new_row = np.copy(current_sequence[-1])

            # ── Update each target feature and its associated lag/rolling cols ──
            for out_idx, feat_idx in enumerate(target_indices):
                pred_val = pred[out_idx]

                # 1. Update the target column itself
                new_row[feat_idx] = pred_val

                # 2. Update lag and rolling columns if feature_cols is provided
                if feature_cols is not None:
                    target_col = feature_cols[feat_idx]

                    # Find lag1 col for this target
                    lag1_col = f"{target_col}_lag1"
                    if lag1_col in feature_cols:
                        lag1_idx = feature_cols.index(lag1_col)
                        new_row[lag1_idx] = pred_val  # lag1 ← current prediction

                    # Find lag2 col for this target
                    lag2_col = f"{target_col}_lag2"
                    if lag2_col in feature_cols:
                        lag2_idx = feature_cols.index(lag2_col)
                        # lag2 ← what was lag1 in the previous step
                        if lag1_col in feature_cols:
                            old_lag1_idx = feature_cols.index(lag1_col)
                            new_row[lag2_idx] = current_sequence[-1][old_lag1_idx]
                        else:
                            new_row[lag2_idx] = current_sequence[-1][feat_idx]

                    # Find rolling3 col for this target
                    roll3_col = f"{target_col}_roll3"
                    if roll3_col in feature_cols:
                        roll3_idx = feature_cols.index(roll3_col)
                        # rolling3 ← average of last 2 actuals + current prediction
                        prev_vals = current_sequence[-2:, feat_idx]
                        new_row[roll3_idx] = (prev_vals.sum() + pred_val) / 3.0

                else:
                    # Fallback: old behavior assuming layout [target, lag1, lag2]
                    if self.n_features >= 2:
                        new_row[feat_idx + 1] = pred_val
                    if self.n_features >= 3:
                        new_row[feat_idx + 2] = current_sequence[-1][feat_idx]

            # ── Advance month_sin and month_cos by 1 month ───────────────────
            if feature_cols is not None and 'month_sin' in feature_cols and 'month_cos' in feature_cols:
                sin_idx = feature_cols.index('month_sin')
                cos_idx = feature_cols.index('month_cos')
                current_angle = np.arctan2(current_sequence[-1][sin_idx],
                                           current_sequence[-1][cos_idx])
                next_angle    = current_angle + (2 * np.pi / 12)
                new_row[sin_idx] = np.sin(next_angle)
                new_row[cos_idx] = np.cos(next_angle)

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
# QUICK TEST
# ============================================================================

if __name__ == '__main__':
    print("🧪 Testing LSTMForecaster with realistic feature layout...")

    # Simulate: [temperature, rainfall, humidity, month_sin, month_cos,
    #            cases_lag1, cases_lag2, cases_roll3, cases]
    n_features   = 9
    target_index = 8
    feature_cols = [
        'temperature', 'rainfall', 'humidity',
        'month_sin', 'month_cos',
        'dengue_cases_lag1', 'dengue_cases_lag2', 'dengue_cases_roll3',
        'dengue_cases',
    ]

    X_train = np.random.randn(100, 6, n_features)
    y_train = np.random.randn(100, 1)

    forecaster = LSTMForecaster(sequence_length=6, n_features=n_features, n_outputs=1)
    forecaster.build_model()
    forecaster.train(X_train, y_train, epochs=10, patience=3, verbose=0)

    last_seq    = X_train[-1]
    predictions = forecaster.forecast(
        last_seq,
        n_months=12,
        target_indices=[target_index],
        feature_cols=feature_cols,
    )

    print(f"✅ Test successful!")
    print(f"   Predictions shape:  {predictions.shape}")
    print(f"   Sample predictions: {predictions[:6].flatten().round(4)}")
    print(f"   All same? {np.allclose(predictions[0], predictions[1])} ← should be False")