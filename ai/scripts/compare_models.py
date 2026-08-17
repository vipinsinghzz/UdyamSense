import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    confusion_matrix,
    precision_score,
    recall_score,
    f1_score,
    accuracy_score
)


DATA_PATH = "data/historical_sensor_data.csv"


def evaluate_model(
    name,
    train_features,
    test_features,
    y_test,
    contamination=0.05
):
    model = IsolationForest(
        n_estimators=300,
        contamination=contamination,
        random_state=42
    )

    model.fit(train_features)

    predictions = model.predict(
        test_features
    )

    ai_anomaly = (
        predictions == -1
    ).astype(int)

    accuracy = accuracy_score(
        y_test,
        ai_anomaly
    )

    precision = precision_score(
        y_test,
        ai_anomaly,
        zero_division=0
    )

    recall = recall_score(
        y_test,
        ai_anomaly,
        zero_division=0
    )

    f1 = f1_score(
        y_test,
        ai_anomaly,
        zero_division=0
    )

    matrix = confusion_matrix(
        y_test,
        ai_anomaly
    )

    print(f"\n=== {name} ===")

    print(f"Accuracy : {accuracy:.3f}")
    print(f"Precision: {precision:.3f}")
    print(f"Recall   : {recall:.3f}")
    print(f"F1 Score : {f1:.3f}")

    print("\nConfusion Matrix:")
    print(matrix)

    return {
        "name": name,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1
    }


def main():

    print("=== UdyamSense AI Model Comparison ===")

    df = pd.read_csv(DATA_PATH)

    df["timestamp"] = pd.to_datetime(
        df["timestamp"]
    )

    df = df.sort_values(
        ["machine_id", "timestamp"]
    ).reset_index(drop=True)

    split_index = int(
        len(df) * 0.70
    )

    train_df = df.iloc[
        :split_index
    ].copy()

    test_df = df.iloc[
        split_index:
    ].copy()

    normal_train = train_df[
        train_df["state"] == "NORMAL"
    ]

    y_test = test_df[
        "anomaly"
    ].astype(int)

    # --------------------------------------------------
    # MODEL 1: Original raw sensor model
    # --------------------------------------------------

    raw_features = [
        "vibration",
        "sound",
        "temperature"
    ]

    raw_train = normal_train[
        raw_features
    ]

    raw_test = test_df[
        raw_features
    ]

    result_original = evaluate_model(
        "Original Raw Sensor Model",
        raw_train,
        raw_test,
        y_test
    )

    # --------------------------------------------------
    # MODEL 2: Selected temporal features
    # --------------------------------------------------

    temporal_features = [
        "vibration",
        "sound",
        "temperature",
    ]

    # We deliberately start with the raw features.
    # Additional temporal features will be tested
    # separately instead of blindly combining everything.

    temporal_train = normal_train[
        temporal_features
    ]

    temporal_test = test_df[
        temporal_features
    ]

    result_temporal = evaluate_model(
        "Selected Sensor Model",
        temporal_train,
        temporal_test,
        y_test
    )

    # --------------------------------------------------
    # Comparison
    # --------------------------------------------------

    results = pd.DataFrame(
        [
            result_original,
            result_temporal
        ]
    )

    print("\n=== FINAL COMPARISON ===")

    print(
        results.to_string(
            index=False
        )
    )

    best_model = results.loc[
        results["f1"].idxmax()
    ]

    print(
        f"\nBest model by anomaly F1: "
        f"{best_model['name']}"
    )


if __name__ == "__main__":
    main()