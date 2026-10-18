/**
 * HardwarePrice - Lógica Frontend Interactiva con Autenticación y Roles
 * Manejo de Admin (CRUD) y Cliente (Favoritos, Ensambles Guardados)
 */

const state = {
  components: [],
  categories: [],
  brands: [],
  deals: [],
  activeCategory: 'all',
  activeBrand: 'all',
  searchQuery: '',
  maxPrice: 1200,
  sortBy: 'savings_desc',
  compareList: [],
  builderSlots: {
    cpu: null,
    gpu: null,
    motherboard: null,
    ram: null,
    storage: null,
    psu: null,
    case: null,
    cooler: null
  },
  activeTab: 'catalog',
  priceChartInstance: null,
  currentUser: null
};

const SLOT_DEFINITIONS = [
  { key: 'cpu', name: 'Procesador (CPU)', icon: 'cpu' },
  { key: 'gpu', name: 'Tarjeta Gráfica (GPU)', icon: 'monitor' },
  { key: 'motherboard', name: 'Placa Madre (Motherboard)', icon: 'hard-drive' },
  { key: 'ram', name: 'Memoria RAM', icon: 'layers' },
  { key: 'storage', name: 'Almacenamiento (SSD NVMe)', icon: 'database' },
  { key: 'psu', name: 'Fuente de Poder (PSU)', icon: 'zap' },
  { key: 'case', name: 'Gabinete (Case)', icon: 'box' },
  { key: 'cooler', name: 'Refrigeración (Cooler)', icon: 'wind' }
];

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar usuario guardado en sesión
  const savedUser = localStorage.getItem('hp_user');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
    } catch (e) {
      state.currentUser = null;
    }
  }

  updateAuthUI();

  await Promise.all([
    fetchCategories(),
    fetchBrands(),
    fetchDeals(),
    fetchComponents()
  ]);

  renderBuilderSlots();
  lucide.createIcons();
});

// GESTIÓN DE SESIÓN Y AUTENTICACIÓN
function updateAuthUI() {
  const loggedOutEl = document.getElementById('auth-logged-out');
  const loggedInEl = document.getElementById('auth-logged-in');
  const navClient = document.getElementById('nav-client');
  const navAdmin = document.getElementById('nav-admin');

  if (state.currentUser) {
    loggedOutEl.classList.add('hidden');
    loggedInEl.classList.remove('hidden');

    document.getElementById('user-display-name').textContent = state.currentUser.name;
    document.getElementById('user-avatar-initial').textContent = state.currentUser.name.charAt(0).toUpperCase();

    const roleBadge = document.getElementById('user-display-role');
    if (state.currentUser.role === 'admin') {
      roleBadge.textContent = 'ADMIN';
      roleBadge.className = 'text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30';
      navAdmin.classList.remove('hidden');
      navClient.classList.add('hidden');
    } else {
      roleBadge.textContent = 'CLIENTE';
      roleBadge.className = 'text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      navClient.classList.remove('hidden');
      navAdmin.classList.add('hidden');
    }
  } else {
    loggedOutEl.classList.remove('hidden');
    loggedInEl.classList.add('hidden');
    navClient.classList.add('hidden');
    navAdmin.classList.add('hidden');
  }
}

function openAuthModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

async function quickLogin(role) {
  const creds = role === 'admin' 
    ? { email: 'admin@hardwareprice.com', password: 'admin' }
    : { email: 'cliente@hardwareprice.com', password: '123' };

  await login(creds.email, creds.password);
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  await login(email, password);
}

async function login(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  // Función auxiliar de inicio local en caso de que el backend no esté reiniciado
  const fallbackLocalLogin = () => {
    if (cleanEmail === 'admin@hardwareprice.com' && cleanPass === 'admin') {
      return { id: 'usr-admin-01', name: 'Administrador Principal', email: cleanEmail, role: 'admin' };
    } else if (cleanEmail === 'cliente@hardwareprice.com' && cleanPass === '123') {
      return { id: 'usr-client-01', name: 'David Cliente', email: cleanEmail, role: 'client', favorites: ['cpu-ryzen-7-7800x3d'], saved_builds: [] };
    }
    return null;
  };

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: cleanPass })
    });

    let data = null;
    try {
      data = await res.json();
    } catch(e) {}

    // Si la ruta del backend devolvió 404 porque no se ha reiniciado el proceso 'py app.py'
    if (!res.ok || (data && data.error === 'Ruta no encontrada')) {
      const localUser = fallbackLocalLogin();
      if (localUser) {
        state.currentUser = localUser;
        localStorage.setItem('hp_user', JSON.stringify(localUser));
        closeAuthModal();
        updateAuthUI();
        renderProducts();
        showToast(`¡Sesión iniciada como ${localUser.name}! (Recuerda reiniciar py app.py)`, 'success');
        if (localUser.role === 'admin') switchTab('admin');
        else switchTab('catalog');
        return;
      } else {
        showToast('Credenciales incorrectas (Usa los botones de 1 clic)', 'warning');
        return;
      }
    }

    if (data && data.error) {
      showToast(data.error, 'warning');
      return;
    }

    if (data && data.user) {
      state.currentUser = data.user;
      localStorage.setItem('hp_user', JSON.stringify(data.user));
      closeAuthModal();
      updateAuthUI();
      renderProducts();

      if (state.currentUser.role === 'admin') {
        showToast(`¡Bienvenido Administrador ${data.user.name}!`, 'success');
        switchTab('admin');
      } else {
        showToast(`¡Bienvenido ${data.user.name}!`, 'success');
        switchTab('catalog');
      }
    }
  } catch (err) {
    console.warn('Backend API offline o no reiniciado. Usando autenticación local fallback:', err);
    const localUser = fallbackLocalLogin();
    if (localUser) {
      state.currentUser = localUser;
      localStorage.setItem('hp_user', JSON.stringify(localUser));
      closeAuthModal();
      updateAuthUI();
      renderProducts();
      showToast(`¡Bienvenido ${localUser.name}!`, 'success');
      if (localUser.role === 'admin') switchTab('admin');
      else switchTab('catalog');
    } else {
      showToast('Credenciales inválidas', 'warning');
    }
  }
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('hp_user');
  updateAuthUI();
  renderProducts();
  switchTab('catalog');
  showToast('Sesión cerrada correctamente', 'info');
}

// GESTIÓN DE PESTAÑAS (TABS)
function switchTab(tab) {
  state.activeTab = tab;
  
  const views = {
    catalog: document.getElementById('view-catalog'),
    compare: document.getElementById('view-compare'),
    builder: document.getElementById('view-builder'),
    client: document.getElementById('view-client'),
    admin: document.getElementById('view-admin')
  };

  const navs = {
    catalog: document.getElementById('nav-catalog'),
    compare: document.getElementById('nav-compare'),
    builder: document.getElementById('nav-builder'),
    client: document.getElementById('nav-client'),
    admin: document.getElementById('nav-admin')
  };

  Object.keys(views).forEach(key => {
    if (views[key]) {
      if (key === tab) {
        views[key].classList.remove('hidden');
        if (navs[key]) navs[key].className = 'px-3 py-2 rounded-lg text-sm font-medium transition-colors text-white bg-indigo-600/30 border border-indigo-500/40 flex items-center space-x-2';
      } else {
        views[key].classList.add('hidden');
        if (navs[key]) navs[key].className = 'px-3 py-2 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center space-x-2';
      }
    }
  });

  if (tab === 'compare') renderCompareView();
  else if (tab === 'builder') renderBuilderView();
  else if (tab === 'client') renderClientView();
  else if (tab === 'admin') renderAdminView();

  lucide.createIcons();
}

// LLAMADAS A LA API
async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    state.categories = await res.json();
    renderCategoriesFilter();
  } catch (err) {
    console.error('Error cargando categorías:', err);
  }
}

async function fetchBrands() {
  try {
    const url = state.activeCategory !== 'all' ? `/api/brands?category=${state.activeCategory}` : '/api/brands';
    const res = await fetch(url);
    state.brands = await res.json();
    renderBrandsFilter();
  } catch (err) {
    console.error('Error cargando marcas:', err);
  }
}

async function fetchDeals() {
  try {
    const res = await fetch('/api/deals?limit=4');
    state.deals = await res.json();
    renderDeals();
  } catch (err) {
    console.error('Error cargando ofertas:', err);
  }
}

async function fetchComponents() {
  try {
    const params = new URLSearchParams();
    if (state.activeCategory !== 'all') params.append('category', state.activeCategory);
    if (state.activeBrand !== 'all') params.append('brand', state.activeBrand);
    if (state.searchQuery) params.append('search', state.searchQuery);
    if (state.maxPrice) params.append('max_price', state.maxPrice);
    if (state.sortBy) params.append('sort_by', state.sortBy);

    const res = await fetch(`/api/components?${params.toString()}`);
    state.components = await res.json();
    renderProducts();
    if (state.activeTab === 'admin') renderAdminView();
  } catch (err) {
    console.error('Error cargando componentes:', err);
  }
}

// RENDERIZADO DE OFERTAS
function renderDeals() {
  const container = document.getElementById('deals-grid');
  if (!container) return;

  container.innerHTML = state.deals.map(item => `
    <div class="glass-card rounded-2xl p-4 flex flex-col justify-between border border-rose-500/20 hover:border-rose-500/40 relative overflow-hidden group cursor-pointer" onclick="openProductModal('${item.id}')">
      <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
        Ahorras $${item.savings.toFixed(2)} (${item.savings_percent}%)
      </div>
      <div class="flex items-center space-x-3 mb-3">
        <img src="${item.image}" alt="${item.name}" class="w-14 h-14 rounded-xl object-cover border border-slate-700">
        <div class="overflow-hidden">
          <span class="text-[10px] uppercase font-bold text-slate-400">${item.category_name}</span>
          <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
          <span class="text-[11px] text-slate-400">Mejor en <strong class="text-indigo-400">${item.best_store}</strong></span>
        </div>
      </div>
      <div class="flex items-baseline justify-between pt-2 border-t border-slate-800">
        <div>
          <span class="text-lg font-black text-emerald-400">$${item.lowest_price.toFixed(2)}</span>
          <span class="text-xs text-slate-500 line-through ml-1">$${item.highest_price.toFixed(2)}</span>
        </div>
        <span class="text-xs text-indigo-400 group-hover:underline">Ver tiendas &rarr;</span>
      </div>
    </div>
  `).join('');
}

// RENDERIZADO DE FILTROS
function renderCategoriesFilter() {
  const container = document.getElementById('category-filter-list');
  if (!container) return;

  const totalCount = state.categories.reduce((acc, c) => acc + c.count, 0);

  let html = `
    <button 
      onclick="setCategory('all')" 
      class="w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition flex items-center justify-between ${
        state.activeCategory === 'all' 
          ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
      }"
    >
      <div class="flex items-center space-x-2">
        <i data-lucide="layers" class="w-4 h-4"></i>
        <span>Todas las categorías</span>
      </div>
      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">${totalCount}</span>
    </button>
  `;

  state.categories.forEach(cat => {
    const isSelected = state.activeCategory === cat.code;
    html += `
      <button 
        onclick="setCategory('${cat.code}')" 
        class="w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition flex items-center justify-between ${
          isSelected 
            ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }"
      >
        <div class="flex items-center space-x-2">
          <i data-lucide="${cat.icon || 'box'}" class="w-4 h-4"></i>
          <span>${cat.name}</span>
        </div>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">${cat.count}</span>
      </button>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

function renderBrandsFilter() {
  const container = document.getElementById('brand-filter-list');
  if (!container) return;

  let html = `
    <label class="flex items-center space-x-2 text-xs text-slate-400 hover:text-white cursor-pointer py-1">
      <input type="radio" name="brand_filter" value="all" ${state.activeBrand === 'all' ? 'checked' : ''} onchange="setBrand('all')" class="accent-indigo-500">
      <span>Todas las marcas</span>
    </label>
  `;

  state.brands.forEach(brand => {
    html += `
      <label class="flex items-center space-x-2 text-xs text-slate-400 hover:text-white cursor-pointer py-1">
        <input type="radio" name="brand_filter" value="${brand}" ${state.activeBrand === brand ? 'checked' : ''} onchange="setBrand('${brand}')" class="accent-indigo-500">
        <span>${brand}</span>
      </label>
    `;
  });

  container.innerHTML = html;
}

// RENDERIZADO DE PRODUCTOS EN EL CATÁLOGO
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const empty = document.getElementById('empty-state');
  const countLabel = document.getElementById('results-count');
  const statTotal = document.getElementById('stat-total-items');

  if (statTotal) statTotal.textContent = state.components.length;

  if (state.components.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    countLabel.textContent = '0 componentes encontrados';
    return;
  }

  empty.classList.add('hidden');
  countLabel.textContent = `Mostrando ${state.components.length} componentes encontrados`;

  grid.innerHTML = state.components.map(item => {
    const isComparing = state.compareList.includes(item.id);
    const isFavorite = state.currentUser?.favorites?.includes(item.id);
    const keySpecs = Object.entries(item.specs || {}).slice(0, 3);

    return `
      <div class="glass-card rounded-2xl p-5 flex flex-col justify-between border border-slate-800 relative group">
        
        <div>
          <!-- IMAGEN & BADGES -->
          <div class="relative h-44 rounded-xl overflow-hidden bg-slate-900 mb-4 border border-slate-800">
            <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
            
            <div class="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
              <span class="px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold border border-slate-700">
                ${item.brand}
              </span>
              ${item.badge ? `
                <span class="px-2 py-0.5 rounded-full bg-indigo-500/80 backdrop-blur-md text-white text-[10px] font-bold">
                  ${item.badge}
                </span>
              ` : ''}
            </div>

            <!-- BOTÓN FAVORITO (CLIENTE) -->
            <button 
              onclick="toggleFavorite('${item.id}')"
              class="absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition shadow-md ${
                isFavorite 
                  ? 'bg-rose-500 text-white' 
                  : 'bg-slate-900/80 text-slate-400 hover:text-rose-400 hover:bg-slate-900'
              }"
              title="${isFavorite ? 'Quitar de Favoritos' : 'Guardar en Favoritos'}"
            >
              <i data-lucide="heart" class="w-4 h-4 ${isFavorite ? 'fill-white' : ''}"></i>
            </button>

            ${item.savings > 0 ? `
              <div class="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full bg-emerald-500/90 text-slate-950 text-[10px] font-black shadow-lg">
                -${item.savings_percent}% ahorro
              </div>
            ` : ''}
          </div>

          <!-- INFO -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-[11px] text-slate-400">
              <span>${item.category_name}</span>
              <div class="flex items-center text-amber-400">
                <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 mr-1"></i>
                <span class="font-bold">${item.rating}</span>
                <span class="text-slate-500 ml-1">(${item.reviews_count})</span>
              </div>
            </div>

            <h3 class="text-sm font-bold text-white group-hover:text-indigo-400 transition leading-snug cursor-pointer line-clamp-2" onclick="openProductModal('${item.id}')">
              ${item.name}
            </h3>

            <!-- ESPECIFICACIONES -->
            <div class="space-y-1 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
              ${keySpecs.map(([k, v]) => `
                <div class="flex justify-between">
                  <span class="text-slate-500">${k}:</span>
                  <span class="font-medium text-slate-300">${v}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- PRECIOS Y ACCIONES -->
        <div class="pt-4 mt-4 border-t border-slate-800 space-y-3">
          <div class="flex items-baseline justify-between">
            <div>
              <span class="text-[10px] text-slate-400 block">Mejor precio desde:</span>
              <span class="text-2xl font-black text-white">$${item.lowest_price.toFixed(2)}</span>
              ${item.savings > 0 ? `
                <span class="text-xs text-slate-500 line-through ml-1">$${item.highest_price.toFixed(2)}</span>
              ` : ''}
            </div>
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              en ${item.best_store}
            </span>
          </div>

          <!-- BOTONERA -->
          <div class="grid grid-cols-3 gap-2 text-xs font-semibold">
            <button 
              onclick="openProductModal('${item.id}')" 
              class="col-span-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-center"
            >
              Tiendas
            </button>

            <button 
              onclick="toggleCompare('${item.id}')" 
              class="col-span-1 py-2 rounded-xl transition text-center flex items-center justify-center space-x-1 ${
                isComparing 
                  ? 'bg-violet-600 text-white' 
                  : 'bg-slate-800/80 hover:bg-violet-900/40 text-violet-300 border border-violet-500/30'
              }"
            >
              <i data-lucide="${isComparing ? 'check' : 'columns'}" class="w-3.5 h-3.5"></i>
              <span>${isComparing ? 'Listo' : 'Comparar'}</span>
            </button>

            <button 
              onclick="addToBuilder('${item.id}')" 
              class="col-span-1 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition text-center flex items-center justify-center space-x-1"
            >
              <i data-lucide="wrench" class="w-3.5 h-3.5"></i>
              <span>Armador</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// CLIENTE: GESTIÓN DE FAVORITOS
async function toggleFavorite(componentId) {
  if (!state.currentUser) {
    showToast('Inicia sesión como cliente para guardar favoritos', 'info');
    openAuthModal();
    return;
  }

  try {
    const res = await fetch('/api/user/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: state.currentUser.id,
        component_id: componentId
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      state.currentUser.favorites = data.favorites;
      localStorage.setItem('hp_user', JSON.stringify(state.currentUser));
      renderProducts();
      if (state.activeTab === 'client') renderClientView();
      showToast(data.action === 'added' ? '¡Añadido a tus favoritos!' : 'Removido de favoritos', 'success');
    }
  } catch (err) {
    console.error('Error al actualizar favorito:', err);
  }
}

// CLIENTE: VISTA DE MI CUENTA
function renderClientView() {
  if (!state.currentUser) return;

  document.getElementById('client-view-name').textContent = state.currentUser.name;
  document.getElementById('client-view-email').textContent = state.currentUser.email;
  document.getElementById('client-view-initial').textContent = state.currentUser.name.charAt(0).toUpperCase();

  // Favoritos
  const favGrid = document.getElementById('client-favorites-grid');
  const favItems = (state.currentUser.favorites || []).map(id => state.components.find(c => c.id === id)).filter(Boolean);

  if (favItems.length === 0) {
    favGrid.innerHTML = `
      <div class="col-span-full py-8 text-center glass-panel rounded-2xl border border-slate-800">
        <i data-lucide="heart" class="w-8 h-8 text-slate-600 mx-auto mb-2"></i>
        <p class="text-xs text-slate-400">Aún no has guardado componentes en seguimiento.</p>
        <button onclick="switchTab('catalog')" class="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-xs font-bold text-white">Explorar Catálogo</button>
      </div>
    `;
  } else {
    favGrid.innerHTML = favItems.map(item => `
      <div class="glass-card rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div class="flex items-center space-x-3 overflow-hidden cursor-pointer" onclick="openProductModal('${item.id}')">
          <img src="${item.image}" class="w-12 h-12 rounded-xl object-cover border border-slate-700">
          <div class="truncate">
            <span class="text-[10px] uppercase font-bold text-slate-400">${item.category_name}</span>
            <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
            <span class="text-xs font-black text-emerald-400">$${item.lowest_price.toFixed(2)} en ${item.best_store}</span>
          </div>
        </div>
        <button onclick="toggleFavorite('${item.id}')" class="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl" title="Quitar">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');
  }

  // Ensambles guardados
  const buildsContainer = document.getElementById('client-builds-list');
  const builds = state.currentUser.saved_builds || [];

  if (builds.length === 0) {
    buildsContainer.innerHTML = `
      <div class="col-span-full py-8 text-center glass-panel rounded-2xl border border-slate-800">
        <i data-lucide="bookmark" class="w-8 h-8 text-slate-600 mx-auto mb-2"></i>
        <p class="text-xs text-slate-400">No tienes ensambles de PC guardados.</p>
        <button onclick="switchTab('builder')" class="mt-3 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white">Ir al Armador</button>
      </div>
    `;
  } else {
    buildsContainer.innerHTML = builds.map(b => `
      <div class="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col justify-between space-y-3">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="text-sm font-bold text-white">${b.name}</h4>
            <span class="text-xs text-slate-500">${(b.components || []).length} componentes en este ensamble</span>
          </div>
          <button onclick="deleteUserBuild('${b.id}')" class="text-slate-500 hover:text-rose-400 p-1">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="flex items-center space-x-2 pt-2 border-t border-slate-800">
          <button onclick="loadBuildIntoBuilder('${b.id}')" class="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5">
            <i data-lucide="wrench" class="w-3.5 h-3.5"></i>
            <span>Cargar en el Armador</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  lucide.createIcons();
}

async function saveCurrentBuildPrompt() {
  if (!state.currentUser) {
    showToast('Inicia sesión como cliente para guardar tu ensamble', 'info');
    openAuthModal();
    return;
  }

  const selectedIds = Object.values(state.builderSlots).filter(Boolean);
  if (selectedIds.length === 0) {
    showToast('El armador está vacío. Agrega piezas primero.', 'warning');
    return;
  }

  const name = prompt('Nombre para tu ensamble:', 'Mi Ensamble Personalizado');
  if (!name) return;

  try {
    const res = await fetch('/api/user/builds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: state.currentUser.id,
        name: name,
        components: selectedIds
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      state.currentUser.saved_builds = data.saved_builds;
      localStorage.setItem('hp_user', JSON.stringify(state.currentUser));
      showToast('¡Ensamble guardado en tu cuenta!', 'success');
    }
  } catch (err) {
    console.error('Error guardando ensamble:', err);
  }
}

function loadBuildIntoBuilder(buildId) {
  const build = (state.currentUser.saved_builds || []).find(b => b.id === buildId);
  if (!build) return;

  clearBuilder();
  build.components.forEach(cid => {
    const item = state.components.find(c => c.id === cid);
    if (item && state.builderSlots.hasOwnProperty(item.category)) {
      state.builderSlots[item.category] = cid;
    }
  });

  switchTab('builder');
  showToast(`Ensamble "${build.name}" cargado en el Armador`, 'success');
}

async function deleteUserBuild(buildId) {
  try {
    const res = await fetch(`/api/user/builds/${buildId}?user_id=${state.currentUser.id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.status === 'success') {
      state.currentUser.saved_builds = data.saved_builds;
      localStorage.setItem('hp_user', JSON.stringify(state.currentUser));
      renderClientView();
      showToast('Ensamble eliminado', 'info');
    }
  } catch (err) {
    console.error('Error eliminando ensamble:', err);
  }
}

// ADMINISTRADOR: PANEL CRUD
function renderAdminView() {
  const tbody = document.getElementById('admin-components-table-body');
  if (!tbody) return;

  tbody.innerHTML = state.components.map(item => `
    <tr class="border-b border-slate-800/60 hover:bg-slate-900/40">
      <td class="p-3">
        <div class="flex items-center space-x-3">
          <img src="${item.image}" class="w-10 h-10 rounded-lg object-cover border border-slate-700">
          <div>
            <span class="font-bold text-white block">${item.name}</span>
            <span class="text-[10px] text-slate-500">ID: ${item.id}</span>
          </div>
        </div>
      </td>
      <td class="p-3 text-slate-400 capitalize">${item.category_name}</td>
      <td class="p-3 text-slate-400 font-semibold">${item.brand}</td>
      <td class="p-3 text-emerald-400 font-black text-sm">$${item.lowest_price.toFixed(2)}</td>
      <td class="p-3 text-slate-300">${item.best_store}</td>
      <td class="p-3 text-right space-x-2">
        <button onclick="openAdminEditModal('${item.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition">
          Editar
        </button>
        <button onclick="handleAdminDelete('${item.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white transition">
          Eliminar
        </button>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

function openAdminCreateModal() {
  document.getElementById('admin-modal-title').innerHTML = `
    <i data-lucide="plus-circle" class="w-5 h-5 text-amber-400"></i>
    <span>Nuevo Componente</span>
  `;
  document.getElementById('admin-comp-id').value = '';
  document.getElementById('admin-comp-name').value = '';
  document.getElementById('admin-comp-brand').value = '';
  document.getElementById('admin-comp-image').value = '';
  document.getElementById('admin-comp-badge').value = '';
  document.getElementById('admin-price-amazon').value = '';
  document.getElementById('admin-price-cyberpuerta').value = '';
  document.getElementById('admin-price-pccomponentes').value = '';
  document.getElementById('admin-price-newegg').value = '';

  document.getElementById('admin-modal').classList.remove('hidden');
  lucide.createIcons();
}

function openAdminEditModal(id) {
  const item = state.components.find(c => c.id === id);
  if (!item) return;

  document.getElementById('admin-modal-title').innerHTML = `
    <i data-lucide="edit" class="w-5 h-5 text-amber-400"></i>
    <span>Editar: ${item.name}</span>
  `;
  document.getElementById('admin-comp-id').value = item.id;
  document.getElementById('admin-comp-name').value = item.name;
  document.getElementById('admin-comp-category').value = item.category;
  document.getElementById('admin-comp-brand').value = item.brand;
  document.getElementById('admin-comp-image').value = item.image;
  document.getElementById('admin-comp-badge').value = item.badge || '';

  const getPrice = (stName) => item.stores?.find(s => s.name === stName)?.price || 0;
  document.getElementById('admin-price-amazon').value = getPrice('Amazon');
  document.getElementById('admin-price-cyberpuerta').value = getPrice('CyberPuerta');
  document.getElementById('admin-price-pccomponentes').value = getPrice('PCComponentes');
  document.getElementById('admin-price-newegg').value = getPrice('Newegg');

  document.getElementById('admin-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeAdminModal() {
  document.getElementById('admin-modal').classList.add('hidden');
}

async function handleAdminComponentSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('admin-comp-id').value;
  const name = document.getElementById('admin-comp-name').value;
  const category = document.getElementById('admin-comp-category').value;
  const brand = document.getElementById('admin-comp-brand').value;
  const image = document.getElementById('admin-comp-image').value || 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=400';
  const badge = document.getElementById('admin-comp-badge').value;

  const stores = [
    { name: 'Amazon', price: parseFloat(document.getElementById('admin-price-amazon').value) || 0, stock: true, shipping: 'Envío Gratis', url: 'https://amazon.com' },
    { name: 'CyberPuerta', price: parseFloat(document.getElementById('admin-price-cyberpuerta').value) || 0, stock: true, shipping: '$5.00', url: 'https://cyberpuerta.mx' },
    { name: 'PCComponentes', price: parseFloat(document.getElementById('admin-price-pccomponentes').value) || 0, stock: true, shipping: 'Envío Gratis', url: 'https://pccomponentes.com' },
    { name: 'Newegg', price: parseFloat(document.getElementById('admin-price-newegg').value) || 0, stock: true, shipping: '$4.50', url: 'https://newegg.com' }
  ];

  const catNames = {
    cpu: 'Procesador', gpu: 'Tarjeta Gráfica', ram: 'Memoria RAM',
    motherboard: 'Placa Madre', storage: 'Almacenamiento', psu: 'Fuente de Poder',
    case: 'Gabinete', cooler: 'Refrigeración'
  };

  const payload = {
    name,
    category,
    category_name: catNames[category] || category,
    brand,
    image,
    badge: badge || null,
    rating: 4.8,
    reviews_count: 50,
    specs: { "Fabricante": brand, "Categoría": catNames[category] || category },
    stores,
    price_history: [
      { date: 'Sep 2026', price: stores[0].price * 1.05 },
      { date: 'Oct 2026', price: stores[0].price }
    ]
  };

  try {
    if (id) {
      // Update (PUT)
      await fetch(`/api/admin/components/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Componente actualizado con éxito', 'success');
    } else {
      // Create (POST)
      payload.id = `${category}-${Date.now().toString().slice(-4)}`;
      await fetch('/api/admin/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Componente creado con éxito', 'success');
    }

    closeAdminModal();
    await fetchComponents();
    await fetchCategories();
  } catch (err) {
    console.error('Error guardando componente:', err);
    showToast('Error al guardar componente', 'warning');
  }
}

async function handleAdminDelete(id) {
  if (!confirm(`¿Estás seguro de eliminar el componente ${id}?`)) return;

  try {
    const res = await fetch(`/api/admin/components/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Componente eliminado del catálogo', 'info');
      await fetchComponents();
      await fetchCategories();
    }
  } catch (err) {
    console.error('Error eliminando:', err);
  }
}

// FILTRADO Y BÚSQUEDA
function setCategory(cat) {
  state.activeCategory = cat;
  renderCategoriesFilter();
  fetchBrands();
  fetchComponents();
}

function setBrand(brand) {
  state.activeBrand = brand;
  fetchComponents();
}

function handlePriceRangeChange(val) {
  state.maxPrice = parseFloat(val);
  const label = document.getElementById('price-range-label');
  if (label) label.textContent = `$${val}`;
  fetchComponents();
}

let searchTimeout = null;
function handleSearchInput(val) {
  clearTimeout(searchTimeout);
  state.searchQuery = val.trim();
  
  const clearBtn = document.getElementById('btn-clear-search');
  if (clearBtn) {
    if (state.searchQuery) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  searchTimeout = setTimeout(() => {
    fetchComponents();
  }, 250);
}

function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) input.value = '';
  state.searchQuery = '';
  document.getElementById('btn-clear-search')?.classList.add('hidden');
  fetchComponents();
}

function handleSortChange(sortVal) {
  state.sortBy = sortVal;
  fetchComponents();
}

function resetFilters() {
  state.activeCategory = 'all';
  state.activeBrand = 'all';
  state.searchQuery = '';
  state.maxPrice = 1200;
  state.sortBy = 'savings_desc';

  const sInput = document.getElementById('search-input');
  if (sInput) sInput.value = '';
  const pInput = document.getElementById('price-range');
  if (pInput) pInput.value = 1200;
  const pLabel = document.getElementById('price-range-label');
  if (pLabel) pLabel.textContent = '$1,200';
  const sortSel = document.getElementById('sort-select');
  if (sortSel) sortSel.value = 'savings_desc';
  document.getElementById('btn-clear-search')?.classList.add('hidden');

  renderCategoriesFilter();
  fetchBrands();
  fetchComponents();
  showToast('Filtros restablecidos', 'info');
}

// MODAL DE DETALLE Y GRÁFICO
async function openProductModal(componentId) {
  try {
    const res = await fetch(`/api/components/${componentId}`);
    if (!res.ok) return;
    const item = await res.json();

    document.getElementById('modal-img').src = item.image;
    document.getElementById('modal-title').textContent = item.name;
    document.getElementById('modal-brand').textContent = item.brand;
    document.getElementById('modal-category').textContent = item.category_name;
    document.getElementById('modal-rating').textContent = item.rating;
    document.getElementById('modal-reviews').textContent = `(${item.reviews_count?.toLocaleString() || 50} opiniones)`;

    // Lista de tiendas
    const storesList = document.getElementById('modal-stores-list');
    storesList.innerHTML = (item.stores || []).map(s => {
      const isBest = s.price === item.lowest_price;
      return `
        <div class="glass-card rounded-xl p-3.5 flex items-center justify-between border ${isBest ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800'}">
          <div class="flex items-center space-x-3">
            <span class="text-sm font-bold text-white">${s.name}</span>
            <span class="text-xs px-2 py-0.5 rounded-full ${s.stock ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
              ${s.stock ? 'En Stock' : 'Agotado'}
            </span>
            <span class="text-xs text-slate-500">${s.shipping}</span>
          </div>

          <div class="flex items-center space-x-4">
            <div class="text-right">
              <span class="text-lg font-black ${isBest ? 'text-emerald-400' : 'text-white'}">$${s.price.toFixed(2)}</span>
              ${isBest ? `<span class="block text-[10px] text-emerald-400 font-bold">¡Mejor Precio!</span>` : ''}
            </div>
            <a 
              href="${s.url}" 
              target="_blank" 
              class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                s.stock 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' 
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed pointer-events-none'
              }"
            >
              <span>Ir a la tienda</span>
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Especificaciones
    const specsTable = document.getElementById('modal-specs-table');
    specsTable.innerHTML = Object.entries(item.specs || {}).map(([key, val]) => `
      <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between">
        <span class="text-slate-400">${key}:</span>
        <span class="font-bold text-slate-200">${val}</span>
      </div>
    `).join('');

    renderPriceHistoryChart(item.price_history || []);

    document.getElementById('product-modal').classList.remove('hidden');
    lucide.createIcons();
  } catch (err) {
    console.error('Error abriendo modal:', err);
  }
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
  if (state.priceChartInstance) {
    state.priceChartInstance.destroy();
    state.priceChartInstance = null;
  }
}

function renderPriceHistoryChart(historyData) {
  const canvas = document.getElementById('price-history-chart');
  if (!canvas) return;

  if (state.priceChartInstance) {
    state.priceChartInstance.destroy();
  }

  const labels = historyData.map(h => h.date);
  const prices = historyData.map(h => h.price);

  const ctx = canvas.getContext('2d');
  state.priceChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Precio ($ USD)',
        data: prices,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: '#818cf8',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', callback: v => `$${v}` } }
      }
    }
  });
}

// COMPARADOR
function toggleCompare(id) {
  const index = state.compareList.indexOf(id);
  if (index > -1) {
    state.compareList.splice(index, 1);
    showToast('Removido de la comparativa', 'info');
  } else {
    if (state.compareList.length >= 3) {
      showToast('Puedes comparar hasta un máximo de 3 piezas', 'warning');
      return;
    }
    state.compareList.push(id);
    showToast('Añadido a la comparativa', 'success');
  }

  updateCompareBadge();
  renderProducts();
  if (state.activeTab === 'compare') renderCompareView();
}

function updateCompareBadge() {
  const count = state.compareList.length;
  const badge = document.getElementById('badge-compare-count');
  const dock = document.getElementById('compare-dock');
  const thumbsContainer = document.getElementById('dock-thumbnails');

  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }

  if (dock) {
    if (count > 0 && state.activeTab !== 'compare') {
      dock.classList.remove('hidden');
      if (thumbsContainer) {
        thumbsContainer.innerHTML = state.compareList.map(cid => {
          const item = state.components.find(c => c.id === cid);
          return item ? `<img src="${item.image}" class="w-8 h-8 rounded-full border-2 border-indigo-500 object-cover">` : '';
        }).join('');
      }
    } else {
      dock.classList.add('hidden');
    }
  }
}

function clearCompareList() {
  state.compareList = [];
  updateCompareBadge();
  renderProducts();
  if (state.activeTab === 'compare') renderCompareView();
  showToast('Comparativa vaciada', 'info');
}

async function renderCompareView() {
  const container = document.getElementById('compare-table-wrapper');
  if (!container) return;

  if (state.compareList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 space-y-3">
        <i data-lucide="columns" class="w-12 h-12 text-slate-600 mx-auto"></i>
        <h3 class="text-base font-bold text-white">No hay componentes seleccionados para comparar</h3>
        <p class="text-xs text-slate-400">Selecciona hasta 3 piezas en el catálogo usando el botón <strong>"Comparar"</strong>.</p>
        <button onclick="switchTab('catalog')" class="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl">Ir al Catálogo</button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  try {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: state.compareList })
    });
    const data = await res.json();
    const items = data.components || [];
    const stores = data.stores || [];
    const specKeys = data.spec_keys || [];

    let html = `
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="border-b border-slate-800">
            <th class="p-4 w-48 text-slate-400 font-semibold uppercase">Característica</th>
            ${items.map(item => `
              <th class="p-4 min-w-[240px] text-white">
                <div class="flex items-start justify-between">
                  <div class="space-y-1">
                    <span class="text-[10px] font-bold text-indigo-400 uppercase">${item.category_name}</span>
                    <h4 class="text-sm font-bold text-white">${item.name}</h4>
                  </div>
                  <button onclick="toggleCompare('${item.id}')" class="text-slate-500 hover:text-rose-400 p-1">
                    <i data-lucide="x" class="w-4 h-4"></i>
                  </button>
                </div>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-slate-800/60 bg-slate-900/30">
            <td class="p-4 text-slate-400 font-medium">Imagen</td>
            ${items.map(item => `<td class="p-4"><img src="${item.image}" class="w-32 h-24 object-cover rounded-xl border border-slate-700"></td>`).join('')}
          </tr>
          <tr class="border-b border-slate-800 bg-emerald-500/5">
            <td class="p-4 text-emerald-400 font-bold">Mejor Precio</td>
            ${items.map(item => `
              <td class="p-4">
                <span class="text-xl font-black text-emerald-400">$${item.lowest_price.toFixed(2)}</span>
                <span class="block text-[11px] text-slate-400">en ${item.best_store}</span>
              </td>
            `).join('')}
          </tr>
          ${stores.map(st => `
            <tr class="border-b border-slate-800/40">
              <td class="p-4 text-slate-400">${st}</td>
              ${items.map(item => {
                const offer = (item.stores || []).find(s => s.name === st);
                if (!offer) return `<td class="p-4 text-slate-600">No disponible</td>`;
                const isBest = offer.price === item.lowest_price;
                return `
                  <td class="p-4">
                    <span class="font-bold ${isBest ? 'text-emerald-400' : 'text-slate-200'}">$${offer.price.toFixed(2)}</span>
                    <span class="text-[10px] block ${offer.stock ? 'text-slate-500' : 'text-rose-400'}">${offer.stock ? offer.shipping : 'Agotado'}</span>
                  </td>
                `;
              }).join('')}
            </tr>
          `).join('')}
          <tr class="bg-indigo-950/20">
            <td colspan="${items.length + 1}" class="p-3 font-bold text-indigo-300 uppercase tracking-wider text-[11px]">Ficha Técnica Comparativa</td>
          </tr>
          ${specKeys.map(specKey => `
            <tr class="border-b border-slate-800/40 hover:bg-slate-900/40">
              <td class="p-4 text-slate-400 font-medium">${specKey}</td>
              ${items.map(item => `<td class="p-4 text-slate-200">${(item.specs && item.specs[specKey]) || '—'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = html;
    lucide.createIcons();
  } catch (err) {
    console.error('Error renderizando comparativa:', err);
  }
}

// ARMADOR DE PC
function renderBuilderSlots() {
  const container = document.getElementById('builder-slots-container');
  if (!container) return;

  container.innerHTML = SLOT_DEFINITIONS.map(slot => {
    const componentId = state.builderSlots[slot.key];
    const component = componentId ? state.components.find(c => c.id === componentId) : null;

    if (component) {
      return `
        <div class="glass-card rounded-2xl p-4 border border-emerald-500/30 flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <img src="${component.image}" class="w-14 h-14 object-cover rounded-xl border border-slate-700">
            <div>
              <span class="text-[10px] uppercase font-bold text-emerald-400">${slot.name}</span>
              <h4 class="text-sm font-bold text-white">${component.name}</h4>
              <span class="text-xs text-slate-400">Mejor oferta: <strong class="text-white">$${component.lowest_price.toFixed(2)}</strong> en ${component.best_store}</span>
            </div>
          </div>
          <button onclick="removeSlot('${slot.key}')" class="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    }

    return `
      <div class="glass-panel rounded-2xl p-4 border border-dashed border-slate-800 flex items-center justify-between">
        <div class="flex items-center space-x-3 text-slate-400">
          <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <i data-lucide="${slot.icon}" class="w-5 h-5 text-slate-500"></i>
          </div>
          <div>
            <span class="text-xs font-bold text-slate-300">${slot.name}</span>
            <p class="text-[11px] text-slate-500">Ninguna pieza seleccionada</p>
          </div>
        </div>
        <button onclick="selectCategoryForBuilder('${slot.key}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 transition flex items-center space-x-1">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>Elegir</span>
        </button>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function addToBuilder(componentId) {
  const item = state.components.find(c => c.id === componentId);
  if (!item) return;

  const category = item.category;
  if (state.builderSlots.hasOwnProperty(category)) {
    state.builderSlots[category] = componentId;
    updateBuilderBadge();
    showToast(`${item.name} asignado al Armador`, 'success');
    if (state.activeTab === 'builder') renderBuilderView();
  }
}

function removeSlot(slotKey) {
  state.builderSlots[slotKey] = null;
  updateBuilderBadge();
  renderBuilderView();
  showToast('Pieza removida del armador', 'info');
}

function clearBuilder() {
  Object.keys(state.builderSlots).forEach(k => state.builderSlots[k] = null);
  updateBuilderBadge();
  renderBuilderView();
  showToast('Armador reiniciado', 'info');
}

function updateBuilderBadge() {
  const count = Object.values(state.builderSlots).filter(Boolean).length;
  const badge = document.getElementById('badge-builder-count');
  const countBadge = document.getElementById('builder-items-badge');

  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
  if (countBadge) countBadge.textContent = `${count} piezas`;
}

function selectCategoryForBuilder(categoryKey) {
  switchTab('catalog');
  setCategory(categoryKey);
  showToast(`Filtrando catálogo por ${categoryKey.toUpperCase()}`, 'info');
}

async function renderBuilderView() {
  renderBuilderSlots();
  updateBuilderBadge();

  const selectedIds = Object.values(state.builderSlots).filter(Boolean);
  const storesBreakdownContainer = document.getElementById('builder-stores-breakdown');
  const singleStoreContainer = document.getElementById('builder-single-store-list');
  const totalOptimizedEl = document.getElementById('builder-optimized-total');
  const baselineTotalEl = document.getElementById('builder-baseline-total');
  const savingsAmountEl = document.getElementById('builder-savings-amount');

  if (selectedIds.length === 0) {
    totalOptimizedEl.textContent = '$0.00';
    baselineTotalEl.textContent = '$0.00';
    savingsAmountEl.textContent = '-$0.00 (0%)';
    storesBreakdownContainer.innerHTML = '<p class="text-slate-500 italic">Agrega componentes a tu ensamble para calcular la mejor combinación de tiendas.</p>';
    singleStoreContainer.innerHTML = '<p class="text-slate-500 italic">Sin datos suficientes.</p>';
    return;
  }

  try {
    const res = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds })
    });
    const data = await res.json();

    totalOptimizedEl.textContent = `$${data.optimized_total.toFixed(2)}`;
    baselineTotalEl.textContent = `$${data.baseline_single_store_total.toFixed(2)}`;
    savingsAmountEl.textContent = `-$${data.potential_savings.toFixed(2)} (${data.potential_savings_percent}%)`;

    storesBreakdownContainer.innerHTML = (data.stores_summary || []).map(group => `
      <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
        <div class="flex justify-between items-center">
          <span class="font-bold text-white">${group.store}</span>
          <span class="text-emerald-400 font-black">$${group.subtotal.toFixed(2)}</span>
        </div>
        <p class="text-[11px] text-slate-400">${group.item_count} artículo(s): ${group.items.join(', ')}</p>
      </div>
    `).join('');

    singleStoreContainer.innerHTML = Object.values(data.single_store_comparisons || {}).map(storeInfo => {
      const diff = storeInfo.total - data.optimized_total;
      return `
        <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 border border-slate-800/80">
          <div class="space-y-0.5">
            <span class="font-semibold text-slate-300">${storeInfo.store}</span>
            <span class="text-[10px] text-slate-500 block">
              ${storeInfo.is_complete ? 'Todas las piezas en stock' : `Faltan ${storeInfo.missing_items.length} pieza(s)`}
            </span>
          </div>
          <div class="text-right">
            <span class="font-bold text-white">$${storeInfo.total.toFixed(2)}</span>
            ${diff > 0 ? `<span class="block text-[10px] text-rose-400">+$${diff.toFixed(2)} más caro</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Error optimizando ensamble:', err);
  }
}

// TOAST
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    info: 'bg-slate-900 border-indigo-500/40 text-slate-200',
    success: 'bg-slate-900 border-emerald-500/40 text-emerald-200',
    warning: 'bg-slate-900 border-amber-500/40 text-amber-200'
  };

  toast.className = `px-4 py-2.5 rounded-xl border shadow-xl text-xs font-medium flex items-center space-x-2 animate-fade-in ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}
