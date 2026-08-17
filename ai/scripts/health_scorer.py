import pandas as pd
import joblib


DATA_PATH = "data/historical_sensor_data.csv"
MODEL_PATH = "models/anomaly_model.joblib"

FEATURES = [
    "vibration",
    "sound",
    "temperature"
]


def classify_risk(score):
    if score >= 80:
        return "LOW"
    elif score >= 60:
        return "MEDIUM"
    elif score >= 40:
        return "HIGH"
    else:
        return "CRITICAL"


def main():

    print("=== UdyamSense AI Health Scoring ===")

    # Load historical sensor data
    df = pd.read_csv(DATA_PATH)

    # Load trained anomaly detection model
    model = joblib.load(MODEL_PATH)

    # Prepare sensor features
    X = df[FEATURES]

    # Calculate Isolation Forest anomaly score
    raw_scores = model.decision_function(X)

    min_score = raw_scores.min()
    max_score = raw_scores.max()

    # Convert model score to 0-100 anomaly score
    anomaly_score = (
        100
        * (max_score - raw_scores)
        / (max_score - min_score)
    )

    anomaly_score = anomaly_score.clip(0, 100)

    df["ai_anomaly_score"] = anomaly_score.round(2)

    # Health score is inverse of anomaly score
    df["ai_health_score"] = (
        100 - df["ai_anomaly_score"]
    ).clip(0, 100)

    df["ai_health_score"] = (
        df["ai_health_score"]
        .round(2)
    )

    # Classify machine risk
    df["ai_risk_level"] = (
        df["ai_health_score"]
        .apply(classify_risk)
    )

    # Display health statistics
    print("\nAI Health Score:")
    print(
        df["ai_health_score"].describe()
    )

    # Display risk distribution
    print("\nAI Risk Distribution:")
    print(
        df["ai_risk_level"].value_counts()
    )

    # Display lowest health readings
    print("\nLowest health readings:")

    print(
        df[
            [
                "timestamp",
                "vibration",
                "sound",
                "temperature",
                "ai_anomaly_score",
                "ai_health_score",
                "ai_risk_level"
            ]
        ]
        .sort_values(
            "ai_health_score"
        )
        .head(10)
        .to_string(index=False)
    )

    # Save results
    output_path = "outputs/ai_health_scores.csv"

    df.to_csv(
        output_path,
        index=False
    )

    print(
        f"\nSaved AI health data to: "
        f"{output_path}"
    )


if __name__ == "__main__":
    main()