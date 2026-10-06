import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

client = genai.Client(api_key=API_KEY)


def analyze_resume(resume_text, job_description):

    prompt = f"""
You are an expert technical recruiter.

Analyze the candidate's resume against the job description.

Return ONLY valid JSON in this format:

{{
    "match_score": 0,
    "summary": "",
    "strengths": [],
    "missing_skills": [],
    "recommendations": [],
    "suitable": true
}}

Resume:
{resume_text[:12000]}

Job Description:
{job_description[:6000]}
"""

    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt
    )

    try:
        result = json.loads(response.text)
        return result

    except json.JSONDecodeError:
        return {
            "match_score": 0,
            "summary": response.text,
            "strengths": [],
            "missing_skills": [],
            "recommendations": [],
            "suitable": False
        }