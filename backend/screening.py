import re


# Skills our system can currently recognize
SKILLS = [
    "python",
    "java",
    "javascript",
    "c",
    "c++",
    "html",
    "css",
    "sql",
    "mongodb",
    "mysql",
    "git",
    "github",
    "docker",
    "aws",
    "azure",
    "gcp",
    "fastapi",
    "flask",
    "django",
    "tensorflow",
    "keras",
    "pytorch",
    "scikit-learn",
    "sklearn",
    "pandas",
    "numpy",
    "matplotlib",
    "machine learning",
    "deep learning",
    "computer vision",
    "natural language processing",
    "nlp",
    "rest api",
    "streamlit"
]


def extract_skills(text):

    text = text.lower()

    found_skills = []

    for skill in SKILLS:

        # Escape special characters such as + in C++
        pattern = r"\b" + re.escape(skill) + r"\b"

        if re.search(pattern, text):
            found_skills.append(skill)

    return sorted(set(found_skills))


def calculate_match(resume_text, job_description):

    resume_skills = extract_skills(resume_text)

    required_skills = extract_skills(job_description)

    matched_skills = [
        skill
        for skill in required_skills
        if skill in resume_skills
    ]

    missing_skills = [
        skill
        for skill in required_skills
        if skill not in resume_skills
    ]

    if len(required_skills) == 0:
        score = 0
    else:
        score = round(
            (len(matched_skills) / len(required_skills)) * 100,
            2
        )

    return {
        "match_score": score,
        "resume_skills": resume_skills,
        "required_skills": required_skills,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills
    }