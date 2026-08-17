import os
import sys
import pandas as pd


# Allow importing inference.py from the ai directory
AI_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

sys.path.insert(
    0,
    AI_DIR
)

from inference import UdyamSenseAI


DATA_PATH = os.path.join(
    AI_DIR,
    "data",
    "historical_sensor_data.csv"
)


def main():

    print(
        "=== UdyamSense AI Batch Test ==="
    )

    # Load AI
    ai = UdyamSenseAI()

    # Load dataset
    df = pd.read_csv(
        DATA_PATH
    )

    # Use first 100 real readings
    test_df = df.head(100).copy()

    results = []

    for _, row in test_df.iterrows():

        result = ai.predict(
            vibration=row["vibration"],
            sound=row["sound"],
            temperature=row["temperature"]
        )

        results.append(result)

    results_df = pd.DataFrame(
        results
    )

    print(
        f"\nTested readings: "
        f"{len(results_df)}"
    )

    print(
        "\nAI anomaly distribution:"
    )

    print(
        results_df[
            "ai_anomaly"
        ].value_counts()
    )

    print(
        "\nAI risk distribution:"
    )

    print(
        results_df[
            "ai_risk_level"
        ].value_counts()
    )

    print(
        "\nAI fault distribution:"
    )

    print(
        results_df[
            "ai_probable_fault"
        ].value_counts()
    )

    print(
        "\nHealth score statistics:"
    )

    print(
        results_df[
            "ai_health_score"
        ].describe()
    )

    print(
        "\nAnomaly score statistics:"
    )

    print(
        results_df[
            "ai_anomaly_score"
        ].describe()
    )

    # Check for invalid values
    print(
        "\n=== Validation Checks ==="
    )

    invalid_health = (
        (results_df["ai_health_score"] < 0)
        |
        (results_df["ai_health_score"] > 100)
    ).sum()

    invalid_anomaly = (
        (results_df["ai_anomaly_score"] < 0)
        |
        (results_df["ai_anomaly_score"] > 100)
    ).sum()

    missing_values = (
        results_df.isnull()
        .sum()
        .sum()
    )

    print(
        f"Invalid health scores: "
        f"{invalid_health}"
    )

    print(
        f"Invalid anomaly scores: "
        f"{invalid_anomaly}"
    )

    print(
        f"Missing AI values: "
        f"{missing_values}"
    )

    if (
        invalid_health == 0
        and invalid_anomaly == 0
        and missing_values == 0
    ):
        print(
            "\nBATCH TEST PASSED"
        )
    else:
        print(
            "\nBATCH TEST FAILED"
        )


if __name__ == "__main__":
    main()