from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    balance = Column(Float, default=0.0)

    payouts = relationship("Payout", back_populates="user")

class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float, default=0.0)
    hazard_type = Column(String, index=True)
    reason = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="payouts")


class HazardReport(Base):
    __tablename__ = "hazard_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    image_uri = Column(String)
    yolo_detections = Column(String)
    confidence = Column(Float)
    road_overlap = Column(Float)
    status = Column(String)  # "approved", "rejected", "appealed", "verified"
    rejection_reason = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class HazardAppeal(Base):
    __tablename__ = "hazard_appeals"

    id = Column(Integer, primary_key=True, index=True)
    hazard_report_id = Column(Integer, ForeignKey("hazard_reports.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    appeal_reason = Column(String)
    gemini_analysis = Column(String)
    gemini_confidence = Column(Float)
    appeal_status = Column(String)  # "pending", "approved", "rejected"
    created_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("HazardReport")
    user = relationship("User")
