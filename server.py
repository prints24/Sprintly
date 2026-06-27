# Backend API server for Sprintly Ticketing System
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os

from database import SessionLocal, Ticket, init_db

app = FastAPI(title="Sprintly API")

# Initialize database
init_db()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Schemas
class TicketSchema(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    category: str
    priority: str
    status: str
    assignee: str
    reporter: str
    date_created: Optional[str] = None
    date_updated: Optional[str] = None

    class Config:
        from_attributes = True

# API Endpoints

@app.get("/api/tickets", response_model=List[TicketSchema])
def get_tickets(db = Depends(get_db)):
    return db.query(Ticket).all()

@app.post("/api/tickets", response_model=TicketSchema)
def create_ticket(ticket_data: TicketSchema, db = Depends(get_db)):
    # Generate ID
    last_ticket = db.query(Ticket).all()
    last_num = 0
    for t in last_ticket:
        try:
            num = int(t.id.replace("IT-", ""))
            if num > last_num:
                last_num = num
        except ValueError:
            pass
    
    new_id = f"IT-{str(last_num + 1).padStart(3, '0')}"
    import datetime
    today = datetime.date.today().isoformat()

    db_ticket = Ticket(
        id=new_id,
        title=ticket_data.title,
        description=ticket_data.description,
        category=ticket_data.category,
        priority=ticket_data.priority,
        status=ticket_data.status,
        assignee=ticket_data.assignee,
        reporter=ticket_data.reporter,
        date_created=today,
        date_updated=today
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@app.put("/api/tickets/{ticket_id}", response_model=TicketSchema)
def update_ticket(ticket_id: str, ticket_data: TicketSchema, db = Depends(get_db)):
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    import datetime
    db_ticket.title = ticket_data.title
    db_ticket.description = ticket_data.description
    db_ticket.category = ticket_data.category
    db_ticket.priority = ticket_data.priority
    db_ticket.status = ticket_data.status
    db_ticket.assignee = ticket_data.assignee
    db_ticket.reporter = ticket_data.reporter
    db_ticket.date_updated = datetime.date.today().isoformat()

    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@app.delete("/api/tickets/{ticket_id}")
def delete_ticket(ticket_id: str, db = Depends(get_db)):
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(db_ticket)
    db.commit()
    return {"status": "success", "message": "Ticket deleted"}

# Mount static folder
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
