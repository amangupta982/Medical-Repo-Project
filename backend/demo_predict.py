"""
Quick demonstration script to run and display multi-horizon demand and stockout predictions.
Run with:
    cd backend
    .\venv\Scripts\python.exe demo_predict.py
"""
import os
import sys
import json

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.db_models import PHC, Medicine

client = TestClient(app)
db = SessionLocal()
phc = db.query(PHC).first()
med = db.query(Medicine).first()
db.close()

phc_code = phc.code if phc else "BEN-PHC01"
med_name = med.name if med else "Paracetamol"

print("=" * 75)
print(f"  DEMAND FORECASTING (MULTI-HORIZON PREDICTIONS)")
print(f"  Facility: {phc_code}  |  Medicine: {med_name}")
print("=" * 75)

for h in [1, 7, 14, 30]:
    resp = client.post("/api/predict/demand", json={
        "phc_id": phc_code,
        "medicine": med_name,
        "horizon_days": h
    })
    if resp.status_code == 200:
        data = resp.json()
        pred = data["final_prediction"]
        model = data["selected_model"]
        reason = data["selection_reason"]
        print(f"\n  Horizon: {h:2d} Days")
        print(f"    - Final Forecast : {pred} units")
        print(f"    - Selected Model : {model}")
        print(f"    - Reason         : {reason}")
        print(f"    - All Candidates :")
        for cand in data["all_model_outputs"]:
            m_pred = f"{cand['prediction']} units" if cand['prediction'] is not None else "N/A (offline sequence benchmark)"
            print(f"        * {cand['model']:18s} -> {m_pred}")
    else:
        print(f"Error for horizon {h}: {resp.text}")

print("\n" + "=" * 75)
print(f"  STOCKOUT RISK & EXPLAINABILITY (7-DAY EARLY WARNING)")
print("=" * 75)

stock_resp = client.post("/api/predict/stockout", json={
    "phc_id": phc_code,
    "medicine": med_name
})

if stock_resp.status_code == 200:
    data = stock_resp.json()
    print(f"  - Stockout Risk Level : {data['risk_level']}")
    print(f"  - Probability         : {data['stockout_probability']*100:.2f}%")
    print(f"  - Selected Champion   : {data['selected_model']}")
    print(f"  - Current Stock       : {data['current_stock']} units")
    print(f"  - Top Risk Drivers (SHAP) :")
    for d in data.get("top_drivers", []):
        print(f"      * {d['factor']:25s} : {d['contribution_pct']:.1f}% ({d['direction']})")
else:
    print(f"Error for stockout: {stock_resp.text}")

print("=" * 75)
