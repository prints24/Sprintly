# Database structure and connection setup
from sqlalchemy import create_engine, Column, String, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./tickets.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    status = Column(String, nullable=False)
    assignee = Column(String, nullable=False)
    reporter = Column(String, nullable=False)
    date_created = Column(String, nullable=False)
    date_updated = Column(String, nullable=False)

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed default tickets if table is empty
        if db.query(Ticket).count() == 0:
            default_tickets = [
                Ticket(
                    id="IT-001",
                    title="Login page throwing 500 Error",
                    description="Users cannot log in via Google Auth. Returns a internal server error payload.",
                    category="Authentication",
                    priority="Critical",
                    status="In Progress",
                    assignee="Alex Chen",
                    reporter="Jane Doe",
                    date_created="2026-06-25",
                    date_updated="2026-06-26"
                ),
                Ticket(
                    id="IT-002",
                    title="VPN connection dropping frequently",
                    description="Remote employees reporting disconnection every 30 minutes on Cisco client.",
                    category="Infrastructure",
                    priority="High",
                    status="Blocked",
                    assignee="Sarah Jenkins",
                    reporter="John Smith",
                    date_created="2026-06-26",
                    date_updated="2026-06-27"
                ),
                Ticket(
                    id="IT-003",
                    title="Laptop provisioning for New Hires",
                    description="Setup MacBooks for July 1 intake (Engineering team).",
                    category="Hardware",
                    priority="Medium",
                    status="Backlog",
                    assignee="Unassigned",
                    reporter="HR Ops",
                    date_created="2026-06-27",
                    date_updated="2026-06-27"
                ),
                Ticket(
                    id="IT-004",
                    title="SSL Certificate renewal for API gateway",
                    description="Staging certificate expires in 5 days. Needs Let's Encrypt script run.",
                    category="Security",
                    priority="High",
                    status="Done",
                    assignee="Alex Chen",
                    reporter="Automated Alert",
                    date_created="2026-06-22",
                    date_updated="2026-06-24"
                )
            ]
            db.add_all(default_tickets)
            db.commit()
    finally:
        db.close()
