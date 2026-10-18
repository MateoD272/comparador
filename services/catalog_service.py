import json
import os
from typing import List, Dict, Any, Optional

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "components.json")


def load_raw_data() -> List[Dict[str, Any]]:
    """Carga los componentes desde el archivo JSON."""
    if not os.path.exists(DATA_PATH):
        return []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def enrich_component(item: Dict[str, Any]) -> Dict[str, Any]:
    """Calcula precios mínimos, máximos, ahorros y mejor tienda para un componente."""
    stores = item.get("stores", [])
    if not stores:
        return item
    
    # Precios de tiendas con stock disponible
    in_stock_stores = [s for s in stores if s.get("stock", False)]
    valid_stores = in_stock_stores if in_stock_stores else stores

    prices = [s["price"] for s in valid_stores]
    all_prices = [s["price"] for s in stores]

    lowest_price = min(prices) if prices else 0.0
    highest_price = max(all_prices) if all_prices else lowest_price
    
    best_store_info = min(valid_stores, key=lambda s: s["price"]) if valid_stores else stores[0]
    savings = round(highest_price - lowest_price, 2)
    savings_pct = round((savings / highest_price) * 100, 1) if highest_price > 0 else 0.0

    enriched = dict(item)
    enriched["lowest_price"] = lowest_price
    enriched["highest_price"] = highest_price
    enriched["savings"] = savings
    enriched["savings_percent"] = savings_pct
    enriched["best_store"] = best_store_info.get("name")
    return enriched


def get_all_components(
    category: Optional[str] = None,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Obtiene y filtra los componentes según los parámetros dados."""
    items = [enrich_component(c) for c in load_raw_data()]

    if category and category.lower() != "all":
        items = [c for c in items if c.get("category", "").lower() == category.lower()]

    if brand and brand.lower() != "all":
        items = [c for c in items if c.get("brand", "").lower() == brand.lower()]

    if search:
        query = search.strip().lower()
        items = [
            c for c in items 
            if query in c.get("name", "").lower() 
            or query in c.get("brand", "").lower() 
            or query in c.get("category_name", "").lower()
            or any(query in str(v).lower() for v in c.get("specs", {}).values())
        ]

    if min_price is not None:
        items = [c for c in items if c.get("lowest_price", 0) >= min_price]

    if max_price is not None:
        items = [c for c in items if c.get("lowest_price", 0) <= max_price]

    # Ordenamiento
    if sort_by == "price_asc":
        items.sort(key=lambda x: x.get("lowest_price", 0))
    elif sort_by == "price_desc":
        items.sort(key=lambda x: x.get("lowest_price", 0), reverse=True)
    elif sort_by == "savings_desc":
        items.sort(key=lambda x: x.get("savings", 0), reverse=True)
    elif sort_by == "rating_desc":
        items.sort(key=lambda x: x.get("rating", 0), reverse=True)
    elif sort_by == "name_asc":
        items.sort(key=lambda x: x.get("name", ""))
    
    return items


def get_component_by_id(component_id: str) -> Optional[Dict[str, Any]]:
    """Obtiene un componente específico por su identificador."""
    for item in load_raw_data():
        if item.get("id") == component_id:
            return enrich_component(item)
    return None


def get_categories() -> List[Dict[str, Any]]:
    """Obtiene lista consolidada de categorías con conteo de productos e íconos descriptivos."""
    items = load_raw_data()
    cat_map = {
        "cpu": {"name": "Procesadores", "icon": "cpu"},
        "gpu": {"name": "Tarjetas Gráficas", "icon": "monitor"},
        "ram": {"name": "Memoria RAM", "icon": "layers"},
        "motherboard": {"name": "Placas Madre", "icon": "hard-drive"},
        "storage": {"name": "Almacenamiento", "icon": "database"},
        "psu": {"name": "Fuentes de Poder", "icon": "zap"},
        "case": {"name": "Gabinetes", "icon": "box"},
        "cooler": {"name": "Refrigeración", "icon": "wind"}
    }
    
    counts: Dict[str, int] = {}
    for item in items:
        c = item.get("category", "")
        counts[c] = counts.get(c, 0) + 1

    result = []
    for code, info in cat_map.items():
        result.append({
            "code": code,
            "name": info["name"],
            "icon": info["icon"],
            "count": counts.get(code, 0)
        })
    return result


def get_brands(category: Optional[str] = None) -> List[str]:
    """Obtiene marcas únicas, opcionalmente filtradas por categoría."""
    items = load_raw_data()
    if category and category.lower() != "all":
        items = [c for c in items if c.get("category", "").lower() == category.lower()]
    brands = sorted(list({c.get("brand") for c in items if c.get("brand")}))
    return brands


def get_featured_deals(limit: int = 4) -> List[Dict[str, Any]]:
    """Obtiene las mejores ofertas ordenadas por ahorro absoluto o porcentual."""
    items = [enrich_component(c) for c in load_raw_data()]
    items.sort(key=lambda x: (x.get("savings", 0), x.get("savings_percent", 0)), reverse=True)
    return items[:limit]


def compare_components(component_ids: List[str]) -> Dict[str, Any]:
    """Genera matriz comparativa lado a lado para los IDs recibidos."""
    selected = [get_component_by_id(cid) for cid in component_ids]
    selected = [s for s in selected if s is not None]

    if not selected:
        return {"components": [], "common_specs": [], "stores_comparison": []}

    # Recopilar todas las llaves de especificaciones técnicas únicas
    spec_keys = []
    for comp in selected:
        for k in comp.get("specs", {}).keys():
            if k not in spec_keys:
                spec_keys.append(k)

    # Recopilar todas las tiendas
    all_store_names = set()
    for comp in selected:
        for st in comp.get("stores", []):
            all_store_names.add(st["name"])

    return {
        "components": selected,
        "spec_keys": spec_keys,
        "stores": sorted(list(all_store_names))
    }


def save_raw_data(items: List[Dict[str, Any]]) -> None:
    """Guarda los componentes en el archivo JSON."""
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


def create_component(data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea y persiste un nuevo componente (Función Administrador)."""
    items = load_raw_data()
    comp_id = data.get("id") or f"{data.get('category', 'part')}-{len(items)+1}"
    data["id"] = comp_id
    items.append(data)
    save_raw_data(items)
    return enrich_component(data)


def update_component(comp_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Actualiza datos o precios de un componente existente (Función Administrador)."""
    items = load_raw_data()
    for i, item in enumerate(items):
        if item.get("id") == comp_id:
            items[i].update(data)
            items[i]["id"] = comp_id
            save_raw_data(items)
            return enrich_component(items[i])
    return None


def delete_component(comp_id: str) -> bool:
    """Elimina un componente del catálogo (Función Administrador)."""
    items = load_raw_data()
    initial_len = len(items)
    items = [item for item in items if item.get("id") != comp_id]
    if len(items) < initial_len:
        save_raw_data(items)
        return True
    return False
