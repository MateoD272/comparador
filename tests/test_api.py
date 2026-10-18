"""
Suite de Pruebas Unitarias y de Integración para HardwarePrice
Verifica la lógica de negocio, filtros, comparador y optimizador de presupuesto.
"""

import unittest
import sys
import os

# Agregar directorio raíz al PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.catalog_service import (
    load_raw_data,
    get_all_components,
    get_component_by_id,
    get_categories,
    get_brands,
    get_featured_deals,
    compare_components
)
from services.optimizer import optimize_pc_build


class TestCatalogService(unittest.TestCase):

    def test_load_raw_data(self):
        """Verifica que el catálogo JSON contenga componentes válidos."""
        items = load_raw_data()
        self.assertIsInstance(items, list)
        self.assertGreater(len(items), 10, "El catálogo debe tener más de 10 componentes")
        for item in items:
            self.assertIn("id", item)
            self.assertIn("name", item)
            self.assertIn("category", item)
            self.assertIn("stores", item)
            self.assertGreater(len(item["stores"]), 0)

    def test_enrichment_calculations(self):
        """Verifica que lowest_price, savings y best_store se calculen correctamente."""
        items = get_all_components()
        for item in items:
            self.assertIn("lowest_price", item)
            self.assertIn("highest_price", item)
            self.assertIn("savings", item)
            self.assertIn("best_store", item)
            self.assertLessEqual(item["lowest_price"], item["highest_price"])
            self.assertGreaterEqual(item["savings"], 0)

    def test_filter_by_category(self):
        """Verifica el filtrado por categoría."""
        cpus = get_all_components(category="cpu")
        self.assertGreater(len(cpus), 0)
        for cpu in cpus:
            self.assertEqual(cpu["category"], "cpu")

        gpus = get_all_components(category="gpu")
        self.assertGreater(len(gpus), 0)
        for gpu in gpus:
            self.assertEqual(gpu["category"], "gpu")

    def test_filter_by_brand(self):
        """Verifica el filtrado por marca."""
        nvidia_items = get_all_components(brand="NVIDIA")
        self.assertGreater(len(nvidia_items), 0)
        for item in nvidia_items:
            self.assertEqual(item["brand"], "NVIDIA")

    def test_search(self):
        """Verifica que la búsqueda por texto funcione en nombre y specs."""
        results = get_all_components(search="Ryzen")
        self.assertGreater(len(results), 0)
        for r in results:
            self.assertIn("Ryzen", r["name"])

    def test_sort_order(self):
        """Verifica el ordenamiento por menor precio y mayor ahorro."""
        # Menor precio
        by_price = get_all_components(sort_by="price_asc")
        prices = [x["lowest_price"] for x in by_price]
        self.assertEqual(prices, sorted(prices))

        # Mayor ahorro
        by_savings = get_all_components(sort_by="savings_desc")
        savings = [x["savings"] for x in by_savings]
        self.assertEqual(savings, sorted(savings, reverse=True))

    def test_get_component_by_id(self):
        """Verifica la obtención individual de un componente y su historial de precios."""
        comp = get_component_by_id("cpu-ryzen-7-7800x3d")
        self.assertIsNotNone(comp)
        self.assertEqual(comp["name"], "AMD Ryzen 7 7800X3D")
        self.assertIn("price_history", comp)
        self.assertGreater(len(comp["price_history"]), 0)

    def test_compare_components(self):
        """Verifica la generación de la matriz comparativa frente a frente."""
        ids = ["cpu-ryzen-7-7800x3d", "cpu-intel-core-i7-14700k"]
        comp_data = compare_components(ids)
        self.assertEqual(len(comp_data["components"]), 2)
        self.assertIn("spec_keys", comp_data)
        self.assertIn("stores", comp_data)
        self.assertGreater(len(comp_data["spec_keys"]), 0)


class TestOptimizerService(unittest.TestCase):

    def test_optimize_empty_build(self):
        """Verifica el comportamiento con lista vacía."""
        res = optimize_pc_build([])
        self.assertEqual(res["items_count"], 0)
        self.assertEqual(res["optimized_total"], 0.0)

    def test_optimize_full_build(self):
        """Verifica la optimización de un ensamble con múltiples componentes."""
        ids = [
            "cpu-ryzen-7-7800x3d",
            "gpu-rtx-4070-super",
            "ram-corsair-vengeance-ddr5-32gb",
            "motherboard-asus-rog-strix-b650-a",
            "storage-samsung-990-pro-2tb",
            "psu-corsair-rm850e-850w"
        ]
        res = optimize_pc_build(ids)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["items_count"], len(ids))
        self.assertGreater(res["optimized_total"], 0)
        self.assertGreaterEqual(res["baseline_single_store_total"], res["optimized_total"])
        self.assertGreaterEqual(res["potential_savings"], 0)
        self.assertIn("multi_store_breakdown", res)
        self.assertEqual(len(res["multi_store_breakdown"]), len(ids))
        self.assertIn("single_store_comparisons", res)


if __name__ == "__main__":
    unittest.main()
