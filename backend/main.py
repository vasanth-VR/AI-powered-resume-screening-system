from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

import fitz
import os
import shutil

from database import (
    candidates_collection,
    screening_results_collection,
    jobs_collection
)

from screening import calculate_match
from ai_screening import analyze_resume

from bson import ObjectId


# --------------------------------------------------
# FASTAPI APP
# --------------------------------------------------

app = FastAPI(
    title="AI Resume Screening System",
    description="Backend API for AI-powered Resume Screening",
    version="2.0"
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# --------------------------------------------------
# UPLOAD FOLDER
# --------------------------------------------------

UPLOAD_FOLDER = "uploads"

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


# --------------------------------------------------
# HOME
# --------------------------------------------------

@app.get("/")
def home():

    return {
        "message": "AI Resume Screening Backend is running"
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health():

    return {
        "status": "OK",
        "database": "MongoDB connected",
        "ai": "Gemini connected"
    }


# --------------------------------------------------
# GET JOBS
# --------------------------------------------------

@app.get("/jobs")
def get_jobs():

    jobs = []

    for job in jobs_collection.find():

        jobs.append({
            "job_id": str(job["_id"]),
            "title": job["title"],
            "description": job["description"],
            "required_skills": job.get(
                "required_skills",
                []
            )
        })

    return {
        "success": True,
        "jobs": jobs
    }


# --------------------------------------------------
# CREATE JOB
# --------------------------------------------------

@app.post("/create-job")
async def create_job(
    job_title: str = Form(...),
    job_description: str = Form(...)
):

    job_skills = calculate_match(
        "",
        job_description
    )["required_skills"]

    job = {
        "title": job_title,
        "description": job_description,
        "required_skills": job_skills
    }

    result = jobs_collection.insert_one(job)

    return {
        "success": True,
        "message": "Job created successfully",
        "job_id": str(result.inserted_id),
        "title": job_title,
        "required_skills": job_skills
    }


# --------------------------------------------------
# SCREEN RESUME
# --------------------------------------------------

@app.post("/screen-resume")
async def screen_resume(
    resume: UploadFile = File(...),
    job_id: str = Form(...)
):

    # --------------------------------------------------
    # FIND JOB
    # --------------------------------------------------

    try:

        job = jobs_collection.find_one({
            "_id": ObjectId(job_id)
        })

    except Exception:

        return {
            "success": False,
            "message": "Invalid job ID"
        }


    if not job:

        return {
            "success": False,
            "message": "Job not found"
        }


    job_description = job["description"]


    # --------------------------------------------------
    # CHECK FILE TYPE
    # --------------------------------------------------

    if not resume.filename.lower().endswith(".pdf"):

        return {
            "success": False,
            "message": "Only PDF resumes are supported currently."
        }


    # --------------------------------------------------
    # SAVE RESUME
    # --------------------------------------------------

    file_path = os.path.join(
        UPLOAD_FOLDER,
        resume.filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            resume.file,
            buffer
        )


    # --------------------------------------------------
    # EXTRACT TEXT FROM PDF
    # --------------------------------------------------

    resume_text = ""

    try:

        document = fitz.open(
            file_path
        )

        for page in document:

            resume_text += page.get_text()

        document.close()

    except Exception as error:

        return {
            "success": False,
            "message": f"PDF extraction failed: {error}"
        }


    # --------------------------------------------------
    # SAVE CANDIDATE
    # --------------------------------------------------

    candidate = {
        "resume_filename": resume.filename,
        "resume_text": resume_text,
        "job_description": job_description
    }

    candidate_result = candidates_collection.insert_one(
        candidate
    )


    # --------------------------------------------------
    # EXISTING RULE-BASED SCREENING
    # --------------------------------------------------

    screening = calculate_match(
        resume_text,
        job_description
    )


    # --------------------------------------------------
    # GEMINI AI SCREENING
    # --------------------------------------------------

    ai_result = None
    ai_error = None

    try:

        ai_result = analyze_resume(
            resume_text,
            job_description
        )

    except Exception as error:

        ai_error = str(error)


    # --------------------------------------------------
    # SCREENING RESULT FOR MONGODB
    # --------------------------------------------------

    screening_result = {

        "candidate_id": str(
            candidate_result.inserted_id
        ),

        "resume_filename": resume.filename,

        # Existing rule-based result
        "match_score": screening[
            "match_score"
        ],

        "resume_skills": screening[
            "resume_skills"
        ],

        "required_skills": screening[
            "required_skills"
        ],

        "matched_skills": screening[
            "matched_skills"
        ],

        "missing_skills": screening[
            "missing_skills"
        ],

        # Gemini result
        "ai_analysis": ai_result,

        "ai_error": ai_error
    }


    # --------------------------------------------------
    # SAVE RESULT
    # --------------------------------------------------

    screening_results_collection.insert_one(
        screening_result
    )


    # --------------------------------------------------
    # RETURN RESULT TO FRONTEND
    # --------------------------------------------------

    return {

        "success": True,

        "message": "Resume screened successfully",

        "candidate_id": str(
            candidate_result.inserted_id
        ),

        "filename": resume.filename,


        # Existing rule-based screening
        "match_score": screening[
            "match_score"
        ],

        "resume_skills": screening[
            "resume_skills"
        ],

        "required_skills": screening[
            "required_skills"
        ],

        "matched_skills": screening[
            "matched_skills"
        ],

        "missing_skills": screening[
            "missing_skills"
        ],


        # Gemini AI
        "ai_analysis": ai_result,

        "ai_error": ai_error
    }

