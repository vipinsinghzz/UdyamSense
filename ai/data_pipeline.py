import pandas as pd

FILE_PATH = "data/historical_sensor_data.csv"

REQUIRED_COLUMNS = [
    "machine_id",
    "timestamp",
    "vibration",
    "sound",
    "temperature",
]


def main():
    df = pd.read_csv(FILE_PATH)

    print("\n=== UdyamSense AI Dataset ===")
    print(f"Rows: {len(df)}")
    print(f"Columns: {len(df.columns)}")

    print("\nColumns:")
    for column in df.columns:
        print(f" - {column}")

    print("\nFirst 5 records:")
    print(df.head().to_string(index=False))

    print("\nMissing values:")
    print(df[REQUIRED_COLUMNS].isnull().sum())

    print("\nData types:")
    print(df[REQUIRED_COLUMNS].dtypes)

    print("\nMachine IDs:")
    print(df["machine_id"].unique())

    print("\nSensor statistics:")
    print(
        df[
            ["vibration", "sound", "temperature"]
        ].describe()
    )

    print("\n=== Existing System Labels ===")

    print("\nState distribution:")
    print(df["state"].value_counts())

    print("\nRisk distribution:")
    print(df["risk_level"].value_counts())

    print("\nAnomaly distribution:")
    print(df["anomaly"].value_counts())

    print("\nProbable fault distribution:")
    print(df["probable_fault"].value_counts())

    print("\nHealth score distribution:")
    print(df["health_score"].describe())

    print("\nTime range:")
    print("Start:", df["timestamp"].min())
    print("End:", df["timestamp"].max())


if __name__ == "__main__":
    main()