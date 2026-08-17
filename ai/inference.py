import os
import joblib
import pandas as pd
import numpy as np


MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "models",
    "anomaly_model.joblib"
)


class UdyamSenseAI:

    def __init__(self):

        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"AI model not found: {MODEL_PATH}"
            )

        package = joblib.load(
            MODEL_PATH
        )

        self.model = package["model"]
        self.score_min = package["score_min"]
        self.score_max = package["score_max"]
        self.features = package["features"]

    def calculate_anomaly_score(
        self,
        vibration,
        sound,
        temperature
    ):

        values = pd.DataFrame(
            [[
                float(vibration),
                float(sound),
                float(temperature)
            ]],
            columns=self.features
        )

        raw_score = float(
            self.model.decision_function(
                values
            )[0]
        )

        prediction = int(
            self.model.predict(
                values
            )[0]
        )

        # Convert the model's decision score
        # into a 0-100 relative anomaly score.
        #
        # Lower decision score = more abnormal.

        anomaly_score = (
            100
            * (
                self.score_max
                - raw_score
            )
            / (
                self.score_max
                - self.score_min
            )
        )

        anomaly_score = np.clip(
            anomaly_score,
            0,
            100
        )

        return (
            round(float(anomaly_score), 2),
            prediction
        )

    def classify_risk(
        self,
        health_score
    ):

        if health_score >= 80:
            return "LOW"

        if health_score >= 60:
            return "MEDIUM"

        if health_score >= 40:
            return "HIGH"

        return "CRITICAL"

    def classify_fault(
        self,
        vibration,
        sound,
        temperature,
        anomaly_score
    ):

        if anomaly_score < 50:
            return "NORMAL"

        high_vibration = (
            vibration >= 3.0
        )

        high_sound = (
            sound >= 500
        )

        high_temperature = (
            temperature >= 32.0
        )

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
        self,
        fault,
        risk,
        anomaly_score
    ):

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
                "Continue close monitoring and inspect "
                "the machine if the anomaly persists."
            )

        if anomaly_score >= 50:
            return (
                "Abnormal operating behavior detected. "
                "Increase monitoring frequency."
            )

        return "Continue normal monitoring."

    def predict(
        self,
        vibration,
        sound,
        temperature
    ):

        vibration = float(vibration)
        sound = float(sound)
        temperature = float(temperature)

        anomaly_score, prediction = (
            self.calculate_anomaly_score(
                vibration,
                sound,
                temperature
            )
        )

        ai_anomaly = (
            prediction == -1
        )

        health_score = round(
            max(
                0,
                min(
                    100,
                    100 - anomaly_score
                )
            ),
            2
        )

        risk = self.classify_risk(
            health_score
        )

        fault = self.classify_fault(
            vibration,
            sound,
            temperature,
            anomaly_score
        )

        recommendation = (
            self.generate_recommendation(
                fault,
                risk,
                anomaly_score
            )
        )

        return {
            "ai_anomaly": ai_anomaly,
            "ai_anomaly_score": anomaly_score,
            "ai_health_score": health_score,
            "ai_risk_level": risk,
            "ai_probable_fault": fault,
            "ai_recommendation": recommendation
        }


def print_prediction(
    title,
    reading,
    result
):

    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)

    print(
        f"Vibration   : {reading['vibration']}"
    )

    print(
        f"Sound       : {reading['sound']}"
    )

    print(
        f"Temperature : {reading['temperature']}"
    )

    print("\nAI Result:")

    for key, value in result.items():
        print(
            f"{key}: {value}"
        )


if __name__ == "__main__":

    print(
        "=== UdyamSense AI Calibrated Test ==="
    )

    ai = UdyamSenseAI()

    df = pd.read_csv(
        os.path.join(
            os.path.dirname(__file__),
            "data",
            "historical_sensor_data.csv"
        )
    )

    # Real normal reading
    normal_row = df[
        df["state"] == "NORMAL"
    ].iloc[0]

    # Real vibration abnormality
    vibration_row = df[
        df["probable_fault"]
        == "EXCESSIVE_VIBRATION"
    ].iloc[0]

    # Real severe abnormality
    critical_row = df[
        df["probable_fault"]
        == "LOOSE_COMPONENT"
    ].iloc[0]

    scenarios = [
        (
            "REAL NORMAL READING",
            normal_row
        ),
        (
            "REAL VIBRATION ABNORMALITY",
            vibration_row
        ),
        (
            "REAL CRITICAL READING",
            critical_row
        )
    ]

    for title, row in scenarios:

        reading = {
            "vibration": row["vibration"],
            "sound": row["sound"],
            "temperature": row["temperature"]
        }

        result = ai.predict(
            vibration=reading["vibration"],
            sound=reading["sound"],
            temperature=reading["temperature"]
        )

        print_prediction(
            title,
            reading,
            result
        )

    print(
        "\n=== Calibrated AI test completed ==="
    )