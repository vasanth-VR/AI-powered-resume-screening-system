from ai_screening import analyze_resume

result = analyze_resume(
    """
    Vasanth is a Computer Science student.
    Skills: Python, Java, SQL, Machine Learning, Pandas.
    """,
    """
    Looking for a candidate with Python,
    Machine Learning and SQL skills.
    """
)

print(result)