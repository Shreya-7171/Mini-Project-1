from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
import hashlib
import os
import sqlite3
import uuid

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from PIL import Image
from ultralytics import YOLO

import bcrypt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from jose import JWTError, jwt


# --------------------------------------------------
# PATHS & CONFIG
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR)))
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(BASE_DIR / "models" / "best.pt")))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(DATA_DIR / "uploads")))
DB_PATH = Path(os.getenv("DB_PATH", str(DATA_DIR / "civicvision.db")))

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------
# AUTH CONFIG
# --------------------------------------------------

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("APP_ENV") == "production":
        raise RuntimeError("SECRET_KEY must be configured in production.")
    SECRET_KEY = "civicvision-dev-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Keep new hashes on PBKDF2 because Passlib's bcrypt handler is incompatible
# with Python 3.14.
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)

security = HTTPBearer()


# --------------------------------------------------
# APP
# --------------------------------------------------

app = FastAPI(
    title="CivicVision AI API",
    description="AI-powered civic issue reporting and prioritization backend.",
    version="1.0.0",
)

cors_origins = os.getenv("CORS_ORIGINS")
allowed_origins = (
    [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
    if cors_origins
    else [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost",
        "capacitor://localhost",
    ]
)

# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    # Permit a phone on the same private Wi-Fi to reach the dev server.
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|"
        r"192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):\d+"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# STATIC UPLOADS
# --------------------------------------------------

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)


# --------------------------------------------------
# MODEL
# --------------------------------------------------

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"YOLO model not found: {MODEL_PATH}"
    )

model = YOLO(str(MODEL_PATH))


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

DEPARTMENTS = {
    "pothole": "Roads & Public Works",
    "garbage": "Sanitation / Solid Waste",
}

ALLOWED_STATUSES = {
    "Draft",
    "Submitted",
    "Under Review",
    "Assigned",
    "In Progress",
    "Resolved",
    "Closed",
}


# --------------------------------------------------
# DATABASE
# --------------------------------------------------

def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'citizen',
            created_at TEXT NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id TEXT UNIQUE NOT NULL,
            image_id TEXT NOT NULL,
            image_path TEXT NOT NULL,
            issue TEXT NOT NULL,
            confidence REAL NOT NULL,
            severity TEXT NOT NULL,
            priority TEXT NOT NULL,
            department TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'Draft',
            created_at TEXT NOT NULL,
            user_id TEXT
        )
        """
    )

    # Add user_id column to old databases if it doesn't exist
    try:
        cursor.execute(
            "ALTER TABLE reports ADD COLUMN user_id TEXT"
        )
    except Exception:
        pass

    # Existing databases are upgraded in place. Older reports keep a NULL hash.
    try:
        cursor.execute("ALTER TABLE reports ADD COLUMN image_hash TEXT")
    except sqlite3.OperationalError:
        pass

    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_reports_duplicate_lookup "
        "ON reports(user_id, image_hash, created_at)"
    )

    connection.commit()
    connection.close()


init_db()


# --------------------------------------------------
# AUTH MODELS
# --------------------------------------------------

class UserRegister(BaseModel):
    name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class User(BaseModel):
    user_id: str
    name: str
    email: str
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User


# --------------------------------------------------
# AUTH HELPERS
# --------------------------------------------------

def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:

    if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8"),
            )
        except ValueError:
            return False

    try:
        return pwd_context.verify(plain_password, hashed_password)
    except UnknownHashError:
        return False


def get_password_hash(password: str) -> str:

    return pwd_context.hash(password)


def create_user_id() -> str:

    return f"USR-{uuid.uuid4().hex[:8].upper()}"


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
):

    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)

    to_encode.update({
        "exp": expire
    })

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


def get_user_by_email(email: str):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT * FROM users WHERE email = ?",
        (email.lower().strip(),)
    )

    user = cursor.fetchone()

    connection.close()

    return user


def get_user_by_id(user_id: str):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT * FROM users WHERE user_id = ?",
        (user_id,)
    )

    user = cursor.fetchone()

    connection.close()

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    try:

        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id: str = payload.get("sub")

        if user_id is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = get_user_by_id(user_id)

    if user is None:
        raise credentials_exception

    return user


async def get_current_citizen(
    current_user: sqlite3.Row = Depends(get_current_user)
):

    if current_user["role"] != "citizen":

        raise HTTPException(
            status_code=403,
            detail="Not authorized as citizen"
        )

    return current_user


async def get_current_officer(
    current_user: sqlite3.Row = Depends(get_current_user)
):

    if current_user["role"] != "municipal_officer":

        raise HTTPException(
            status_code=403,
            detail="Not authorized as municipal officer"
        )

    return current_user


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class ComplaintSubmission(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    user_id: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def create_report_id() -> str:

    return f"CV-{uuid.uuid4().hex[:6].upper()}"


def create_image_id() -> str:

    return f"IMG-{uuid.uuid4().hex[:8].upper()}"


def severity_from_detection(
    area_ratio: float,
    confidence: float
) -> str:

    if area_ratio >= 0.25 and confidence >= 0.80:
        return "critical"

    if area_ratio >= 0.12 and confidence >= 0.70:
        return "high"

    if area_ratio >= 0.04 or confidence >= 0.60:
        return "medium"

    return "low"


def row_to_dict(row: sqlite3.Row) -> dict:

    if row is None:
        return {}

    return {
        "id": row["id"],
        "report_id": row["report_id"],
        "image_id": row["image_id"],
        "image_path": row["image_path"],
        "issue": row["issue"],
        "confidence": row["confidence"],
        "severity": row["severity"],
        "priority": row["priority"],
        "department": row["department"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "description": row["description"],
        "status": row["status"],
        "created_at": row["created_at"],
        "user_id": (
            row["user_id"]
            if "user_id" in row.keys()
            else None
        ),
    }


DUPLICATE_WINDOW = timedelta(hours=24)


def duplicate_cutoff() -> str:
    return (datetime.now() - DUPLICATE_WINDOW).isoformat()


# --------------------------------------------------
# AUTH ENDPOINTS
# --------------------------------------------------

@app.post("/auth/register")
async def register(user: UserRegister):

    if len(user.password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters"
        )

    existing = get_user_by_email(user.email)

    if existing:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    user_id = create_user_id()

    # FIXED PASSWORD HASHING
    password_hash = get_password_hash(user.password)

    created_at = datetime.now().isoformat()

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO users (
            user_id,
            name,
            email,
            password_hash,
            role,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            user.name.strip(),
            user.email.lower().strip(),
            password_hash,
            "citizen",
            created_at
        ),
    )

    connection.commit()
    connection.close()

    return {
        "success": True,
        "message": "Registration successful"
    }


@app.post("/auth/login")
async def login(user: UserLogin):

    # --------------------------------------------------
    # DEMO OFFICER LOGIN
    # --------------------------------------------------

    if (
        user.email.lower() == "officer@civicvision.demo"
        and user.password == "Officer@123"
    ):

        existing = get_user_by_email(
            "officer@civicvision.demo"
        )

        if not existing:

            user_id = "OFFICER-DEMO"

            password_hash = get_password_hash(
                "Officer@123"
            )

            created_at = datetime.now().isoformat()

            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                INSERT INTO users (
                    user_id,
                    name,
                    email,
                    password_hash,
                    role,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    "Municipal Officer",
                    "officer@civicvision.demo",
                    password_hash,
                    "municipal_officer",
                    created_at
                ),
            )

            connection.commit()
            connection.close()

            existing = get_user_by_id(user_id)

        access_token_expires = timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

        access_token = create_access_token(
            data={
                "sub": existing["user_id"]
            },
            expires_delta=access_token_expires
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "user_id": existing["user_id"],
                "name": existing["name"],
                "email": existing["email"],
                "role": "municipal_officer",
            },
        }

    # --------------------------------------------------
    # REGULAR CITIZEN LOGIN
    # --------------------------------------------------

    db_user = get_user_by_email(user.email)

    if not db_user or not verify_password(
        user.password,
        db_user["password_hash"]
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if db_user["password_hash"].startswith(("$2a$", "$2b$", "$2y$")):
        connection = get_connection()
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE user_id = ?",
            (get_password_hash(user.password), db_user["user_id"]),
        )
        connection.commit()
        connection.close()

    access_token_expires = timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    access_token = create_access_token(
        data={
            "sub": db_user["user_id"]
        },
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": db_user["user_id"],
            "name": db_user["name"],
            "email": db_user["email"],
            "role": db_user["role"],
        },
    }


@app.get("/auth/me")
async def get_me(
    current_user: sqlite3.Row = Depends(get_current_user)
):

    return {
        "user": {
            "user_id": current_user["user_id"],
            "name": current_user["name"],
            "email": current_user["email"],
            "role": current_user["role"],
        }
    }


# --------------------------------------------------
# BASIC ROUTES
# --------------------------------------------------

@app.get("/")
async def root():

    return {
        "success": True,
        "message": "CivicVision AI backend is running.",
        "docs": "/docs",
    }


@app.get("/health")
async def health():

    return {
        "success": True,
        "model_loaded": MODEL_PATH.exists(),
        "database": DB_PATH.exists(),
    }


# --------------------------------------------------
# AI PREDICTION
# --------------------------------------------------

@app.post("/predict")
async def predict(
    image: UploadFile = File(...),
    current_user: sqlite3.Row = Depends(get_current_user)
):

    if (
        not image.content_type
        or not image.content_type.startswith("image/")
    ):

        raise HTTPException(
            status_code=400,
            detail="Please upload an image file."
        )

    image_id = create_image_id()
    report_id = create_report_id()

    extension = Path(
        image.filename or ""
    ).suffix.lower()

    if extension not in {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".bmp",
    }:

        extension = ".webp"

    image_path = UPLOAD_DIR / (
        f"{image_id}{extension}"
    )

    image_bytes = await image.read()

    if not image_bytes:

        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty."
        )

    image_hash = hashlib.sha256(image_bytes).hexdigest()

    try:

        image_path.write_bytes(image_bytes)

        pil_image = Image.open(
            image_path
        ).convert("RGB")

    except Exception as exc:

        if image_path.exists():
            image_path.unlink()

        raise HTTPException(
            status_code=400,
            detail=f"Invalid image file: {exc}"
        )

    try:

        results = model.predict(
            source=pil_image,
            conf=0.25,
            verbose=False,
        )

    except Exception as exc:

        if image_path.exists():
            image_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=f"YOLO prediction failed: {exc}"
        )

    result = results[0]

    detections = []

    image_width, image_height = pil_image.size

    total_pixels = max(
        image_width * image_height,
        1
    )

    if result.boxes is not None:

        for box in result.boxes:

            cls_index = int(
                box.cls[0].item()
            )

            confidence = float(
                box.conf[0].item()
            )

            if isinstance(model.names, dict):

                raw_issue = model.names.get(
                    cls_index,
                    str(cls_index)
                )

            else:

                raw_issue = model.names[
                    cls_index
                ]

            issue = str(
                raw_issue
            ).lower().strip()

            coordinates = box.xyxy[
                0
            ].tolist()

            x1, y1, x2, y2 = coordinates

            box_width = max(
                0.0,
                x2 - x1
            )

            box_height = max(
                0.0,
                y2 - y1
            )

            area_ratio = (
                box_width * box_height
            ) / total_pixels

            severity = severity_from_detection(
                area_ratio,
                confidence
            )

            priority = severity

            department = DEPARTMENTS.get(
                issue,
                "Municipal General Services"
            )

            detections.append(
                {
                    "issue": issue,
                    "confidence": round(
                        confidence,
                        4
                    ),
                    "severity": severity,
                    "priority": priority,
                    "department": department,
                    "box": [
                        round(
                            float(value),
                            2
                        )
                        for value in coordinates
                    ],
                }
            )

    if not detections:

        if image_path.exists():
            image_path.unlink()

        raise HTTPException(
            status_code=422,
            detail=(
                "No supported civic issue "
                "was detected in the image."
            )
        )

    primary = max(
        detections,
        key=lambda item: item["confidence"]
    )

    created_at = datetime.now().isoformat()

    connection = get_connection()
    cursor = connection.cursor()

    # Serialize duplicate check + insert so simultaneous prediction requests
    # from this account cannot both create a matching draft.
    cursor.execute("BEGIN IMMEDIATE")
    cursor.execute(
        """
        SELECT * FROM reports
        WHERE user_id = ? AND image_hash = ? AND created_at >= ?
          AND status != 'Draft'
        ORDER BY id DESC LIMIT 1
        """,
        (current_user["user_id"], image_hash, duplicate_cutoff()),
    )
    existing = cursor.fetchone()
    if existing is not None:
        connection.rollback()
        connection.close()
        if image_path.exists():
            image_path.unlink()
        return {
            "success": True,
            "duplicate": True,
            "report_id": existing["report_id"],
            "image_id": existing["image_id"],
            "issue": existing["issue"],
            "confidence": existing["confidence"],
            "severity": existing["severity"],
            "priority": existing["priority"],
            "department": existing["department"],
            "status": existing["status"],
            "created_at": existing["created_at"],
            "detections": [],
        }

    cursor.execute(
        """
        INSERT INTO reports (
            report_id,
            image_id,
            image_path,
            issue,
            confidence,
            severity,
            priority,
            department,
            latitude,
            longitude,
            description,
            status,
            created_at,
            user_id,
            image_hash
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            report_id,
            image_id,
            str(image_path),
            primary["issue"],
            primary["confidence"],
            primary["severity"],
            primary["priority"],
            primary["department"],
            None,
            None,
            None,
            "Draft",
            created_at,
            current_user["user_id"],
            image_hash,
        ),
    )

    connection.commit()
    connection.close()

    return {
        "success": True,
        "report_id": report_id,
        "image_id": image_id,
        "issue": primary["issue"],
        "confidence": primary["confidence"],
        "severity": primary["severity"],
        "priority": primary["priority"],
        "department": primary["department"],
        "status": "Draft",
        "created_at": created_at,
        "detections": detections,
    }


# --------------------------------------------------
# SUBMIT COMPLAINT
# --------------------------------------------------

@app.post("/reports/{report_id}/submit")
async def submit_report(
    report_id: str,
    submission: ComplaintSubmission,
    current_user: sqlite3.Row = Depends(get_current_user),
):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM reports
        WHERE report_id = ? AND user_id = ?
        """,
        (
            report_id,
            current_user["user_id"]
        ),
    )

    row = cursor.fetchone()

    if row is None:

        connection.close()

        raise HTTPException(
            status_code=404,
            detail="Report not found."
        )

    # Hold SQLite's reserved write lock across the duplicate check and update.
    cursor.execute("BEGIN IMMEDIATE")
    cursor.execute(
        """
        SELECT * FROM reports
        WHERE user_id = ? AND image_hash = ? AND image_hash IS NOT NULL
          AND created_at >= ? AND status != 'Draft' AND report_id != ?
        ORDER BY id DESC LIMIT 1
        """,
        (current_user["user_id"], row["image_hash"], duplicate_cutoff(), report_id),
    )
    existing = cursor.fetchone()
    if existing is not None:
        connection.rollback()
        connection.close()
        return {
            "success": True,
            "duplicate": True,
            "report": row_to_dict(existing),
        }

    latitude = submission.latitude
    longitude = submission.longitude

    description = (
        submission.description.strip()
        if submission.description
        else None
    )

    cursor.execute(
        """
        UPDATE reports
        SET latitude = ?,
            longitude = ?,
            description = ?,
            status = ?
        WHERE report_id = ? AND user_id = ?
        """,
        (
            latitude,
            longitude,
            description,
            "Submitted",
            report_id,
            current_user["user_id"],
        ),
    )

    connection.commit()

    cursor.execute(
        """
        SELECT *
        FROM reports
        WHERE report_id = ? AND user_id = ?
        """,
        (
            report_id,
            current_user["user_id"]
        ),
    )

    updated_row = cursor.fetchone()

    connection.close()

    return {
        "success": True,
        "report": row_to_dict(updated_row),
    }


# --------------------------------------------------
# GET REPORTS
# --------------------------------------------------

@app.get("/reports")
async def get_reports(
    current_user: sqlite3.Row = Depends(get_current_user)
):

    connection = get_connection()
    cursor = connection.cursor()

    if current_user["role"] == "municipal_officer":

        cursor.execute(
            """
            SELECT *
            FROM reports
            WHERE status != 'Draft'
            ORDER BY id DESC
            """
        )

    else:

        cursor.execute(
            """
            SELECT *
            FROM reports
            WHERE status != 'Draft'
            AND user_id = ?
            ORDER BY id DESC
            """,
            (
                current_user["user_id"],
            ),
        )

    rows = cursor.fetchall()

    connection.close()

    return {
        "success": True,
        "reports": [
            row_to_dict(row)
            for row in rows
        ],
    }


# --------------------------------------------------
# GET ALL REPORTS - OFFICER ONLY
# --------------------------------------------------

@app.get("/reports/all")
async def get_all_reports(
    current_user: sqlite3.Row = Depends(
        get_current_officer
    )
):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM reports
        WHERE status != 'Draft'
        ORDER BY id DESC
        """
    )

    rows = cursor.fetchall()

    connection.close()

    return {
        "success": True,
        "reports": [
            row_to_dict(row)
            for row in rows
        ],
    }


# --------------------------------------------------
# GET SINGLE REPORT
# --------------------------------------------------

@app.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    current_user: sqlite3.Row = Depends(
        get_current_user
    )
):

    connection = get_connection()
    cursor = connection.cursor()

    if current_user["role"] == "municipal_officer":

        cursor.execute(
            """
            SELECT *
            FROM reports
            WHERE report_id = ?
            """,
            (
                report_id,
            ),
        )

    else:

        cursor.execute(
            """
            SELECT *
            FROM reports
            WHERE report_id = ? AND user_id = ?
            """,
            (
                report_id,
                current_user["user_id"],
            ),
        )

    row = cursor.fetchone()

    connection.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Report not found."
        )

    return {
        "success": True,
        "report": row_to_dict(row),
    }


# --------------------------------------------------
# UPDATE STATUS - OFFICER ONLY
# --------------------------------------------------

@app.patch("/reports/{report_id}/status")
async def update_report_status(
    report_id: str,
    update: StatusUpdate,
    current_user: sqlite3.Row = Depends(
        get_current_officer
    ),
):

    if update.status not in ALLOWED_STATUSES:

        raise HTTPException(
            status_code=400,
            detail="Invalid status."
        )

    if update.status == "Draft":

        raise HTTPException(
            status_code=400,
            detail=(
                "Draft is managed automatically "
                "by the submission workflow."
            )
        )

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE reports
        SET status = ?
        WHERE report_id = ?
        AND status != 'Draft'
        """,
        (
            update.status,
            report_id,
        ),
    )

    if cursor.rowcount == 0:

        connection.close()

        raise HTTPException(
            status_code=404,
            detail="Submitted report not found."
        )

    connection.commit()

    cursor.execute(
        """
        SELECT *
        FROM reports
        WHERE report_id = ?
        """,
        (
            report_id,
        ),
    )

    row = cursor.fetchone()

    connection.close()

    return {
        "success": True,
        "report": row_to_dict(row),
    }
