import pandas as pd
import joblib


DATA_PATH = "data/historical_sensor_data.csv"
MODEL_PATH = "models/anomaly_model.joblib"

FEATURES = [
    "vibration",
    "sound",
    "temperature"
]


def calculate_anomaly_score(model, df):
    """Calculate a 0-100 anomaly score."""

    raw_scores = model.decision_function(
        df[FEATURES]
    )

    min_score = raw_scores.min()
    max_score = raw_scores.max()

    scores = (
        100
        * (max_score - raw_scores)
        / (max_score - min_score)
    )

    return scores.clip(0, 100).round(2)


def classify_risk(health_score):
    """Convert health score into risk level."""

    if health_score >= 80:
        return "LOW"

    if health_score >= 60:
        return "MEDIUM"

    if health_score >= 40:
        return "HIGH"

    return "CRITICAL"


def classify_fault(
    vibration,
    sound,
    temperature,
    anomaly_score
):
    """Identify the dominant abnormal sensor pattern."""

    if anomaly_score < 50:
        return "NORMAL"

    high_vibration = vibration >= 3.0
    high_sound = sound >= 500
    high_temperature = temperature >= 32.0

    if (
        high_vibration
        and high_sound
        and high_temperature
    ):
        return "MULTI_SENSOR_ABNORMALITY"

    if high_vibration:
        return "EXCESSIVE_VIBRATION"

    if high_sound:
        return "ABNORMAL_SOUND"

    if high_temperature:
        return "OVERHEATING"

    return "UNKNOWN_ABNORMALITY"


def generate_recommendation(
    fault,
    risk,
    vibration,
    sound,
    temperature,
    anomaly_score
):
    """Generate a maintenance recommendation."""

    if risk == "LOW":
        return (
            "Machine operating normally. "
            "Continue routine monitoring."
        )

    if fault == "EXCESSIVE_VIBRATION":
        if risk == "CRITICAL":
            return (
                "Critical vibration detected. "
                "Inspect bearings, shaft alignment, "
                "mounting and rotating components immediately."
            )

        return (
            "Elevated vibration detected. "
            "Inspect bearings, mounting and shaft alignment."
        )

    if fault == "ABNORMAL_SOUND":
        if risk == "CRITICAL":
            return (
                "Critical acoustic abnormality detected. "
                "Inspect bearings, moving components and "
                "possible mechanical friction immediately."
            )

        return (
            "Abnormal acoustic activity detected. "
            "Inspect moving components and bearing condition."
        )

    if fault == "OVERHEATING":
        return (
            "Elevated temperature detected. "
            "Check ventilation, cooling, lubrication "
            "and operating load."
        )

    if fault == "MULTI_SENSOR_ABNORMALITY":
        return (
            "Multiple sensor abnormalities detected. "
            "Immediate machine inspection recommended."
        )

    if fault == "UNKNOWN_ABNORMALITY":
        return (
            "Unusual machine behavior detected. "
            "Continue close monitoring and inspect the "
            "machine if the anomaly persists."
        )

    if anomaly_score >= 50:
        return (
            "Abnormal operating behavior detected. "
            "Increase monitoring frequency."
        )

    return (
        "Continue normal monitoring."
    )


def main():

    print("=== UdyamSense AI Recommendation Engine ===")

    # Load data
    df = pd.read_csv(DATA_PATH)

    # Load trained anomaly model
    model = joblib.load(MODEL_PATH)

    # Calculate anomaly score
    df["ai_anomaly_score"] = calculate_anomaly_score(
        model,
        df
    )

    # Calculate AI health
    df["ai_health_score"] = (
        100 - df["ai_anomaly_score"]
    ).clip(0, 100).round(2)

    # Calculate AI risk
    df["ai_risk_level"] = (
        df["ai_health_score"]
        .apply(classify_risk)
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

    # Generate recommendation
    df["ai_recommendation"] = df.apply(
        lambda row: generate_recommendation(
            row["ai_probable_fault"],
            row["ai_risk_level"],
            row["vibration"],
            row["sound"],
            row["temperature"],
            row["ai_anomaly_score"]
        ),
        axis=1
    )

    print("\nRecommendation Distribution:")

    print(
        df["ai_recommendation"]
        .value_counts()
    )

    print("\nHighest-risk AI predictions:")

    print(
        df[
            [
                "timestamp",
                "vibration",
                "sound",
                "temperature",
                "ai_anomaly_score",
                "ai_health_score",
                "ai_risk_level",
                "ai_probable_fault",
                "ai_recommendation"
            ]
        ]
        .sort_values(
            "ai_health_score"
        )
        .head(15)
        .to_string(index=False)
    )

    # Save complete AI output
    output_path = (
        "outputs/ai_predictions.csv"
    )

    df.to_csv(
        output_path,
        index=False
    )

    print(
        f"\nSaved complete AI predictions to: "
        f"{output_path}"
    )


if __name__ == "__main__":
    main()