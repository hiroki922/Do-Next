from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, lists, stats, tags, todos
from app.db.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Do-Next", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tags.router)
app.include_router(lists.router)
app.include_router(stats.router)
app.include_router(todos.router)


@app.get("/health")
def health():
    return {"status": "ok"}
