from fastapi import APIRouter

from app.api.buckets import router as buckets_router
from app.api.connections import router as connections_router
from app.api.files import router as files_router

router = APIRouter(prefix="/api/v1", tags=["api"])

# Mount sub-routers
router.include_router(connections_router)
router.include_router(buckets_router)
router.include_router(files_router)


@router.get("/hello")
async def hello():
    return {"message": "Hello, world!"}
