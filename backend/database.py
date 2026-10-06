from pymongo import MongoClient

MONGO_URL = "mongodb://localhost:27017/"

client = MongoClient(MONGO_URL)

db = client["resume_screening"]

candidates_collection = db["candidates"]
jobs_collection = db["jobs"]
screening_results_collection = db["screening_results"]

print("MongoDB connected successfully!")