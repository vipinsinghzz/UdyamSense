import pandas as pd
import joblib


DATA_PATH = "data/historical_sensor_data.csv"
MODEL_PATH = "models/anomaly_model.joblib"

FEATURES = [
    "vibration",
    "sound",
    "temperature"
]


def classify_fault(
    vibration,
    sound,
    temperature,
    anomaly_score
):
    """
    Interpret abnormal sensor patterns.

    This is an AI-assisted interpretation layer.
    It does not claim to be a supervised failure classifier
    because the current dataset does not contain validated
    real-world failure labels.
    """

    # Clearly normal behavior
    if anomaly_score < 50:
        return "NORMAL"

    high_vibration = vibration >= 3.0
    high_sound = sound >= 500
    high_temperature = temperature >= 32.0

    # Multiple sensors showing abnormal behavior
    if (
        high_vibration
        and high_sound
        and high_temperature
    ):
        return "MULTI_SENSOR_ABNORMALITY"

    # Strong vibration pattern
    if high_vibration:
        return "EXCESSIVE_VIBRATION"

    # Strong acoustic pattern
    if high_sound:
        return "ABNORMAL_SOUND"

    # Temperature abnormality
    if high_temperature:
        return "OVERHEATING"

    # Anomalous but no dominant sensor
    return "UNKNOWN_ABNORMALITY"


def main():

    print("=== UdyamSense AI Fault Detection ===")

    # Load sensor data
    df = pd.read_csv(DATA_PATH)

    # Load trained anomaly model
    model = joblib.load(MODEL_PATH)

    X = df[FEATURES]

    # Calculate anomaly score
    raw_scores = model.decision_function(X)

    min_score = raw_scores.min()
    max_score = raw_scores.max()

    anomaly_score = (
        100
        * (max_score - raw_scores)
        / (max_score - min_score)
    )

    df["ai_anomaly_score"] = (
        anomaly_score
        .clip(0, 100)
        .round(2)
    )

    # Detect probable fault
    df["ai_probable_fault"] = df.apply(
        lambda row: classify_fault(
            row["vibration"],
            row["sound"],
            row["temperature"],
            row["ai_anomaly_score"]
        ),
        axis=1
    )

    print("\nAI Fault Distribution:")

    print(
        df["ai_probable_fault"]
        .value_counts()
    )

    print("\nSample AI fault detections:")

    print(
        df[
            [
                "timestamp",
                "vibration",
                "sound",
                "temperature",
                "ai_anomaly_score",
                "ai_probable_fault"
            ]
        ]
        .sort_values(
            "ai_anomaly_score",
            ascending=False
        )
        .head(15)
        .to_string(index=False)
    )

    # Save results
    output_path = "outputs/ai_fault_predictions.csv"

    df.to_csv(
        output_path,
        index=False
    )

    print(
        f"\nSaved AI fault predictions to: "
        f"{output_path}"
    )


if __name__ == "__main__":
    main()
    