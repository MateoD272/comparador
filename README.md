# 💻 HardwarePrice - Comparador de Precios de Componentes de PC

Una plataforma web moderna y completa desarrollada en **Python** con interfaz visual en **HTML5, Tailwind CSS y JavaScript reactivo**. Permite comparar precios, disponibilidad y especificaciones técnicas de componentes de hardware para PC entre 4 tiendas principales (**Amazon, CyberPuerta, PCComponentes y Newegg**), además de contar con un **Armador y Optimizador de Presupuesto para PC**.

---

## 🚀 Inicio Rápido (Cómo Ejecutar)

Este proyecto cuenta con un servidor web dual en Python:
1. **Cero dependencias obligatorias:** Puedes correrlo inmediatamente usando únicamente las librerías nativas de Python.
2. **Soporte Flask:** Si tienes Flask instalado (`pip install flask`), lo detectará y utilizará automáticamente.

### Paso 1: Abrir la terminal en la carpeta del proyecto
```powershell
cd d:\AntiGravity
```

### Paso 2: Iniciar el servidor
```powershell
python app.py
```

### Paso 3: Abrir en tu navegador
Accede a:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

*(Opcional: puedes especificar otro puerto ejecutando `python app.py 8080`).*

---

## ✨ Funcionalidades Principales

### 1. 🔍 Catálogo Inteligente y Filtros en Tiempo Real
- **Explorador Multi-tienda:** Visualiza procesadores (CPUs), tarjetas gráficas (GPUs), memorias RAM, placas madre, almacenamiento SSD NVMe, fuentes de poder, gabinetes y sistemas de refrigeración.
- **Detección del Mejor Precio:** El sistema resalta de forma automática la tienda más barata con stock disponible y el porcentaje de ahorro frente a la tienda más cara.
- **Filtros Dinámicos:**
  - Por categoría de componente con conteo de existencias.
  - Por marca o fabricante (AMD, Intel, NVIDIA, Corsair, ASUS, MSI, Samsung, NZXT, etc.).
  - Por rango de precio máximo con control deslizante (*slider*).
  - Buscador predictivo en tiempo real por modelo o especificación técnica.
  - Ordenamiento por: Mayor ahorro, menor precio, mayor precio, mejor calificado o alfabético.

### 2. 📊 Ficha de Detalle e Historial de Precios
- Al hacer clic en cualquier componente o en el botón **"Tiendas"**, se abre un modal con:
  - Comparativa de precios de cada tienda con indicador de **En Stock / Agotado** y tipo de envío.
  - Enlaces directos a las tiendas.
  - **Gráfica interactiva de fluctuación de precios (últimos 6 meses)** construida con **Chart.js**.
  - Ficha técnica completa de especificaciones.

### 3. ⚔️ Comparador Frente a Frente (Side-by-Side)
- Permite seleccionar hasta 3 componentes para compararlos simultáneamente.
- Barra inferior flotante (*dock*) para acceso rápido.
- Genera una tabla comparativa técnica que confronta:
  - Mejor precio detectado.
  - Precio tienda por tienda.
  - Ficha técnica fila por fila (núcleos, frecuencias, sockets, TDP, memorias VRAM, etc.).

### 4. 🛠️ Armador & Optimizador de PC (*PC Builder*)
- Permite seleccionar los componentes para armar una computadora completa (CPU, GPU, Motherboard, RAM, SSD, Fuente, Gabinete y Cooler).
- **Algoritmo de Optimización de Compra:**
  - Compara el costo de comprar todo en una sola tienda vs. comprar cada pieza en la tienda más barata.
  - Muestra el **Ahorro Total Obtenido** (ej. *Ahorraste -$142.50 comprando de forma combinada*).
  - Desglosa qué artículos comprar en Amazon, cuáles en CyberPuerta, etc.

---

## 📁 Estructura del Proyecto

```
d:\AntiGravity\
├── app.py                      # Servidor backend Python (Flask + Servidor HTTP nativo de fallback)
├── data\
│   └── components.json         # Catálogo de componentes, especificaciones, tiendas e historial de precios
├── services\
│   ├── catalog_service.py      # Lógica de cálculo de mejores precios, filtros y comparador
│   └── optimizer.py            # Algoritmo de optimización del PC Builder
├── static\
│   ├── css\
│   │   └── styles.css          # Estilos personalizados (glassmorphism, tema oscuro, animaciones)
│   └── js\
│       └── app.js              # Lógica frontend reactiva (filtros, modales, Chart.js, comparador)
├── templates\
│   └── index.html              # Interfaz de usuario moderna en HTML5 con Tailwind CSS
├── tests\
│   └── test_api.py             # Suite de pruebas unitarias automatizadas
└── README.md                   # Documentación del sistema
```

---

## 🧪 Pruebas Unitarias
Para correr las pruebas unitarias y verificar el funcionamiento de los algoritmos de filtrado, cálculo de ahorro y optimizador:
```powershell
python tests\test_api.py
```
