from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from inference import UdyamSenseAI


app = FastAPI(
    title="UdyamSense AI API",
    version="1.0.0"
)


# Load the AI model once when the API starts.
try:
    ai = UdyamSenseAI()
except Exception as error:
    ai = None
    startup_error = str(error)
else:
    startup_error = None


class SensorInput(BaseModel):

    vibration: float = Field(
        ...,
        description="Machine vibration value"
    )

    sound: float = Field(
        ...,
        description="Machine sound value"
    )

    temperature: float = Field(
        ...,
        description="Machine temperature value"
    )


@app.get("/")
def root():

    return {
        "service": "UdyamSense AI",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
def health():

    if ai is None:

        return {
            "status": "error",
            "ai_model": "not loaded",
            "error": startup_error
        }

    return {
        "status": "healthy",
        "ai_model": "loaded"
    }


@app.post("/predict")
def predict(sensor: SensorInput):

    if ai is None:

        raise HTTPException(
            status_code=503,
            detail=(
                "AI model is not available: "
                f"{startup_error}"
            )
        )

    try:

        result = ai.predict(
            vibration=sensor.vibration,
            sound=sensor.sound,
            temperature=sensor.temperature
        )

        return {
            "success": True,
            "input": {
                "vibration": sensor.vibration,
                "sound": sensor.sound,
                "temperature": sensor.temperature
            },
            "prediction": result
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )