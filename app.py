"""
HardwarePrice - Sistema Web de Comparación de Precios de Componentes de PC
Servidor Backend en Python con soporte dual:
- Flask (si está instalado en el entorno)
- Servidor HTTP nativo de Python (estándar, sin dependencias externas obligatorias)

Módulos:
- Catálogo & Precios Multi-tienda
- Comparador Frente a Frente
- Armador de PC & Optimizador
- Autenticación con Roles: Administrador y Cliente
- Panel de Administración (Gestión CRUD de Componentes)
"""

import sys
import os
import json
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Importar servicios de catálogo, optimizador y autenticación
from services.catalog_service import (
    get_all_components,
    get_component_by_id,
    get_categories,
    get_brands,
    get_featured_deals,
    compare_components,
    create_component,
    update_component,
    delete_component
)
from services.optimizer import optimize_pc_build
from services.auth_service import (
    authenticate,
    register_user,
    get_user_by_id,
    toggle_favorite,
    save_user_build,
    delete_user_build
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

FLASK_AVAILABLE = False
try:
    from flask import Flask, request, jsonify, render_template
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False


def create_flask_app():
    """Configura la aplicación Flask."""
    app = Flask(__name__, template_folder="templates", static_folder="static")

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def catch_all(path):
        if path.startswith("api/"):
            return jsonify({"error": "Ruta de API no encontrada"}), 404
        return render_template("index.html")

    # --- CATÁLOGO & COMPONENTES ---
    @app.route("/api/components", methods=["GET"])
    def api_components():
        category = request.args.get("category")
        brand = request.args.get("brand")
        search = request.args.get("search")
        min_price = request.args.get("min_price", type=float)
        max_price = request.args.get("max_price", type=float)
        sort_by = request.args.get("sort_by")

        items = get_all_components(
            category=category,
            brand=brand,
            search=search,
            min_price=min_price,
            max_price=max_price,
            sort_by=sort_by
        )
        return jsonify(items)

    @app.route("/api/components/<component_id>", methods=["GET"])
    def api_component_detail(component_id):
        item = get_component_by_id(component_id)
        if not item:
            return jsonify({"error": "Componente no encontrado"}), 404
        return jsonify(item)

    @app.route("/api/categories", methods=["GET"])
    def api_categories():
        return jsonify(get_categories())

    @app.route("/api/brands", methods=["GET"])
    def api_brands():
        category = request.args.get("category")
        return jsonify(get_brands(category))

    @app.route("/api/deals", methods=["GET"])
    def api_deals():
        limit = request.args.get("limit", default=4, type=int)
        return jsonify(get_featured_deals(limit))

    @app.route("/api/compare", methods=["POST"])
    def api_compare():
        data = request.get_json(silent=True) or {}
        ids = data.get("ids", [])
        return jsonify(compare_components(ids))

    @app.route("/api/optimize", methods=["POST"])
    def api_optimize():
        data = request.get_json(silent=True) or {}
        ids = data.get("ids", [])
        return jsonify(optimize_pc_build(ids))

    # --- AUTENTICACIÓN & CLIENTES ---
    @app.route("/api/auth/login", methods=["POST"])
    def api_login():
        data = request.get_json(silent=True) or {}
        user = authenticate(data.get("email", ""), data.get("password", ""))
        if not user:
            return jsonify({"error": "Credenciales inválidas"}), 401
        return jsonify({"status": "success", "user": user})

    @app.route("/api/auth/register", methods=["POST"])
    def api_register():
        data = request.get_json(silent=True) or {}
        res = register_user(
            name=data.get("name", ""),
            email=data.get("email", ""),
            password=data.get("password", ""),
            role=data.get("role", "client")
        )
        if "error" in res:
            return jsonify(res), 400
        return jsonify({"status": "success", "user": res["user"]})

    @app.route("/api/auth/me", methods=["GET"])
    def api_me():
        user_id = request.args.get("user_id")
        user = get_user_by_id(user_id) if user_id else None
        if not user:
            return jsonify({"error": "No autenticado"}), 401
        return jsonify(user)

    @app.route("/api/user/favorites", methods=["POST"])
    def api_user_favorites():
        data = request.get_json(silent=True) or {}
        user_id = data.get("user_id")
        comp_id = data.get("component_id")
        return jsonify(toggle_favorite(user_id, comp_id))

    @app.route("/api/user/builds", methods=["POST"])
    def api_user_save_build():
        data = request.get_json(silent=True) or {}
        user_id = data.get("user_id")
        name = data.get("name", "Mi Ensamble")
        comp_ids = data.get("components", [])
        return jsonify(save_user_build(user_id, name, comp_ids))

    @app.route("/api/user/builds/<build_id>", methods=["DELETE"])
    def api_user_delete_build(build_id):
        user_id = request.args.get("user_id")
        return jsonify(delete_user_build(user_id, build_id))

    # --- PANEL ADMINISTRADOR (CRUD) ---
    @app.route("/api/admin/components", methods=["POST"])
    def api_admin_create():
        data = request.get_json(silent=True) or {}
        created = create_component(data)
        return jsonify({"status": "success", "component": created})

    @app.route("/api/admin/components/<component_id>", methods=["PUT"])
    def api_admin_update(component_id):
        data = request.get_json(silent=True) or {}
        updated = update_component(component_id, data)
        if not updated:
            return jsonify({"error": "Componente no encontrado"}), 404
        return jsonify({"status": "success", "component": updated})

    @app.route("/api/admin/components/<component_id>", methods=["DELETE"])
    def api_admin_delete(component_id):
        ok = delete_component(component_id)
        if not ok:
            return jsonify({"error": "Componente no encontrado"}), 404
        return jsonify({"status": "success", "deleted_id": component_id})

    return app

if FLASK_AVAILABLE:
    app = create_flask_app()

class NativeRequestHandler(SimpleHTTPRequestHandler):
    """Manejador HTTP nativo con soporte para API REST, Autenticación, Roles y Archivos Estáticos."""

    def _send_json(self, data, status_code=200):
        response_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Rutas de la API Catálogo
        if path == "/api/components":
            category = query.get("category", [None])[0]
            brand = query.get("brand", [None])[0]
            search = query.get("search", [None])[0]
            min_p = float(query.get("min_price", [0])[0]) if "min_price" in query else None
            max_p = float(query.get("max_price", [0])[0]) if "max_price" in query else None
            sort_b = query.get("sort_by", [None])[0]
            self._send_json(get_all_components(category, brand, search, min_p, max_p, sort_b))
            return

        if path.startswith("/api/components/"):
            comp_id = path.replace("/api/components/", "").strip()
            item = get_component_by_id(comp_id)
            if item:
                self._send_json(item)
            else:
                self._send_json({"error": "Componente no encontrado"}, 404)
            return

        if path == "/api/categories":
            self._send_json(get_categories())
            return

        if path == "/api/brands":
            category = query.get("category", [None])[0]
            self._send_json(get_brands(category))
            return

        if path == "/api/deals":
            limit = int(query.get("limit", [4])[0])
            self._send_json(get_featured_deals(limit))
            return

        # Rutas de Usuario
        if path == "/api/auth/me":
            user_id = query.get("user_id", [None])[0]
            user = get_user_by_id(user_id) if user_id else None
            if user:
                self._send_json(user)
            else:
                self._send_json({"error": "No autenticado"}, 401)
            return

        # Servir Frontend (SPA para cualquier ruta de navegación como /, /admin, /login, /client, etc.)
        if not path.startswith("/api/") and not path.startswith("/static/"):
            template_path = os.path.join(TEMPLATES_DIR, "index.html")
            if not os.path.exists(template_path):
                template_path = os.path.join(BASE_DIR, "index.html")
            if os.path.exists(template_path):
                with open(template_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        # Servir archivos estáticos
        if path.startswith("/static/"):
            relative_file = path.replace("/static/", "", 1).lstrip("/")
            full_path = os.path.join(STATIC_DIR, relative_file)
            if os.path.exists(full_path) and os.path.isfile(full_path):
                ext = os.path.splitext(full_path)[1].lower()
                mime_types = {
                    ".css": "text/css; charset=utf-8",
                    ".js": "application/javascript; charset=utf-8",
                    ".json": "application/json; charset=utf-8",
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".svg": "image/svg+xml"
                }
                content_type = mime_types.get(ext, "application/octet-stream")
                with open(full_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        self._send_json({"error": "Ruta no encontrada"}, 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        
        try:
            payload = json.loads(body)
        except Exception:
            payload = {}

        if path == "/api/compare":
            self._send_json(compare_components(payload.get("ids", [])))
            return

        if path == "/api/optimize":
            self._send_json(optimize_pc_build(payload.get("ids", [])))
            return

        if path == "/api/auth/login":
            user = authenticate(payload.get("email", ""), payload.get("password", ""))
            if not user:
                self._send_json({"error": "Credenciales inválidas"}, 401)
            else:
                self._send_json({"status": "success", "user": user})
            return

        if path == "/api/auth/register":
            res = register_user(
                payload.get("name", ""),
                payload.get("email", ""),
                payload.get("password", ""),
                payload.get("role", "client")
            )
            if "error" in res:
                self._send_json(res, 400)
            else:
                self._send_json({"status": "success", "user": res["user"]})
            return

        if path == "/api/user/favorites":
            self._send_json(toggle_favorite(payload.get("user_id"), payload.get("component_id")))
            return

        if path == "/api/user/builds":
            self._send_json(save_user_build(payload.get("user_id"), payload.get("name", ""), payload.get("components", [])))
            return

        if path == "/api/admin/components":
            created = create_component(payload)
            self._send_json({"status": "success", "component": created})
            return

        self._send_json({"error": "Ruta no encontrada"}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        
        try:
            payload = json.loads(body)
        except Exception:
            payload = {}

        if path.startswith("/api/admin/components/"):
            comp_id = path.replace("/api/admin/components/", "").strip()
            updated = update_component(comp_id, payload)
            if updated:
                self._send_json({"status": "success", "component": updated})
            else:
                self._send_json({"error": "Componente no encontrado"}, 404)
            return

        self._send_json({"error": "Ruta no encontrada"}, 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path.startswith("/api/admin/components/"):
            comp_id = path.replace("/api/admin/components/", "").strip()
            ok = delete_component(comp_id)
            if ok:
                self._send_json({"status": "success", "deleted_id": comp_id})
            else:
                self._send_json({"error": "Componente no encontrado"}, 404)
            return

        if path.startswith("/api/user/builds/"):
            build_id = path.replace("/api/user/builds/", "").strip()
            user_id = query.get("user_id", [None])[0]
            self._send_json(delete_user_build(user_id, build_id))
            return

        self._send_json({"error": "Ruta no encontrada"}, 404)


def run_native_server(port=5000):
    """Ejecuta el servidor nativo de Python."""
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, NativeRequestHandler)
    print(f"\n========================================================")
    print(f"  HardwarePrice Server (Python Native)")
    print(f"  Autenticación habilitada (Admin & Cliente)")
    print(f"  Servidor iniciado en: http://127.0.0.1:{port}")
    print(f"  Presiona Ctrl+C para detener.")
    print(f"========================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        httpd.server_close()


if __name__ == "__main__":
    port = 5000
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])

    if FLASK_AVAILABLE:
        print(f"\n>>> Iniciando con Flask en http://127.0.0.1:{port} ...")
        app.run(host="127.0.0.1", port=port, debug=True)
    else:
        print(f"\n>>> Flask no detectado. Iniciando con Servidor Nativo Python en http://127.0.0.1:{port} ...")
        run_native_server(port)
