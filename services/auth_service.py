import json
import os
import uuid
from typing import List, Dict, Any, Optional
from services.mongo_service import (
    usuarios,
    proveedores,
    administradores
)

USERS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "users.json")


def load_users() -> List[Dict[str, Any]]:
    """Carga los usuarios desde el archivo JSON."""
    if not os.path.exists(USERS_PATH):
        return []
    with open(USERS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_users(users: List[Dict[str, Any]]) -> None:
    """Guarda la lista de usuarios en el archivo JSON."""
    with open(USERS_PATH, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)


def sanitize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Elimina datos sensibles como la contraseña al responder a la interfaz."""
    safe = dict(user)
    safe.pop("password", None)
    return safe


def authenticate(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Valida credenciales usando MongoDB."""

    clean_email = email.strip().lower()

    admin = administradores.find_one({
        "correo": clean_email,
        "contraseña": password.strip()
    })

    if admin:
        return {
            "id": admin["_id"],
            "email": admin["correo"],
            "role": "admin"
        }

    usuario = usuarios.find_one({
        "correo": clean_email,
        "contraseña": password.strip()
    })

    if usuario:
        return {
            "id": usuario["_id"],
            "email": usuario["correo"],
            "role": "usuario"
        }

    proveedor = proveedores.find_one({
        "nombre_tienda": email.strip(),
        "contraseña": password.strip()
    })

    if proveedor:
        return {
            "id": proveedor["_id"],
            "role": "proveedor"
        }

    return None


def register_user(name: str, email: str, password: str, role: str = "client") -> Dict[str, Any]:
    """Registra un nuevo usuario en el sistema."""
    users = load_users()
    clean_email = email.strip().lower()

    if any(u.get("email", "").lower() == clean_email for u in users):
        return {"error": "El correo ya está registrado"}

    new_user = {
        "id": f"usr-{uuid.uuid4().hex[:8]}",
        "name": name.strip(),
        "email": clean_email,
        "password": password.strip(),
        "role": role if role in ["admin", "client"] else "client",
        "favorites": [],
        "saved_builds": []
    }

    users.append(new_user)
    save_users(users)
    return {"user": sanitize_user(new_user)}


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Busca un usuario por su identificador."""
    users = load_users()
    for u in users:
        if u.get("id") == user_id:
            return sanitize_user(u)
    return None


def toggle_favorite(user_id: str, component_id: str) -> Dict[str, Any]:
    """Agrega o quita un componente de la lista de favoritos de un cliente."""
    users = load_users()
    for u in users:
        if u.get("id") == user_id:
            favs = u.setdefault("favorites", [])
            if component_id in favs:
                favs.remove(component_id)
                action = "removed"
            else:
                favs.append(component_id)
                action = "added"
            save_users(users)
            return {"status": "success", "action": action, "favorites": favs}
    return {"error": "Usuario no encontrado"}


def save_user_build(user_id: str, build_name: str, component_ids: List[str]) -> Dict[str, Any]:
    """Guarda una configuración de PC en el perfil del cliente."""
    users = load_users()
    for u in users:
        if u.get("id") == user_id:
            builds = u.setdefault("saved_builds", [])
            new_build = {
                "id": f"build-{uuid.uuid4().hex[:6]}",
                "name": build_name.strip() or "Mi Ensamble Personalizado",
                "components": component_ids
            }
            builds.append(new_build)
            save_users(users)
            return {"status": "success", "build": new_build, "saved_builds": builds}
    return {"error": "Usuario no encontrado"}


def delete_user_build(user_id: str, build_id: str) -> Dict[str, Any]:
    """Elimina un ensamble guardado."""
    users = load_users()
    for u in users:
        if u.get("id") == user_id:
            builds = u.setdefault("saved_builds", [])
            u["saved_builds"] = [b for b in builds if b.get("id") != build_id]
            save_users(users)
            return {"status": "success", "saved_builds": u["saved_builds"]}
    return {"error": "Usuario no encontrado"}
