import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest


DATA_PATH = "data/historical_sensor_data.csv"
MODEL_PATH = "models/anomaly_model.joblib"
FEATURES = [
    "vibration",
    "sound",
    "temperature"
]


def main():

    print("=== UdyamSense AI Anomaly Detector ===")

    # Load dataset
    df = pd.read_csv(
        DATA_PATH
    )

    print(
        f"Total readings: {len(df)}"
    )

    # Learn only from healthy machine behavior
    normal_data = df[
        df["state"] == "NORMAL"
    ].copy()

    print(
        f"Healthy baseline readings: "
        f"{len(normal_data)}"
    )

    X_normal = normal_data[
        FEATURES
    ]

    # Train Isolation Forest
    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42
    )

    model.fit(
        X_normal
    )

    # Calculate decision scores for
    # the healthy baseline.
    normal_scores = model.decision_function(
        X_normal
    )

    score_min = float(
        normal_scores.min()
    )

    score_max = float(
        normal_scores.max()
    )

    # Score all historical readings
    X_all = df[
        FEATURES
    ]

    predictions = model.predict(
        X_all
    )

    df["ai_anomaly"] = (
        predictions == -1
    ).astype(int)

    # Save calibration together with model
    model_package = {
        "model": model,
        "score_min": score_min,
        "score_max": score_max,
        "features": FEATURES
    }

    joblib.dump(
        model_package,
        MODEL_PATH
    )

    ai_anomalies = int(
        df["ai_anomaly"].sum()
    )

    print(
        f"\nAI detected anomalies: "
        f"{ai_anomalies}"
    )

    print(
        "\nAI anomaly distribution:"
    )

    print(
        df["ai_anomaly"]
        .value_counts()
    )

    print(
        "\nHealthy baseline decision score:"
    )

    print(
        f"Minimum: {score_min:.6f}"
    )

    print(
        f"Maximum: {score_max:.6f}"
    )

    print(
        "\nComparison with existing system:"
    )

    print(
        pd.crosstab(
            df["anomaly"],
            df["ai_anomaly"],
            rownames=[
                "Existing anomaly"
            ],
            colnames=[
                "AI anomaly"
            ]
        )
    )

    print(
        f"\nModel package saved to: "
        f"{MODEL_PATH}"
    )

    print(
        "AI anomaly detector ready."
    )


if __name__ == "__main__":
    main()