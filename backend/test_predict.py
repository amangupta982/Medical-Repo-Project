from app.database.session import SessionLocal
from app.services.prediction_service import predict_demand
db = SessionLocal()
print(predict_demand(db, 'BEN-PHC01', 'Paracetamol', 7))
db.close()
