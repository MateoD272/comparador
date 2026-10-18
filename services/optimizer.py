from typing import List, Dict, Any
from services.catalog_service import get_component_by_id


def optimize_pc_build(component_ids: List[str]) -> Dict[str, Any]:
    """
    Calcula la estrategia de compra óptima para una lista de componentes de PC seleccionados.
    Compara la compra en una sola tienda vs. comprar cada pieza en la tienda más barata.
    """
    components = [get_component_by_id(cid) for cid in component_ids]
    components = [c for c in components if c is not None]

    if not components:
        return {
            "status": "empty",
            "items_count": 0,
            "optimized_total": 0.0,
            "single_store_comparisons": {},
            "multi_store_breakdown": [],
            "stores_summary": {},
            "potential_savings": 0.0,
            "potential_savings_percent": 0.0
        }

    # Tiendas disponibles en el catálogo
    all_stores = set()
    for c in components:
        for s in c.get("stores", []):
            all_stores.add(s["name"])

    # 1. Armar compra óptima multi-tienda
    multi_store_items = []
    store_groups: Dict[str, Dict[str, Any]] = {}
    optimized_total = 0.0

    for c in components:
        stores = c.get("stores", [])
        # Filtrar tiendas con stock si es posible
        in_stock = [s for s in stores if s.get("stock", True)]
        candidates = in_stock if in_stock else stores

        if not candidates:
            continue

        best_offer = min(candidates, key=lambda s: s["price"])
        item_cost = best_offer["price"]
        store_name = best_offer["name"]

        optimized_total += item_cost

        multi_store_items.append({
            "component_id": c["id"],
            "component_name": c["name"],
            "category": c["category_name"],
            "store": store_name,
            "price": item_cost,
            "shipping": best_offer.get("shipping", "N/A"),
            "url": best_offer.get("url", "#")
        })

        if store_name not in store_groups:
            store_groups[store_name] = {
                "store": store_name,
                "item_count": 0,
                "subtotal": 0.0,
                "items": []
            }
        store_groups[store_name]["item_count"] += 1
        store_groups[store_name]["subtotal"] = round(store_groups[store_name]["subtotal"] + item_cost, 2)
        store_groups[store_name]["items"].append(c["name"])

    # 2. Calcular costo si se compra todo en una sola tienda
    single_store_baskets: Dict[str, Dict[str, Any]] = {}
    for st_name in all_stores:
        basket_total = 0.0
        available_count = 0
        missing_items = []

        for c in components:
            matching = [s for s in c.get("stores", []) if s["name"] == st_name]
            if matching and matching[0].get("stock", True):
                basket_total += matching[0]["price"]
                available_count += 1
            else:
                missing_items.append(c["name"])

        single_store_baskets[st_name] = {
            "store": st_name,
            "total": round(basket_total, 2),
            "available_count": available_count,
            "is_complete": available_count == len(components),
            "missing_items": missing_items
        }

    # 3. Calcular ahorros
    complete_single_totals = [
        info["total"] for info in single_store_baskets.values() if info["is_complete"]
    ]

    baseline_total = max(complete_single_totals) if complete_single_totals else (
        max([info["total"] for info in single_store_baskets.values()]) if single_store_baskets else optimized_total
    )

    savings = max(0.0, round(baseline_total - optimized_total, 2))
    savings_pct = round((savings / baseline_total) * 100, 1) if baseline_total > 0 else 0.0

    return {
        "status": "success",
        "items_count": len(components),
        "optimized_total": round(optimized_total, 2),
        "baseline_single_store_total": round(baseline_total, 2),
        "potential_savings": savings,
        "potential_savings_percent": savings_pct,
        "multi_store_breakdown": multi_store_items,
        "stores_summary": list(store_groups.values()),
        "single_store_comparisons": single_store_baskets
    }
