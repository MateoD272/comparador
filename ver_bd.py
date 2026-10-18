from services.auth_service import authenticate

print(
    authenticate(
        "admin@comparapc.co",
        "admin123"
    )
)