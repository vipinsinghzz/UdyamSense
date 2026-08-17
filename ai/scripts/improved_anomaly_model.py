import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.metrics import confusion_matrix, classification_report


DATA_PATH = "data/engineered_sensor_data.csv"
MODEL_PATH = "models/improved_anomaly_model.joblib"

FEATURES = [
    "vibration",
    "vibration_mean",
    "vibration_std",
    "sound",
    "sound_mean",
    "sound_std",
    "temperature",
    "temperature_mean",
    "temperature_change",
    "vibration_change",
    "sound_change"
]


def main():

    print("=== UdyamSense Improved AI Anomaly Model ===")

    df = pd.read_csv(DATA_PATH)

    df["timestamp"] = pd.to_datetime(
        df["timestamp"]
    )

    df = df.sort_values(
        ["machine_id", "timestamp"]
    ).reset_index(drop=True)

    # Chronological 70/30 split
    split_index = int(
        len(df) * 0.70
    )

    train_df = df.iloc[
        :split_index
    ].copy()

    test_df = df.iloc[
        split_index:
    ].copy()

    print(f"Total readings: {len(df)}")
    print(f"Training readings: {len(train_df)}")
    print(f"Testing readings: {len(test_df)}")

    # Learn only from historically normal readings
    normal_train = train_df[
        train_df["state"] == "NORMAL"
    ]

    print(
        f"Normal training readings: "
        f"{len(normal_train)}"
    )

    X_train = normal_train[
        FEATURES
    ]

    X_test = test_df[
        FEATURES
    ]

    # Train improved model
    model = IsolationForest(
        n_estimators=300,
        contamination=0.05,
        random_state=42
    )

    model.fit(X_train)

    # Predict unseen data
    predictions = model.predict(
        X_test
    )

    ai_anomaly = (
        predictions == -1
    ).astype(int)

    test_df["ai_anomaly"] = ai_anomaly

    existing_anomaly = test_df[
        "anomaly"
    ].astype(int)

    print("\n=== AI Results ===")

    print(
        test_df["ai_anomaly"]
        .value_counts()
    )

    print("\n=== Confusion Matrix ===")

    matrix = confusion_matrix(
        existing_anomaly,
        ai_anomaly
    )

    print(matrix)

    print("\n=== Classification Report ===")

    print(
        classification_report(
            existing_anomaly,
            ai_anomaly,
            target_names=[
                "Normal",
                "Anomaly"
            ],
            zero_division=0
        )
    )

    print("\n=== Sensor Statistics ===")

    normal_predictions = test_df[
        test_df["ai_anomaly"] == 0
    ]

    anomaly_predictions = test_df[
        test_df["ai_anomaly"] == 1
    ]

    print("\nAI Normal averages:")

    print(
        normal_predictions[
            [
                "vibration",
                "sound",
                "temperature"
            ]
        ].mean()
    )

    print("\nAI Anomaly averages:")

    print(
        anomaly_predictions[
            [
                "vibration",
                "sound",
                "temperature"
            ]
        ].mean()
    )

    # Save model
    joblib.dump(
        model,
        MODEL_PATH
    )

    print(
        f"\nImproved model saved to: "
        f"{MODEL_PATH}"
    )


if __name__ == "__main__":
    main()