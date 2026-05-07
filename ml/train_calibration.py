"""
Load Cell Calibration — Linear Regression
==========================================
Trains a linear regression model mapping raw ESP32 ADC readings to weight in grams.
Output coefficients are provisioned into the ESP32 NVS via provision.cpp.txt.

Usage:
  1. Collect calibration readings and save to calibration_data.csv:
       adc_raw,weight_grams
       412,0
       891,100
       1374,200
       1853,300
       2340,500
  2. Run: python train_calibration.py
  3. Copy the printed prefs.put* lines into provision.cpp.txt and reflash.

Columns required in calibration_data.csv:
  adc_raw      — integer ADC reading from ESP32 (0–4095)
  weight_grams — actual weight in grams (measured with reference scale)
"""

import sys
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error

CSV_FILE = "calibration_data.csv"

try:
    df = pd.read_csv(CSV_FILE)
except FileNotFoundError:
    print(f"ERROR: {CSV_FILE} not found.")
    print("Create it with columns: adc_raw, weight_grams")
    sys.exit(1)

if df.shape[0] < 2:
    print("ERROR: Need at least 2 data points for calibration.")
    sys.exit(1)

X = df[["adc_raw"]].values
y = df["weight_grams"].values

model = LinearRegression()
model.fit(X, y)

scale_factor = float(model.coef_[0])
intercept    = float(model.intercept_)
tare_offset  = int(round(-intercept / scale_factor))

y_pred = model.predict(X)
r2  = model.score(X, y)
mae = mean_absolute_error(y, y_pred)

print("=" * 50)
print("  Load Cell Calibration Results")
print("=" * 50)
print(f"  scale_factor : {scale_factor:.6f}  (grams per ADC unit)")
print(f"  tare_offset  : {tare_offset}  (ADC units at zero load)")
print(f"  R² score     : {r2:.4f}  (1.0 = perfect fit)")
print(f"  Mean error   : {mae:.2f} g")
print()

if r2 < 0.99:
    print("WARNING: R² < 0.99 — check for outliers or sensor noise.")
    print()

print("Provision into ESP32 NVS (paste into provision.cpp.txt):")
print(f'  prefs.putFloat("scale_factor", {scale_factor:.6f}f);')
print(f'  prefs.putInt  ("tare_offset",  {tare_offset});')
print(f'  prefs.putInt  ("adc_pin",      34);')
