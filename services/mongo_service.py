from pymongo import MongoClient

URI = "mongodb+srv://admin:monteCarlo98Reto@pricecomparison.qdtj23x.mongodb.net/"

client = MongoClient(URI)

db = client["Price_Comparicion"]

usuarios = db["usuarios"]
proveedores = db["proveedores"]
administradores = db["administradores"]
productos = db["productos"]
reseñas = db["reseñas"]
historial = db["historial"]