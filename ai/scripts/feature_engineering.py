import pandas as pd
import numpy as np


DATA_PATH = "data/historical_sensor_data.csv"
OUTPUT_PATH = "data/engineered_sensor_data.csv"


def main():

    print("=== UdyamSense AI Feature Engineering ===")

    df = pd.read_csv(DATA_PATH)

    # Convert timestamp
    df["timestamp"] = pd.to_datetime(
        df["timestamp"]
    )

    # Sort chronologically
    df = df.sort_values(
        ["machine_id", "timestamp"]
    ).reset_index(drop=True)

    # Rolling window
    WINDOW = 10

    # Vibration features
    df["vibration_mean"] = (
        df.groupby("machine_id")["vibration"]
        .transform(
            lambda x: x.rolling(
                WINDOW,
                min_periods=1
            ).mean()
        )
    )

    df["vibration_std"] = (
        df.groupby("machine_id")["vibration"]
        .transform(
            lambda x: x.rolling(
                WINDOW,
                min_periods=1
            ).std()
        )
        .fillna(0)
    )

    # Sound features
    df["sound_mean"] = (
        df.groupby("machine_id")["sound"]
        .transform(
            lambda x: x.rolling(
                WINDOW,
                min_periods=1
            ).mean()
        )
    )

    df["sound_std"] = (
        df.groupby("machine_id")["sound"]
        .transform(
            lambda x: x.rolling(
                WINDOW,
                min_periods=1
            ).std()
        )
        .fillna(0)
    )

    # Temperature moving average
    df["temperature_mean"] = (
        df.groupby("machine_id")["temperature"]
        .transform(
            lambda x: x.rolling(
                WINDOW,
                min_periods=1
            ).mean()
        )
    )

    # Temperature change
    df["temperature_change"] = (
        df.groupby("machine_id")["temperature"]
        .diff()
        .fillna(0)
    )

    # Rate of vibration change
    df["vibration_change"] = (
        df.groupby("machine_id")["vibration"]
        .diff()
        .fillna(0)
    )

    # Rate of sound change
    df["sound_change"] = (
        df.groupby("machine_id")["sound"]
        .diff()
        .fillna(0)
    )

    # Replace infinite values
    df = df.replace(
        [np.inf, -np.inf],
        np.nan
    )

    df = df.fillna(0)

    print(f"Total rows: {len(df)}")

    print("\nEngineered features:")

    engineered_features = [
        "vibration_mean",
        "vibration_std",
        "sound_mean",
        "sound_std",
        "temperature_mean",
        "temperature_change",
        "vibration_change",
        "sound_change"
    ]

    for feature in engineered_features:
        print(f" - {feature}")

    print("\nSample engineered data:")

    print(
        df[
            [
                "timestamp",
                "vibration",
                "vibration_mean",
                "vibration_std",
                "sound",
                "sound_mean",
                "sound_std",
                "temperature",
                "temperature_mean",
                "temperature_change"
            ]
        ]
        .head(10)
        .to_string(index=False)
    )

    df.to_csv(
        OUTPUT_PATH,
        index=False
    )

    print(
        f"\nSaved engineered dataset to: "
        f"{OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
    