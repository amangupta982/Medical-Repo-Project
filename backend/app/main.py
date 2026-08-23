from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api import network, predict, ai_features

app = FastAPI(
    title="BRICS Federated Health Resource & Supply Chain Resilience Platform",
    description=(
        "AI-powered platform for national-scale PHC network visibility, "
        "stock-out prediction, resource redistribution, and federated learning "
        "across simulated BRICS national clients."
    ),
    version="1.0.0",
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(network.router)
app.include_router(predict.router)
app.include_router(ai_features.router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "BRICS Health Resilience Platform API",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
