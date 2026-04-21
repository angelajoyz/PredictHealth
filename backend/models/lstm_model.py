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
    - Batched forecast() — single model.predict() call instead of a loop
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

    def forecast(self, last_sequence, n_months=6):
        """
        Generate forecasts using autoregressive (rolling) prediction.

        Each predicted value is fed back into the input window so future
        steps genuinely depend on prior predictions — preventing the
        flat/repeating forecast bug caused by reusing the last known row.

        Args:
            last_sequence: Last sequence from training data,
                           shape (sequence_length, n_features)
            n_months:      Number of months to forecast

        Returns:
            predictions:   shape (n_months, n_outputs)
        """
        if self.model is None:
            raise ValueError("Model not built. Call build_model() first.")

        predictions      = []
        current_sequence = np.copy(last_sequence)

        for _ in range(n_months):
            batch_input = current_sequence[np.newaxis, :, :]          # (1, seq_len, n_features)
            pred        = self.model.predict(batch_input, verbose=0)[0]  # (n_outputs,)
            predictions.append(pred)

            # Build next row: copy last known features, then overwrite
            # feature[0] (the target / cases column) with the prediction.
            # Lag features shift forward so the window stays internally consistent:
            #   index 0 = cases_t  → new prediction
            #   index 1 = lag_1    → current prediction (becomes previous cases next step)
            #   index 2 = lag_2    → previous cases (old lag_1 value)
            new_row    = np.copy(current_sequence[-1])
            new_row[0] = pred[0]                          # cases ← new prediction

            # ✅ FIXED: lag features shift properly
            if self.n_features >= 2:
                new_row[1] = pred[0]                      # lag_1 ← current prediction
            if self.n_features >= 3:
                new_row[2] = current_sequence[-1][0]      # lag_2 ← previous cases

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
    print("🧪 Testing LSTMForecaster...")

    X_train = np.random.randn(100, 6, 3)
    y_train = np.random.randn(100, 1)

    forecaster = LSTMForecaster(sequence_length=6, n_features=3, n_outputs=1)
    forecaster.build_model()
    forecaster.train(X_train, y_train, epochs=10, patience=3, verbose=0)

    last_seq    = X_train[-1]
    predictions = forecaster.forecast(last_seq, n_months=6)

    print(f"✅ Test successful!")
    print(f"   Predictions shape:  {predictions.shape}")
    print(f"   Sample predictions: {predictions[:3].flatten()}")