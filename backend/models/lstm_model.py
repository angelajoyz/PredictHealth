import numpy as np
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
import os

class LSTMForecaster:
    def __init__(self, sequence_length=12, n_features=None, n_outputs=None):
        self.sequence_length = sequence_length
        self.n_features = n_features
        self.n_outputs = n_outputs
        self.model = None
        
    def build_model(self):
        """Build LSTM architecture"""
        model = Sequential([
            LSTM(64, activation='relu', return_sequences=True, 
                 input_shape=(self.sequence_length, self.n_features)),
            Dropout(0.2),
            LSTM(32, activation='relu'),
            Dropout(0.2),
            Dense(25, activation='relu'),
            Dense(self.n_outputs)
        ])
        
        model.compile(optimizer='adam', loss='mse', metrics=['mae'])
        self.model = model
        return model
    
    def train(self, X_train, y_train, epochs=100, batch_size=16):
        """Train the model"""
        early_stop = EarlyStopping(
            monitor='loss', 
            patience=15,
            restore_best_weights=True
        )
        
        history = self.model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=[early_stop],
            verbose=1
        )
        
        return history
    
    def forecast(self, last_sequence, n_months=6):
        """
        Forecast future months
        last_sequence: array of shape (sequence_length, n_features)
        """
        predictions = []
        current_sequence = last_sequence.copy()
        
        for _ in range(n_months):
            current_batch = current_sequence.reshape(1, self.sequence_length, self.n_features)
            next_pred = self.model.predict(current_batch, verbose=0)[0]
            predictions.append(next_pred)

            # ✅ Fixed: target columns are always the LAST n_outputs columns
            next_row = current_sequence[-1].copy()
            next_row[self.n_features - self.n_outputs:] = next_pred
            current_sequence = np.vstack([current_sequence[1:], next_row])
        
        return np.array(predictions)
    
    def save_model(self, filepath):
        """Save trained model"""
        self.model.save(filepath)
    
    def load_model(self, filepath):
        """Load pre-trained model"""
        self.model = load_model(filepath)