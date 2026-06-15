
// ── ⚙️  CONFIGURAÇÃO DA API ──────────────────────────────────
const API_KEY = null;
const API_BASE = 'http://localhost:3000/api';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const USE_MOCK = false;
// Mapa de gêneros TMDB → Português
const GENRE_MAP = {
  28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia',
  80: 'Crime', 99: 'Documentário', 18: 'Drama', 10751: 'Família',
  14: 'Fantasia', 36: 'História', 27: 'Terror', 10402: 'Música',
  9648: 'Mistério', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Suspense', 10752: 'Guerra', 37: 'Faroeste',
};

// ── 💾  ESTADO (persistido no localStorage) ──────────────────
const STATE_KEY = 'cinefocus_state';

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  // Estado inicial: lista "Para Assistir" com exemplos
  return {
    towatch:   [
      { id: 1001, title: 'Interstellar',  year: 2014, genres: ['Sci-Fi', 'Aventura'], poster: null, rating: 8.6 },
      { id: 1002, title: 'Parasita',      year: 2019, genres: ['Thriller', 'Drama'],  poster: null, rating: 8.5 },
      { id: 1003, title: 'Duna',          year: 2021, genres: ['Sci-Fi', 'Aventura'], poster: null, rating: 8.0 },
    ],
    watched:   [],
    favorites: [],
    disliked:  [],
  };
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

let state = loadState();

// ── 🎨  REFERÊNCIAS DOM ──────────────────────────────────────
// Captura as referências principais do DOM usadas para interações e atualizações.
const searchInput   = document.getElementById('search-input');
const searchBtn     = document.getElementById('search-btn');
const moviesGrid    = document.getElementById('movies-grid');
const skeletonGrid  = document.getElementById('skeleton-grid');
const emptyState    = document.getElementById('empty-state');
const emptyTitle    = document.getElementById('empty-title');
const emptyMsg      = document.getElementById('empty-msg');
const statusBar     = document.getElementById('status-bar');
const heroSection   = document.getElementById('hero-section');
const viewHeader    = document.getElementById('view-header');
const viewTitle     = document.getElementById('view-title');
const viewCount     = document.getElementById('view-count');
const backBtn       = document.getElementById('back-to-explore');
const sidebarList   = document.getElementById('sidebar-list');
const sidebarCount  = document.getElementById('sidebar-count');
const sidebarEmpty  = document.getElementById('sidebar-empty');
const clearTowatch  = document.getElementById('clear-towatch');
const bookmarkCount = document.getElementById('bookmark-count');
const dropdown      = document.getElementById('action-dropdown');
const toast         = document.getElementById('toast');
const navLinks      = document.querySelectorAll('.nav-link, #nav-bookmark');
const tags          = document.querySelectorAll('.tag');

// ── 🌐  CURRENT VIEW ─────────────────────────────────────────
// Guarda qual aba está ativa, qual filme está em foco e o último resultado de busca.
let currentView       = 'explore';  // explore | towatch | watched | favorites | disliked
let currentMovieCtx   = null;       // filme atualmente selecionado para o dropdown
let lastSearchResults = [];         // últimos resultados da busca

// ── 🔍  API / BUSCA ──────────────────────────────────────────

/**
 * Busca filmes na API TMDB.
 * Se USE_MOCK = true, filtra nos dados simulados.
 * @param {string} query
 * @returns {Promise<Array>} array de filmes normalizados
 */
async function searchMovies(query) {
  if (USE_MOCK) {
    // Simula latência de rede
    await new Promise(r => setTimeout(r, 600));
    const q = query.toLowerCase();
    const results = MOCK_MOVIES.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.genres.some(g => g.toLowerCase().includes(q))
    );
    return results.length > 0 ? results : MOCK_MOVIES;
  }

  // ── Chamada real à API TMDB ──────────────────────────────
  // Documentação: https://developer.themoviedb.org/reference/search-movie
  const url = `${API_BASE}/search?q=${encodeURIComponent(query)}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
  const data = await res.json();
  return data.results.map(normalizeMovie);
}

/**
 * Busca filmes populares do TMDB para preencher a aba Explorar.
 * Em modo demo, retorna o conjunto de filmes simulados.
 * @returns {Promise<Array>}
 */
async function fetchPopular() {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 500));
    return MOCK_MOVIES;
  }
  const url = `${API_BASE}/popular`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
  const data = await res.json();
  return data.results.slice(0, 18).map(normalizeMovie);
}

/**
 * Converte o formato da API TMDB para o formato interno do app.
 * @param {Object} m - objeto retornado pela API
 * @returns {Object} filme normalizado
 */
function normalizeMovie(m) {
  return {
    id:     m.id,
    title:  m.title,
    year:   m.release_date ? parseInt(m.release_date) : '—',
    genres: (m.genre_ids || []).map(id => GENRE_MAP[id] || '').filter(Boolean).slice(0, 3),
    poster: m.poster_path ? `${IMG_BASE}${m.poster_path}` : null,
    rating: m.vote_average ? parseFloat(m.vote_average.toFixed(1)) : null,
  };
}

// ── 🖼️  RENDERIZAÇÃO ─────────────────────────────────────────

/**
 * Renderiza um array de filmes na grade principal.
 * @param {Array}  movies   - array de filmes
 * @param {string} context  - 'explore'|'towatch'|'watched'|'favorites'|'disliked'
 */
function renderGrid(movies, context = 'explore') {
  moviesGrid.innerHTML = '';

  if (!movies.length) {
    showEmpty();
    return;
  }

  hideEmpty();
  movies.forEach((movie, i) => {
    const card = createMovieCard(movie, context);
    card.style.animationDelay = `${i * 0.04}s`;
    moviesGrid.appendChild(card);
  });
}

/**
 * Cria o elemento DOM representando um filme.
 * Adiciona pôster, rating, ribbon de status e ações contextuais.
 */
function createMovieCard(movie, context) {
  const card  = document.createElement('div');
  card.className = 'movie-card';
  card.dataset.id = movie.id;

  // Determina ribbon
  const ribbonHTML = getRibbonHTML(movie.id);

  // Pôster
  const posterHTML = movie.poster
    ? `<img class="card-poster" src="${movie.poster}" alt="${escHtml(movie.title)}" loading="lazy" />`
    : `<div class="card-poster-placeholder">🎬<span>Sem Pôster</span></div>`;

  // Rating
  const ratingHTML = movie.rating
    ? `<div class="card-rating">★ ${movie.rating}</div>`
    : '';

  // Gêneros
  const genreStr  = movie.genres?.join(', ') || 'Gênero desconhecido';
  const year      = movie.year || '—';

  // Botão de ação contextual
  const actionHTML = buildContextActions(movie, context);

  card.innerHTML = `
    <div class="card-poster-wrap">
      ${ribbonHTML}
      ${posterHTML}
      ${ratingHTML}
      <div class="card-overlay">
        <div class="overlay-actions">
          ${actionHTML}
        </div>
      </div>
    </div>
    <div class="card-info">
      <div class="card-title" title="${escHtml(movie.title)}">${escHtml(movie.title)}</div>
      <div class="card-meta">${year}<span class="dot">•</span>${genreStr}</div>
    </div>
  `;

  // Event: botão principal (abre dropdown)
  const addBtn = card.querySelector('.btn-add-list');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown(movie, addBtn);
    });
  }

  // Event: botão remover (em listas)
  const removeBtn = card.querySelector('.btn-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const listKey = removeBtn.dataset.list;
      removeFromList(movie.id, listKey);
      card.style.animation = 'none';
      card.style.opacity   = '0';
      card.style.transform = 'scale(0.9)';
      card.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => renderCurrentView(), 220);
    });
  }

  return card;
}

/**
 * Retorna o HTML do ribbon de status para um filme.
 */
function getRibbonHTML(id) {
  if (isInList(id, 'favorites')) return '<div class="card-ribbon favorite">Favorito</div>';
  if (isInList(id, 'watched'))   return '<div class="card-ribbon watched">Assistido</div>';
  if (isInList(id, 'disliked'))  return '<div class="card-ribbon disliked">Não Gostei</div>';
  if (isInList(id, 'towatch'))   return '<div class="card-ribbon">Para Assistir</div>';
  return '';
}

/**
 * Gera o HTML dos botões de ação exibidos no hover do cartão.
 * O conjunto de ações varia conforme a aba atual.
 */
function buildContextActions(movie, context) {
  if (context === 'towatch') return `
    <button class="btn-add-list" title="Adicionar à lista">
      <svg viewBox="0 0 20 20" fill="none" width="13" height="13"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M7 10l2.5 2.5L13 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Marcar como Assistido
    </button>
    <button class="btn-remove" data-list="towatch">✕ Remover</button>
  `;
  if (context === 'watched') return `
    <button class="btn-add-list" title="Adicionar à lista">
      <svg viewBox="0 0 20 20" fill="none" width="13" height="13"><path d="M10 16.5s-7-4.5-7-9a4 4 0 018 0 4 4 0 018 0c0 4.5-7 9-7 9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      Adicionar a Favoritos
    </button>
    <button class="btn-remove" data-list="watched">✕ Remover</button>
  `;
  if (context === 'favorites') return `
    <button class="btn-remove" data-list="favorites">✕ Remover dos Favoritos</button>
  `;
  if (context === 'disliked') return `
    <button class="btn-remove" data-list="disliked">✕ Remover</button>
  `;

  // Explorar: botão padrão "Adicionar à Lista" → abre dropdown
  return `
    <button class="btn-add-list">
      <svg viewBox="0 0 20 20" fill="none" width="13" height="13"><path d="M10 5v10M5 10h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Adicionar à Lista
    </button>
  `;
}

// ── 📋  SIDEBAR "PARA ASSISTIR" ───────────────────────────────

/**
 * Renderiza a barra lateral com a lista "Para Assistir".
 * Também atualiza contadores e estatísticas rápidas.
 */
function renderSidebar() {
  const list = state.towatch;
  sidebarList.innerHTML = '';

  const count = list.length;
  sidebarCount.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
  bookmarkCount.textContent = state.favorites.length;

  // Atualiza stats
  document.getElementById('stat-watched').textContent   = state.watched.length;
  document.getElementById('stat-favorites').textContent = state.favorites.length;
  document.getElementById('stat-disliked').textContent  = state.disliked.length;

  if (count === 0) {
    sidebarEmpty.style.display = 'block';
  } else {
    sidebarEmpty.style.display = 'none';
    list.forEach(movie => {
      const li = document.createElement('li');
      li.className = 'sidebar-item';
      li.innerHTML = `
        ${movie.poster
          ? `<img class="sidebar-item-thumb" src="${movie.poster}" alt="${escHtml(movie.title)}" />`
          : `<div class="sidebar-item-thumb-placeholder">🎬</div>`
        }
        <div class="sidebar-item-text">
          <div class="sidebar-item-title" title="${escHtml(movie.title)}">${escHtml(movie.title)}</div>
          <div class="sidebar-item-year">${movie.year || '—'}</div>
        </div>
        <button class="sidebar-remove-btn" data-id="${movie.id}" title="Remover">
          <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      `;

      li.querySelector('.sidebar-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromList(movie.id, 'towatch');
        // Animate out
        li.style.transition = 'opacity 0.2s, transform 0.2s';
        li.style.opacity    = '0';
        li.style.transform  = 'translateX(10px)';
        setTimeout(() => renderSidebar(), 210);
      });

      sidebarList.appendChild(li);
    });
  }
}

// ── 🗃️  GERENCIAMENTO DE LISTAS ──────────────────────────────

function isInList(id, listKey) {
  return state[listKey].some(m => m.id === id);
}

/**
 * Adiciona um filme a uma das listas do app.
 * Persiste o estado, atualiza a sidebar e mostra feedback.
 */
function addToList(movie, listKey) {
  if (isInList(movie.id, listKey)) {
    showToast(`"${movie.title}" já está nessa lista.`, 'info');
    return;
  }
  state[listKey].push(movie);
  saveState();

  sidebarCount.classList.add('pop');
  bookmarkCount.classList.add('pop');
  setTimeout(() => { sidebarCount.classList.remove('pop'); bookmarkCount.classList.remove('pop'); }, 300);

  renderSidebar();
  refreshGridRibbons();

  const listNames = { towatch: 'Para Assistir', watched: 'Assistidos', favorites: 'Favoritos', disliked: 'Não Gostei' };
  showToast(`"${movie.title}" adicionado a ${listNames[listKey]}!`, 'success');
}

function removeFromList(movieId, listKey) {
  state[listKey] = state[listKey].filter(m => m.id !== movieId);
  saveState();
  renderSidebar();
  refreshGridRibbons();
}

/**
 * Atualiza os ribbons dos cartões na grade sem re-renderizar tudo.
 */
function refreshGridRibbons() {
  document.querySelectorAll('.movie-card').forEach(card => {
    const id = parseInt(card.dataset.id);
    const wrap = card.querySelector('.card-poster-wrap');
    const existing = wrap.querySelector('.card-ribbon');
    if (existing) existing.remove();
    const newRibbon = getRibbonHTML(id);
    if (newRibbon) wrap.insertAdjacentHTML('afterbegin', newRibbon);
  });
}

// ── 🎛️  ACTION DROPDOWN ──────────────────────────────────────

/**
 * Exibe o dropdown de ações para o filme selecionado.
 * Posiciona o dropdown ao redor do botão clicado.
 */
function openDropdown(movie, anchorEl) {
  currentMovieCtx = movie;
  dropdown.style.display = 'block';

  // Posiciona o dropdown acima do botão
  const rect = anchorEl.getBoundingClientRect();
  const dw   = dropdown.offsetWidth || 210;
  let   left = rect.left + rect.width / 2 - dw / 2;
  let   top  = rect.top - dropdown.offsetHeight - 10;

  // Garante que não saia da tela
  left = Math.max(8, Math.min(left, window.innerWidth - dw - 8));
  if (top < 8) top = rect.bottom + 10; // coloca abaixo se não couber acima

  dropdown.style.left = `${left + window.scrollX}px`;
  dropdown.style.top  = `${top + window.scrollY}px`;

  // Remove animação anterior e re-dispara
  dropdown.style.animation = 'none';
  dropdown.offsetHeight; // reflow
  dropdown.style.animation = '';
}

function closeDropdown() {
  dropdown.style.display = 'none';
  currentMovieCtx = null;
}

// Cliques no dropdown
dropdown.querySelectorAll('[data-action]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentMovieCtx) return;

    const action = btn.dataset.action;
    const movie  = currentMovieCtx;

    if (action === 'watched' && currentView === 'towatch') {
      // Mover de "Para Assistir" para "Assistidos"
      removeFromList(movie.id, 'towatch');
    }

    addToList(movie, action);
    closeDropdown();
  });
});

// Fechar dropdown clicando fora
document.addEventListener('click', (e) => {
  if (!dropdown.contains(e.target) && !e.target.classList.contains('btn-add-list')) {
    closeDropdown();
  }
});

// ── 🧭  NAVEGAÇÃO / VIEWS ────────────────────────────────────

const VIEW_CONFIG = {
  explore:   { title: '',            emptyTitle: 'Nenhum resultado',    emptyMsg: 'Tente buscar outro filme.' },
  towatch:   { title: 'Minha Lista', emptyTitle: 'Lista vazia',         emptyMsg: 'Adicione filmes à sua lista usando o botão "Adicionar à Lista".' },
  watched:   { title: 'Assistidos',  emptyTitle: 'Nenhum assistido',    emptyMsg: 'Marque filmes como assistidos para vê-los aqui.' },
  favorites: { title: 'Favoritos',   emptyTitle: 'Sem favoritos ainda', emptyMsg: 'Adicione filmes à sua lista de Favoritos!' },
  disliked:  { title: 'Não Gostei',  emptyTitle: 'Nenhum por aqui',     emptyMsg: 'Filmes que você não gostou aparecerão aqui.' },
};

function setActiveNav(view) {
  navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.view === view);
  });
}

/**
 * Alterna para a view desejada e renderiza os filmes ou o estado vazio.
 */
function switchView(view) {
  currentView = view;
  setActiveNav(view);
  closeDropdown();

  if (view === 'explore') {
    heroSection.style.display = '';
    viewHeader.style.display  = 'none';
    setStatus('');
    if (lastSearchResults.length) {
      renderGrid(lastSearchResults, 'explore');
    } else {
      showLoadingAndFetch();
    }
    return;
  }

  // Lista views
  heroSection.style.display = 'none';
  viewHeader.style.display  = 'flex';

  const cfg    = VIEW_CONFIG[view];
  const movies = state[view] || [];
  viewTitle.textContent   = cfg.title;
  viewCount.textContent   = `${movies.length} filme${movies.length !== 1 ? 's' : ''}`;
  emptyTitle.textContent  = cfg.emptyTitle;
  emptyMsg.textContent    = cfg.emptyMsg;

  setStatus('');
  renderGrid(movies, view);
}

function renderCurrentView() {
  switchView(currentView);
}

// ── 🔍  BUSCA ─────────────────────────────────────────────────

/**
 * Realiza a busca por filmes e atualiza a interface com os resultados.
 */
async function doSearch(query) {
  if (!query.trim()) return;

  switchView('explore');
  showSkeleton();
  setStatus(`Buscando por "${query}"...`, true);

  try {
    const results     = await searchMovies(query.trim());
    lastSearchResults = results;
    hideSkeleton();

    if (!results.length) {
      setStatus(`Nenhum resultado para "${query}".`);
      showEmpty('Nenhum resultado', `Nenhum filme encontrado para "${query}". Tente outro título.`);
      return;
    }

    setStatus(`${results.length} resultado${results.length !== 1 ? 's' : ''} para "${query}"`);
    renderGrid(results, 'explore');

    if (USE_MOCK) {
      setStatus(`${results.length} resultados (modo demonstração — insira sua API Key TMDB para busca real)`);
    }
  } catch (err) {
    hideSkeleton();
    setStatus('Erro ao buscar filmes. Verifique sua API Key e tente novamente.');
    showToast('Erro na busca. Verifique o console.', 'error');
    console.error('[CineFocus] Erro na API:', err);
  }
}

async function showLoadingAndFetch() {
  showSkeleton();
  setStatus('Carregando filmes populares...');
  try {
    const movies = await fetchPopular();
    lastSearchResults = movies;
    hideSkeleton();
    setStatus(USE_MOCK
      ? 'Filmes em destaque (modo demonstração — insira sua API Key TMDB para dados reais)'
      : `${movies.length} filmes populares`
    );
    renderGrid(movies, 'explore');
  } catch (err) {
    hideSkeleton();
    setStatus('Não foi possível carregar os filmes.');
    console.error('[CineFocus]', err);
  }
}

// ── 🎉  EVENTOS ───────────────────────────────────────────────

// Botão Buscar
searchBtn.addEventListener('click', () => doSearch(searchInput.value));

// Enter no campo
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch(searchInput.value);
});

// Tags de pesquisa rápida
tags.forEach(tag => {
  tag.addEventListener('click', () => {
    searchInput.value = tag.dataset.query;
    doSearch(tag.dataset.query);
  });
});

// Links de navegação
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    if (view) switchView(view);
  });
});

// Voltar ao Explorar
backBtn.addEventListener('click', () => switchView('explore'));

// Limpar lista "Para Assistir"
clearTowatch.addEventListener('click', () => {
  if (!state.towatch.length) {
    showToast('A lista já está vazia!', 'info');
    return;
  }
  if (confirm('Tem certeza que quer limpar toda a lista "Para Assistir"?')) {
    state.towatch = [];
    saveState();
    renderSidebar();
    if (currentView === 'towatch') renderCurrentView();
    showToast('Lista "Para Assistir" limpa!', 'info');
  }
});

// ── 🍞  TOAST ─────────────────────────────────────────────────
let toastTimer = null;

/**
 * Exibe uma notificação temporária de sucesso, erro ou informação.
 */
function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

// ── 🔢  HELPERS ───────────────────────────────────────────────

function setStatus(msg, isSearching = false) {
  statusBar.textContent = msg;
  statusBar.className   = isSearching ? 'status-bar searching' : 'status-bar';
}

function showSkeleton() {
  skeletonGrid.style.display = 'grid';
  moviesGrid.style.display   = 'none';
  emptyState.style.display   = 'none';
}

function hideSkeleton() {
  skeletonGrid.style.display = 'none';
  moviesGrid.style.display   = 'grid';
}

function showEmpty(title, msg) {
  if (title) emptyTitle.textContent = title;
  if (msg)   emptyMsg.textContent   = msg;
  emptyState.style.display = 'flex';
  moviesGrid.style.display = 'none';
}

function hideEmpty() {
  emptyState.style.display = 'none';
  moviesGrid.style.display = 'grid';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 🚀  INICIALIZAÇÃO ─────────────────────────────────────────
(function init() {
  renderSidebar();
  showLoadingAndFetch();

  // Aviso de modo demonstração
 
})();
