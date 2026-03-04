/* FlowWise - app.js */
'use strict';

// ===== STATE =====
let state = {
  income: 0,
  categories: [],
  savedGoals: [],
  darkMode: false,
  user: null,
  isAuthenticated: false,
  idealRatios: { needs: 50, wants: 30, savings: 20 },
  startDate: null,
  history: []
};

const CATEGORY_PALETTE = [
  '#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444',
  '#06b6d4','#ec4899','#f97316','#84cc16','#6366f1',
  '#14b8a6','#a855f7','#e11d48','#0891b2','#65a30d',
];


const AVAILABLE_EMOJIS = [
  '🛒','🏠','⛽','💡','📈','🛍️','🍔','🚗','🏥','✈️',
  '🎓','🐾','🎬','📱','💇','👕','🎁','🎸','🕹️','🍻',
  '🚲','🚆','🚌','📚','⚽','🏋️','💊','🦷','💼','🛠️',
  '🔌','🐶','🐱','🍼','🍷','💳','🛡️','💸','🪴','🎨',
  '🏖️','🎫','🍿','🎙️','💻','📸','🕹️','🧸','🚿','🧴'
];

const DEFAULT_CATEGORIES = [
  { id: 'food',       name: 'Food',        icon: '🛒', type: 'needs',   amount: 0 },
  { id: 'rent',       name: 'Rent',         icon: '🏠', type: 'needs',   amount: 0 },
  { id: 'petrol',     name: 'Petrol',       icon: '⛽', type: 'needs',   amount: 0 },
  { id: 'bills',      name: 'Bills',        icon: '💡', type: 'needs',   amount: 0 },
  { id: 'investment', name: 'Investment',   icon: '📈', type: 'savings', amount: 0 },
  { id: 'shopping',   name: 'Shopping',     icon: '🛍️', type: 'wants',   amount: 0 },
];

// ===== CHART INSTANCES =====
let budgetChart = null;
let idealChart = null;

// ===== INIT =====

function initializeApp() {
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';
  
  // Show user's name in navbar
  if (state.user) {
    const navName = document.getElementById('navUserName');
    if (navName) navName.textContent = '· ' + state.user.name;
  }
  
  renderIdealChart();
  renderCategories();
  bindEvents();
  update();
  setTimeout(initDatesAndClock, 300);
}

document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  if (!state.isAuthenticated) {
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    bindAuthEvents();
  } else {
    initializeApp();
  }
});

function bindAuthEvents() {
  const btnSend = document.getElementById('btnSendOtp');
  const btnVerify = document.getElementById('btnVerifyOtp');
  const btnBack = document.getElementById('btnBackOtp');
  const nameInput = document.getElementById('authName');
  const contactInput = document.getElementById('authContact');
  const otpInput = document.getElementById('authOtp');

  btnSend.addEventListener('click', () => {
    if (!nameInput.value.trim() || !contactInput.value.trim()) {
      showToast('Please enter both name and contact details.');
      return;
    }
    document.getElementById('authDisplayContact').textContent = contactInput.value.trim();
    document.getElementById('authStep1').style.display = 'none';
    document.getElementById('authStep2').style.display = 'block';
    otpInput.focus();
  });

  btnBack.addEventListener('click', () => {
    document.getElementById('authStep2').style.display = 'none';
    document.getElementById('authStep1').style.display = 'block';
  });

  btnVerify.addEventListener('click', () => {
    if (otpInput.value !== '1234') {
      showToast('Invalid OTP. Use 1234 for simulation.');
      return;
    }
    state.isAuthenticated = true;
    state.user = { name: nameInput.value.trim(), contact: contactInput.value.trim() };
    saveToStorage();
    showToast('Welcome, ' + state.user.name + '!');
    initializeApp();
  });
}


// ===== STORAGE =====
function saveToStorage() {
  localStorage.setItem('flowwise_state', JSON.stringify(state));
}
function loadFromStorage() {
  try {
    const raw = localStorage.getItem('flowwise_state');
    if (raw) {
      const saved = JSON.parse(raw);
      state.income = saved.income || 0;
      state.categories = saved.categories && saved.categories.length ? saved.categories : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      state.savedGoals = saved.savedGoals || [];
      state.darkMode = saved.darkMode || false;
            state.idealRatios = saved.idealRatios || { needs: 50, wants: 30, savings: 20 };
      state.startDate = saved.startDate || new Date().toISOString();
      state.history = saved.history || initHistory();
      state.user = saved.user || null;
      state.isAuthenticated = saved.isAuthenticated || false;
    } else {
      state.startDate = new Date().toISOString();
      state.history = initHistory();
      state.user = null;
      state.isAuthenticated = false;
      state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (state.darkMode) applyDarkMode(true, false);
  } catch(e) {
    state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  }
}

// ===== DARK MODE =====
function applyDarkMode(on, save = true) {
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  document.getElementById('darkModeToggle').textContent = on ? '☀️' : '🌙';
  state.darkMode = on;
  if (save) saveToStorage();
  // Redraw charts after theme change
  setTimeout(() => { renderIdealChart(); if (budgetChart) renderBudgetChart(); }, 50);
}

// ===== EVENT BINDING =====
function bindEvents() {
  document.getElementById('darkModeToggle').addEventListener('click', () => applyDarkMode(!state.darkMode));
  document.getElementById('incomeInput').addEventListener('input', e => {
    state.income = parseFloat(e.target.value) || 0;
    saveToStorage(); update();
  });
  document.getElementById('incomeInput').value = state.income || '';
  document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
  document.getElementById('cancelCatModal').addEventListener('click', closeCategoryModal);
  document.getElementById('confirmCatModal').addEventListener('click', addCustomCategory);
  document.getElementById('calculateGoalBtn').addEventListener('click', calculateGoal);
  document.getElementById('downloadPDF').addEventListener('click', downloadPDF);
  document.getElementById('clearDataBtn').addEventListener('click', clearAllData);
  bindIdealSliders();
  document.getElementById('categoryModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeCategoryModal(); });
  document.getElementById('customCatName').addEventListener('keydown', e => { if (e.key === 'Enter') addCustomCategory(); });
    document.getElementById('navAccountBtn').addEventListener('click', openAccountModal);
  document.getElementById('closeAccountModalBtn').addEventListener('click', closeAccountModal);
  document.getElementById('accountModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAccountModal(); });
  // Navbar scroll shadow
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').style.boxShadow = window.scrollY > 10 ? '0 4px 24px rgba(0,0,0,0.1)' : '';
  });
}

// ===== RENDER CATEGORIES =====
function renderCategories() {
  const grid = document.getElementById('categoriesGrid');
  grid.innerHTML = '';
  state.categories.forEach((cat, idx) => {
    const color = CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length];
    const total = state.categories.reduce((s, c) => s + (c.amount || 0), 0);
    const pct = total > 0 ? ((cat.amount || 0) / (state.income || total) * 100).toFixed(1) : 0;
    const incPct = state.income > 0 ? Math.min(((cat.amount || 0) / state.income * 100), 100) : 0;

    const card = document.createElement('div');
    card.className = 'category-card';
    card.style.setProperty('--cat-color', color);
    card.innerHTML = `
      <div class="cat-header">
        <div class="cat-info">
          <span class="cat-icon">${cat.icon}</span>
          <div>
            <div class="cat-name">${cat.name}</div>
            <span class="cat-type-badge ${cat.type}">${cat.type === 'needs' ? 'Needs' : cat.type === 'wants' ? 'Wants' : 'Savings'}</span>
          </div>
        </div>
        <button class="btn-remove" data-id="${cat.id}" title="Remove">✕</button>
      </div>
      <div class="cat-input-wrap">
        <span class="cat-currency">₹</span>
        <input class="cat-input" type="number" min="0" placeholder="0" value="${cat.amount || ''}" data-id="${cat.id}" />
      </div>
      <div class="cat-pct-bar"><div class="cat-pct-fill" style="width:${incPct}%"></div></div>
      <div class="cat-pct-label">${pct}% of income ${state.income > 0 ? '· ₹' + fmt(cat.amount||0) : ''}</div>
    `;
    grid.appendChild(card);
  });

  // Bind inputs
  grid.querySelectorAll('.cat-input').forEach(input => {
    input.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const cat = state.categories.find(c => c.id === id);
      if (cat) {
        cat.amount = parseFloat(e.target.value) || 0;
        saveToStorage(); update();
      }
    });
  });
  grid.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      state.categories = state.categories.filter(c => c.id !== id);
      saveToStorage(); renderCategories(); update();
      showToast('Category removed');
    });
  });
}

// ===== MASTER UPDATE =====
function update() {
  const totalSpent = state.categories.reduce((s, c) => s + (c.amount || 0), 0);
  const remaining = state.income - totalSpent;
  const pct = state.income > 0 ? Math.min((totalSpent / state.income * 100), 100) : 0;

  // Hero stats
  document.getElementById('statIncome').textContent = '₹' + fmt(state.income);
  document.getElementById('statSpent').textContent = '₹' + fmt(totalSpent);
  document.getElementById('statSavings').textContent = '₹' + fmt(Math.max(remaining, 0));

  // Totals bar
  document.getElementById('totalAllocated').textContent = '₹' + fmt(totalSpent);
  const remEl = document.getElementById('totalRemaining');
  remEl.textContent = '₹' + fmt(remaining);
  remEl.style.color = remaining < 0 ? '#ef4444' : '';

  const fill = document.getElementById('progressFill');
  fill.style.width = pct + '%';
  fill.classList.toggle('over', totalSpent > state.income && state.income > 0);
  document.getElementById('progressLabel').textContent = state.income > 0
    ? pct.toFixed(1) + '% of income allocated'
    : 'Enter your income above';

  // Chart center
  document.getElementById('chartCenterTotal').textContent = '₹' + fmt(totalSpent);

  // Update pct labels in category cards
  document.querySelectorAll('.cat-input').forEach(input => {
    const id = input.dataset.id;
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;
    const card = input.closest('.category-card');
    const pctFill = card.querySelector('.cat-pct-fill');
    const pctLabel = card.querySelector('.cat-pct-label');
    const incPct = state.income > 0 ? Math.min(((cat.amount || 0) / state.income * 100), 100) : 0;
    const displayPct = state.income > 0 ? ((cat.amount || 0) / state.income * 100).toFixed(1) : '0.0';
    pctFill.style.width = incPct + '%';
    pctLabel.textContent = displayPct + '% of income' + (state.income > 0 ? ' · ₹' + fmt(cat.amount || 0) : '');
  });

  renderBudgetChart();
  renderMonthlyChart();
  renderInsights();
  renderSavedGoals();
  // Refresh income hints on ideal cards
  ['needs','wants','savings'].forEach(k => {
    const hint = document.getElementById(k + 'IncomeHint');
    if (hint) hint.textContent = state.income > 0 ? ("" + "\u2248 \₹" + fmt(state.idealRatios[k] / 100 * state.income) + " / month") : "";
  });
}

// ===== IDEAL CHART =====
function renderIdealChart() {
  const ctx = document.getElementById('idealChart').getContext('2d');
  if (idealChart) idealChart.destroy();
  const isDark = state.darkMode;
  const r = state.idealRatios;
  idealChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [`Needs (${r.needs}%)`, `Wants (${r.wants}%)`, `Savings (${r.savings}%)`],
      datasets: [{
        data: [r.needs, r.wants, r.savings],
        backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
        borderWidth: 3,
        borderColor: isDark ? '#1e293b' : '#ffffff',
        hoverOffset: 8,
      }]
    },
    options: {
      cutout: '65%',
      animation: { animateRotate: true, duration: 600, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ' ' + ctx.label }
        }
      },
    }
  });
}

// ===== EDITABLE IDEAL SLIDERS =====
function bindIdealSliders() {
  const sliders = {
    needs:   { slider: document.getElementById('needsSlider'),   input: document.getElementById('needsPctInput'),   display: document.getElementById('needsPctDisplay'),   hint: document.getElementById('needsIncomeHint') },
    wants:   { slider: document.getElementById('wantsSlider'),   input: document.getElementById('wantsPctInput'),   display: document.getElementById('wantsPctDisplay'),   hint: document.getElementById('wantsIncomeHint') },
    savings: { slider: document.getElementById('savingsSlider'), input: document.getElementById('savingsPctInput'), display: document.getElementById('savingsPctDisplay'), hint: document.getElementById('savingsIncomeHint') },
  };

  function syncIdeal(changedKey, value) {
    const v = Math.max(0, Math.min(100, parseInt(value) || 0));
    state.idealRatios[changedKey] = v;

    // Sync slider + number input + display label for the changed key
    const el = sliders[changedKey];
    el.slider.value = v;
    el.input.value = v;
    el.display.textContent = v + '%';

    // Update slider track fill gradient
    updateSliderGradient(el.slider, changedKey, v);

    // Update income hints
    Object.keys(sliders).forEach(k => {
      const amt = state.income > 0 ? (state.idealRatios[k] / 100 * state.income) : 0;
      sliders[k].hint.textContent = state.income > 0 ? `≈ ₹${fmt(amt)} / month` : '';
    });

    // Update total indicator
    const total = state.idealRatios.needs + state.idealRatios.wants + state.idealRatios.savings;
    const totalEl = document.getElementById('idealTotalVal');
    const statusEl = document.getElementById('idealTotalStatus');
    const centerLbl = document.getElementById('idealChartCenterLabel');
    totalEl.textContent = total + '%';
    if (total === 100) {
      statusEl.textContent = '✓ Balanced'; statusEl.className = 'ideal-total-status ok';
      centerLbl.textContent = `${state.idealRatios.needs}/${state.idealRatios.wants}/${state.idealRatios.savings}`;
    } else if (total < 100) {
      statusEl.textContent = `${100 - total}% unallocated`; statusEl.className = 'ideal-total-status warn';
    } else {
      statusEl.textContent = `${total - 100}% over`; statusEl.className = 'ideal-total-status over';
    }

    // Redraw ideal chart + re-run insights
    renderIdealChart();
    if (total === 100) { renderInsights(); }
    saveToStorage();
  }

  function updateSliderGradient(slider, key, val) {
    const colors = { needs: '#3b82f6', wants: '#f59e0b', savings: '#10b981' };
    const c = colors[key];
    const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#e2e8f0';
    slider.style.background = `linear-gradient(to right, ${c} 0%, ${c} ${val}%, var(--border) ${val}%, var(--border) 100%)`;
  }

  // Initialise slider values from state
  Object.keys(sliders).forEach(k => {
    const el = sliders[k];
    const v = state.idealRatios[k];
    el.slider.value = v;
    el.input.value = v;
    el.display.textContent = v + '%';
    updateSliderGradient(el.slider, k, v);

    // Slider drag
    el.slider.addEventListener('input', e => syncIdeal(k, e.target.value));
    // Number input change
    el.input.addEventListener('input', e => syncIdeal(k, e.target.value));
    el.input.addEventListener('blur',  e => syncIdeal(k, e.target.value));
  });

  // Reset button
  document.getElementById('resetIdealBtn').addEventListener('click', () => {
    state.idealRatios = { needs: 50, wants: 30, savings: 20 };
    Object.keys(sliders).forEach(k => syncIdeal(k, state.idealRatios[k]));
    showToast('Reset to 50/30/20 rule ✓');
  });

  // Initialise income hints on load
  Object.keys(sliders).forEach(k => {
    sliders[k].hint.textContent = state.income > 0 ? `≈ ₹${fmt(state.idealRatios[k] / 100 * state.income)} / month` : '';
  });
}

// ===== BUDGET CHART =====
function renderBudgetChart() {
  const active = state.categories.filter(c => (c.amount || 0) > 0);
  const ctx = document.getElementById('budgetChart').getContext('2d');
  const isDark = state.darkMode;

  if (budgetChart) budgetChart.destroy();

  if (active.length === 0) {
    renderChartLegend([]);
    return;
  }

  const colors = active.map((_, i) => CATEGORY_PALETTE[state.categories.indexOf(_) % CATEGORY_PALETTE.length]);
  const total = active.reduce((s, c) => s + c.amount, 0);

  budgetChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: active.map(c => c.name),
      datasets: [{
        data: active.map(c => c.amount),
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: isDark ? '#1e293b' : '#ffffff',
        hoverOffset: 12,
      }]
    },
    options: {
      cutout: '68%',
      animation: { animateRotate: true, duration: 800, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = (ctx.raw / total * 100).toFixed(1);
              return ` ₹${fmt(ctx.raw)} (${pct}%)`;
            }
          }
        }
      },
    }
  });

  renderChartLegend(active, colors, total);
}

function renderChartLegend(active, colors, total) {
  const legend = document.getElementById('chartLegend');
  if (!active || active.length === 0) {
    legend.innerHTML = '<div class="legend-empty"><div class="legend-empty-icon">📊</div><p>Add spending amounts to generate your chart</p></div>';
    return;
  }
  legend.innerHTML = active.map((cat, i) => {
    const pct = (cat.amount / total * 100).toFixed(1);
    return `
      <div class="legend-entry">
        <div class="legend-dot" style="background:${colors[i]}"></div>
        <div class="legend-name">${cat.icon} ${cat.name}</div>
        <div class="legend-meta">
          <div class="legend-pct" style="color:${colors[i]}">${pct}%</div>
          <div class="legend-amt">₹${fmt(cat.amount)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== INSIGHTS =====
function renderInsights() {
  const panel = document.getElementById('insightsPanel');
  const sugSection = document.getElementById('suggestionsSection');
  const sugList = document.getElementById('suggestionsList');

  const totalSpent = state.categories.reduce((s, c) => s + (c.amount || 0), 0);

  if (totalSpent === 0 || state.income === 0) {
    panel.innerHTML = `<div class="insights-empty"><div class="empty-icon">🔎</div><h3>No data yet</h3><p>Enter your income and spending categories to generate personalized insights.</p><a href="#budget-input" class="btn-outline">Add your budget →</a></div>`;
    sugSection.style.display = 'none';
    return;
  }

  // Calculate group totals
  const needsTotal = state.categories.filter(c => c.type === 'needs').reduce((s, c) => s + (c.amount || 0), 0);
  const wantsTotal = state.categories.filter(c => c.type === 'wants').reduce((s, c) => s + (c.amount || 0), 0);
  const savingsTotal = state.categories.filter(c => c.type === 'savings').reduce((s, c) => s + (c.amount || 0), 0);

  const needsPct = (needsTotal / state.income * 100);
  const wantsPct = (wantsTotal / state.income * 100);
  const savingsPct = (savingsTotal / state.income * 100);
  const totalPct = (totalSpent / state.income * 100);
  const idealNeeds = state.idealRatios.needs;
  const idealWants = state.idealRatios.wants;
  const idealSavings = state.idealRatios.savings;

  // Highest category
  const sorted = [...state.categories].filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const highest = sorted[0];

  // Build insight cards
  const insights = [];

  // Overall summary
  const overStatus = totalPct > 100 ? 'danger' : totalPct > 90 ? 'warn' : 'ok';
  insights.push({
    icon: totalPct > 100 ? '🚨' : totalPct > 90 ? '⚠️' : '✅',
    status: overStatus,
    badge: totalPct > 100 ? 'Over Budget' : totalPct > 90 ? 'Close to Limit' : 'On Track',
    title: 'Overall Budget Status',
    desc: `You have allocated <strong>₹${fmt(totalSpent)}</strong> (${totalPct.toFixed(1)}%) of your ₹${fmt(state.income)} income. ${totalPct > 100 ? 'You are <strong>over budget by ₹' + fmt(totalSpent - state.income) + '</strong>. Consider trimming discretionary expenses immediately.' : totalPct > 90 ? 'You are approaching your budget limit. Monitor your spending closely.' : 'Great job keeping your spending in check! You have ₹' + fmt(state.income - totalSpent) + ' remaining.'}`,
    bars: null,
  });

  // Needs analysis
  const needsStatus = needsPct > (idealNeeds + 15) ? 'danger' : needsPct > idealNeeds ? 'warn' : 'ok';
  insights.push({
    icon: needsPct > idealNeeds ? '🏠⚠️' : '🏠✅',
    status: needsStatus,
    badge: needsPct > idealNeeds + 15 ? 'High Needs' : needsPct > idealNeeds ? 'Slightly High' : 'Ideal',
    title: 'Essential Needs (' + needsPct.toFixed(1) + '% vs ideal ${state.idealRatios.needs}%)',
    desc: needsPct > idealNeeds
      ? `Your essential expenses are <strong>${needsPct.toFixed(1)}%</strong> of income — ${(needsPct - 50).toFixed(1)}% above your set ideal of ${idealNeeds}%. Consider ways to reduce rent or bills.`
      : `Your needs are well within your ${idealNeeds}% target at <strong>${needsPct.toFixed(1)}%</strong>. Excellent financial control!`,
    bars: [
      { label: 'Actual', pct: Math.min(needsPct, 100), cls: 'bar-actual', val: needsPct.toFixed(0) + '%' },
      { label: 'Ideal', pct: idealNeeds, cls: 'bar-ideal', val: idealNeeds + '%' },
    ],
  });

  // Wants analysis
  const wantsStatus = wantsPct > (idealWants + 15) ? 'danger' : wantsPct > idealWants ? 'warn' : 'ok';
  insights.push({
    icon: wantsPct > idealWants ? '🎉⚠️' : '🎉✅',
    status: wantsStatus,
    badge: wantsPct > idealWants + 15 ? 'High Spending' : wantsPct > idealWants ? 'Slightly High' : 'Ideal',
    title: 'Lifestyle & Wants (' + wantsPct.toFixed(1) + '% vs ideal ${state.idealRatios.wants}%)',
    desc: wantsPct > idealWants
      ? `You are spending <strong>${wantsPct.toFixed(1)}%</strong> on lifestyle — ${(wantsPct - 30).toFixed(1)}% above your set ${idealWants}%. Try reducing entertainment or shopping by ₹${fmt((wantsPct - idealWants) / 100 * state.income)}.`
      : wantsTotal === 0 ? 'No lifestyle expenses tracked yet. Add categories like shopping or entertainment.' : `Good discipline on lifestyle spending at <strong>${wantsPct.toFixed(1)}%</strong> — well within your ${idealWants}% ideal.`,
    bars: wantsTotal > 0 ? [
      { label: 'Actual', pct: Math.min(wantsPct, 100), cls: 'bar-actual', val: wantsPct.toFixed(0) + '%' },
      { label: 'Ideal', pct: idealWants, cls: 'bar-ideal', val: idealWants + '%' },
    ] : null,
  });

  // Savings analysis
  const savingsStatus = savingsPct < (idealSavings / 2) ? 'danger' : savingsPct < idealSavings ? 'warn' : 'ok';
  insights.push({
    icon: savingsPct >= idealSavings ? '📈✅' : savingsPct >= idealSavings / 2 ? '📈⚠️' : '📈🚨',
    status: savingsStatus,
    badge: savingsPct >= idealSavings ? 'Excellent' : savingsPct >= idealSavings / 2 ? 'Low Savings' : 'Critical',
    title: 'Savings & Investments (' + savingsPct.toFixed(1) + '% vs ideal ${state.idealRatios.savings}%)',
    desc: savingsPct < idealSavings / 2
      ? `Your savings are critically low at <strong>${savingsPct.toFixed(1)}%</strong>. Try to save at least ${idealSavings}% (₹${fmt(state.income * idealSavings / 100)}) monthly for financial security.`
      : savingsPct < idealSavings
      ? `Savings at <strong>${savingsPct.toFixed(1)}%</strong> — below your ideal of ${idealSavings}%. Aim to save an additional ₹${fmt((idealSavings / 100 - savingsPct / 100) * state.income)} monthly.`
      : `Outstanding! You are saving <strong>${savingsPct.toFixed(1)}%</strong> of your income — above your ${idealSavings}% target. Keep it up!`,
    bars: [
      { label: 'Actual', pct: Math.min(savingsPct, 100), cls: 'bar-actual', val: savingsPct.toFixed(0) + '%' },
      { label: 'Ideal', pct: idealSavings, cls: 'bar-ideal', val: idealSavings + '%' },
    ],
  });

  // Highest spender
  if (highest) {
    const highestPct = (highest.amount / state.income * 100).toFixed(1);
    insights.push({
      icon: '🏆',
      status: 'warn',
      badge: 'Top Category',
      title: `Highest: ${highest.icon} ${highest.name} (₹${fmt(highest.amount)})`,
      desc: `<strong>${highest.name}</strong> is your largest spending category at ₹${fmt(highest.amount)} (${highestPct}% of income). ${parseFloat(highestPct) > 25 ? 'This is a significant portion — review if there are savings opportunities here.' : 'This looks reasonable.'}`,
      bars: null,
    });
  }

  panel.innerHTML = insights.map(ins => `
    <div class="insight-card ${ins.status}">
      <div class="insight-icon">${ins.icon}</div>
      <div class="insight-body">
        <span class="insight-badge badge-${ins.status}">${ins.badge}</span>
        <div class="insight-title">${ins.title}</div>
        <div class="insight-desc">${ins.desc}</div>
        ${ins.bars ? `<div class="compare-bars">${ins.bars.map(b => `
          <div class="compare-row">
            <span class="compare-label">${b.label}</span>
            <div class="compare-bar-wrap"><div class="compare-bar-fill ${b.cls}" style="width:${b.pct}%"></div></div>
            <span class="compare-val">${b.val}</span>
          </div>`).join('')}</div>` : ''}
      </div>
    </div>
  `).join('');

  // Smart suggestions
  const suggestions = generateSuggestions(needsPct, wantsPct, savingsPct, totalSpent, highest);
  sugSection.style.display = suggestions.length ? 'block' : 'none';
  sugList.innerHTML = suggestions.map(s => `
    <div class="suggestion-item">
      <span class="suggestion-emoji">${s.emoji}</span>
      <span class="suggestion-text">${s.text}</span>
    </div>
  `).join('');
}

function generateSuggestions(needsPct, wantsPct, savingsPct, totalSpent, highest) {
  const suggestions = [];
  const inc = state.income;

  const iN = state.idealRatios.needs;
  const iW = state.idealRatios.wants;
  const iS = state.idealRatios.savings;

  if (needsPct > iN) {
    const excess = ((needsPct - iN) / 100 * inc);
    suggestions.push({ emoji: '🏠', text: `Your essential needs are ${needsPct.toFixed(0)}% — ${(needsPct - iN).toFixed(0)}% above your ${iN}% ideal. Cutting needs by ₹${fmt(excess)} would free up significant savings.` });
  }
  if (wantsPct > iW) {
    const excess = ((wantsPct - iW) / 100 * inc);
    suggestions.push({ emoji: '✂️', text: `You are spending ${wantsPct.toFixed(0)}% on wants vs your ${iW}% ideal. Try reducing by ${(wantsPct - iW).toFixed(0)}% (₹${fmt(excess)}) to boost your savings.` });
  }
  if (savingsPct < iS) {
    const gap = ((iS - savingsPct) / 100 * inc);
    suggestions.push({ emoji: '📈', text: `Your savings are ${savingsPct.toFixed(0)}% vs your ${iS}% ideal. Consider adding ₹${fmt(gap)} more to savings each month — even index funds or a savings account works.` });
  }
  if (inc > 0 && totalSpent < inc * 0.8) {
    const leftover = inc - totalSpent;
    suggestions.push({ emoji: '💰', text: `You have ₹${fmt(leftover)} unallocated. Consider directing this into an emergency fund or investment account before lifestyle expenses creep up.` });
  }
  if (highest && (highest.amount / inc * 100) > 30) {
    suggestions.push({ emoji: '🔍', text: `${highest.name} alone is ${(highest.amount / inc * 100).toFixed(0)}% of your income. Review this category for potential savings — even a 10% reduction saves ₹${fmt(highest.amount * 0.1)} monthly.` });
  }
  if (savingsPct >= iS && needsPct <= iN) {
    suggestions.push({ emoji: '🌟', text: `Excellent discipline! You are following your ideal split perfectly. Consider diversifying your investments across stocks, bonds, and an emergency fund.` });
  }
  if (wantsPct === 0 && inc > 0) {
    suggestions.push({ emoji: '🎯', text: `You have no lifestyle/want expenses tracked. Make sure to allocate some budget for enjoyment — a sustainable financial plan includes quality of life spending (your ideal: ${iW}%).` });
  }
  if (inc === 0) {
    suggestions.push({ emoji: '💡', text: `Enter your monthly income at the top to unlock personalized financial suggestions tailored to your situation.` });
  }
  return suggestions;
}

// ===== GOAL PLANNER =====
function calculateGoal() {
  const amount = parseFloat(document.getElementById('goalAmount').value) || 0;
  const months = parseInt(document.getElementById('goalTimeframe').value);
  const name = document.getElementById('goalName').value.trim() || 'My Goal';
  const resultEl = document.getElementById('goalResult');

  if (!amount || amount <= 0) {
    showToast('Please enter a valid goal amount');
    return;
  }

  const requiredMonthly = amount / months;
  const currentSavings = state.categories.filter(c => c.type === 'savings').reduce((s, c) => s + (c.amount || 0), 0);
  const gap = requiredMonthly - currentSavings;
  const feasible = state.income > 0 && requiredMonthly <= state.income * 0.5;
  const progressPct = state.income > 0 ? Math.min((currentSavings / requiredMonthly * 100), 100) : 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const timeStr = years > 0 ? (years + ' year' + (years > 1 ? 's' : '') + (remMonths > 0 ? ' ' + remMonths + ' mo' : '')) : months + ' months';

  let advice = '';
  if (gap <= 0) {
    advice = `🎉 Great news! Your current savings rate of ₹${fmt(currentSavings)}/month already exceeds what you need (₹${fmt(requiredMonthly)}/month). You'll hit your goal ahead of schedule!`;
  } else if (feasible) {
    advice = `You need ₹${fmt(gap)} more per month in savings. Try shifting some "wants" spending to reach this goal — even small adjustments compound over time.`;
  } else {
    advice = `This goal requires ₹${fmt(requiredMonthly)}/month. Consider a longer timeframe or increasing your income to make this more achievable.`;
  }

  resultEl.innerHTML = `
    <div class="goal-result-content">
      <div class="goal-result-header">
        <span class="goal-emoji">🎯</span>
        <div>
          <div class="goal-result-title">${name}</div>
          <div class="goal-result-sub">Target: ₹${fmt(amount)} in ${timeStr}</div>
        </div>
      </div>
      <div class="goal-metrics">
        <div class="goal-metric">
          <div class="goal-metric-val">₹${fmt(requiredMonthly)}</div>
          <div class="goal-metric-lbl">Required Monthly</div>
        </div>
        <div class="goal-metric">
          <div class="goal-metric-val">₹${fmt(currentSavings)}</div>
          <div class="goal-metric-lbl">Current Monthly Savings</div>
        </div>
        <div class="goal-metric">
          <div class="goal-metric-val">${months}</div>
          <div class="goal-metric-lbl">Months to Goal</div>
        </div>
        <div class="goal-metric">
          <div class="goal-metric-val">${gap > 0 ? '-₹' + fmt(gap) : '✅'}</div>
          <div class="goal-metric-lbl">${gap > 0 ? 'Monthly Gap' : 'Goal Achievable!'}</div>
        </div>
      </div>
      <div class="goal-progress-section">
        <div class="goal-progress-label">
          <span>Savings Coverage</span>
          <span>${progressPct.toFixed(0)}%</span>
        </div>
        <div class="progress-bar" style="height:12px">
          <div class="progress-fill" style="width:${progressPct}%"></div>
        </div>
      </div>
      <div class="goal-advice">${advice}</div>
      <button class="btn-save-goal" onclick="saveGoal('${name}', ${amount}, ${months}, ${requiredMonthly})">📌 Save This Goal</button>
    </div>
  `;
}

function saveGoal(name, amount, months, monthly) {
  const goal = { id: Date.now(), name, amount, months, monthly, createdAt: new Date().toLocaleDateString() };
  state.savedGoals.push(goal);
  saveToStorage();
  renderSavedGoals();
  showToast('Goal saved! 📌');
}

function renderSavedGoals() {
  const container = document.getElementById('savedGoals');
  const list = document.getElementById('savedGoalsList');
  if (!state.savedGoals || state.savedGoals.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  list.innerHTML = state.savedGoals.map(g => `
    <div class="saved-goal-card">
      <button class="btn-delete-goal" onclick="deleteGoal(${g.id})">✕</button>
      <div class="saved-goal-name">🎯 ${g.name}</div>
      <div class="saved-goal-meta">Target: <strong>₹${fmt(g.amount)}</strong></div>
      <div class="saved-goal-meta">Monthly needed: <strong>₹${fmt(g.monthly)}</strong></div>
      <div class="saved-goal-meta">Timeframe: <strong>${g.months} months</strong></div>
      <div class="saved-goal-meta" style="color:var(--text-light);font-size:12px">Saved on ${g.createdAt}</div>
    </div>
  `).join('');
}

function deleteGoal(id) {
  state.savedGoals = state.savedGoals.filter(g => g.id !== id);
  saveToStorage();
  renderSavedGoals();
  showToast('Goal removed');
}

// ===== MODAL =====
function openCategoryModal() {
  document.getElementById('categoryModal').style.display = 'flex';
  document.getElementById('customCatName').value = '';
  document.getElementById('customCatEmoji').value = '';
  document.getElementById('customCatName').focus();
  renderEmojiGrid();
}

function renderEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  const usedEmojis = state.categories.map(c => c.icon);
  
  grid.innerHTML = AVAILABLE_EMOJIS.map(emoji => {
    const isUsed = usedEmojis.includes(emoji);
    return `<div class="emoji-opt ${isUsed ? 'disabled' : ''}" data-emoji="${emoji}" title="${isUsed ? 'Already in use' : 'Select emoji'}">${emoji}</div>`;
  }).join('');
  
  const firstAvail = AVAILABLE_EMOJIS.find(e => !usedEmojis.includes(e));
  if (firstAvail) selectEmoji(firstAvail);

  grid.querySelectorAll('.emoji-opt:not(.disabled)').forEach(el => {
    el.addEventListener('click', (e) => selectEmoji(e.target.dataset.emoji));
  });
}

function selectEmoji(emoji) {
  document.getElementById('customCatEmoji').value = emoji;
  const grid = document.getElementById('emojiGrid');
  grid.querySelectorAll('.emoji-opt').forEach(el => {
    if (el.dataset.emoji === emoji) el.classList.add('selected');
    else el.classList.remove('selected');
  });
}
function closeCategoryModal() {
  document.getElementById('categoryModal').style.display = 'none';
}
function addCustomCategory() {
  const name = document.getElementById('customCatName').value.trim();
  const type = document.getElementById('customCatType').value;
  const icon = document.getElementById('customCatEmoji').value;
  if (!name) { showToast('Please enter a category name'); return; }
  if (!icon) { showToast('Please select an icon. No available icons left.'); return; }
  
  const cat = { id: 'cat_' + Date.now(), name, icon, type, amount: 0 };
  state.categories.push(cat);
  saveToStorage();
  closeCategoryModal();
  renderCategories();
  update();
  showToast(`"${name}" category added! ✅`);
}

// ===== PDF EXPORT =====
function downloadPDF() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const inc = state.income;
    const totalSpent = state.categories.reduce((s, c) => s + (c.amount || 0), 0);
    const remaining = inc - totalSpent;
    const now = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: 'numeric' });

    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, 220, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('FlowWise Monthly Report', 14, 18);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('Generated: ' + now, 14, 30);

    doc.setTextColor(15, 23, 42);
    let y = 52;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Financial Summary', 14, y); y += 10;
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`Monthly Income:    ₹${fmt(inc)}`, 14, y); y += 8;
    doc.text(`Total Spent:       ₹${fmt(totalSpent)}`, 14, y); y += 8;
    doc.text(`Remaining:         ₹${fmt(remaining)}`, 14, y); y += 8;
    doc.text(`Allocation:        ${inc > 0 ? (totalSpent / inc * 100).toFixed(1) : 0}% of income`, 14, y); y += 14;

    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Spending Breakdown', 14, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    state.categories.filter(c => c.amount > 0).forEach(cat => {
      const pct = inc > 0 ? (cat.amount / inc * 100).toFixed(1) : '-';
      doc.text(`₹${cat.icon || '•'} ${cat.name.padEnd(20)} ₹${fmt(cat.amount).padStart(8)}   ${pct}% of income  [${cat.type}]`, 14, y);
      y += 7;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 6;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Your Custom Split Comparison', 14, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const needsT = state.categories.filter(c => c.type === 'needs').reduce((s, c) => s + (c.amount || 0), 0);
    const wantsT = state.categories.filter(c => c.type === 'wants').reduce((s, c) => s + (c.amount || 0), 0);
    const savT = state.categories.filter(c => c.type === 'savings').reduce((s, c) => s + (c.amount || 0), 0);
    doc.text(`  Needs:      ₹${fmt(needsT)}   (${inc > 0 ? (needsT / inc * 100).toFixed(1) : 0}% vs ideal ${state.idealRatios.needs}%)`, 14, y); y += 7;
    doc.text(`  Wants:      ₹${fmt(wantsT)}   (${inc > 0 ? (wantsT / inc * 100).toFixed(1) : 0}% vs ideal ${state.idealRatios.wants}%)`, 14, y); y += 7;
    doc.text(`  Savings:    ₹${fmt(savT)}   (${inc > 0 ? (savT / inc * 100).toFixed(1) : 0}% vs ideal ${state.idealRatios.savings}%)`, 14, y); y += 14;

    if (state.savedGoals.length > 0) {
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('Saved Goals', 14, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      state.savedGoals.forEach(g => {
        doc.text(`  • ${g.name}: ₹${fmt(g.amount)} in ${g.months} months (₹${fmt(g.monthly)}/month needed)`, 14, y); y += 7;
      });
    }

    doc.setFontSize(9); doc.setTextColor(100, 116, 139);
    doc.text('Generated by FlowWise – flowwise.app', 14, 285);

    doc.save('FlowWise_Report_' + new Date().toISOString().slice(0,10) + '.pdf');
    showToast('Report exported as PDF! 📄');
  } catch(e) {
    showToast('PDF export failed. Please try again.');
    console.error(e);
  }
}

// ===== CLEAR DATA =====
function clearAllData() {
  if (!confirm('Clear all data? This will log you out and delete everything. It cannot be undone.')) return;
  state = { income: 0, categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)), savedGoals: [], darkMode: state.darkMode, isAuthenticated: false, user: null, startDate: null, history: [] };
  localStorage.removeItem('flowwise_state');
  showToast('All data cleared. Logging out...');
  setTimeout(() => window.location.reload(), 800);
}

// ===== TOAST =====
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ===== UTIL =====
function fmt(n) {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Global exposure for inline onclick
window.saveGoal = saveGoal;
window.deleteGoal = deleteGoal;







// ===== MONTHLY CHART & HISTORY =====
let monthlyChart = null;

function initHistory() {
  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'short' });
  return [{ label: monthName, needs: 0, wants: 0, savings: 0 }];
}

function renderMonthlyChart() {
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  const isDark = state.darkMode;
  
  if (monthlyChart) monthlyChart.destroy();
  
  // Use current numbers for the last month to make it look live
  // Append new month if month changed
  const now = new Date();
  const currentMonthLabel = now.toLocaleString('default', { month: 'short' });
  let needsTotal = state.categories.filter(c => c.type === 'needs').reduce((s, c) => s + (c.amount || 0), 0);
  let wantsTotal = state.categories.filter(c => c.type === 'wants').reduce((s, c) => s + (c.amount || 0), 0);
  let savingsTotal = state.categories.filter(c => c.type === 'savings').reduce((s, c) => s + (c.amount || 0), 0);
  
  const h = [...state.history];
  if (h.length > 0) {
    if (h[h.length - 1].label !== currentMonthLabel) {
      h.push({ label: currentMonthLabel, needs: needsTotal, wants: wantsTotal, savings: savingsTotal });
    } else {
      h[h.length - 1].needs = needsTotal || h[h.length - 1].needs;
      h[h.length - 1].wants = wantsTotal || h[h.length - 1].wants;
      h[h.length - 1].savings = savingsTotal || h[h.length - 1].savings;
    }
    state.history = h;
    saveToStorage();
  }

  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  monthlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: h.map(d => d.label),
      datasets: [
        { label: 'Needs', data: h.map(d => d.needs), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4, fill: true, pointRadius: 4 },
        { label: 'Wants', data: h.map(d => d.wants), borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.4, fill: true, pointRadius: 4 },
        { label: 'Savings', data: h.map(d => d.savings), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true, pointRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: textColor, font: { family: 'Inter', size: 12 } } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { grid: { display: false, color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => '₹' + v } }
      }
    }
  });
}

// Global clock and dates
function initDatesAndClock() {
  const sdLabel = document.getElementById('appStartDate');
  const clockLabel = document.getElementById('localCurrentTime');
  
  if (sdLabel && state.startDate) {
    const d = new Date(state.startDate);
    sdLabel.textContent = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  
  if (clockLabel) {
    setInterval(() => {
      clockLabel.textContent = new Date().toLocaleString('en-IN', { hour: '2-digit', minute:'2-digit', second:'2-digit', day:'2-digit', month:'short', year:'numeric' });
    }, 1000);
  }
}

// Clock initialized dynamically inside initializeApp()


function openAccountModal() {
  const modal = document.getElementById('accountModal');
  if (!modal || !state.user) return;
  modal.style.display = 'flex';
  
  // Update UI Elements
  document.getElementById('accountName').textContent = state.user.name;
  document.getElementById('accountContact').textContent = state.user.contact;
  
  const d = new Date(state.startDate);
  document.getElementById('accountMemberSince').textContent = 'Started tracking on ' + d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  
  document.getElementById('accountInc').textContent = '₹' + fmt(state.income);
  
  // Calculate specific totals for current month
  const totalSpent = state.categories.reduce((s, c) => s + (c.amount || 0), 0);
  const needsTotal = state.categories.filter(c => c.type === 'needs').reduce((s, c) => s + (c.amount || 0), 0);
  const savingsTotal = state.categories.filter(c => c.type === 'savings').reduce((s, c) => s + (c.amount || 0), 0);
  
  document.getElementById('accountExp').textContent = '₹' + fmt(totalSpent);
  
  const needsPct = state.income > 0 ? (needsTotal / state.income * 100) : 0;
  const savPct = state.income > 0 ? (savingsTotal / state.income * 100) : 0;
  
  document.getElementById('accountNeeds').textContent = needsPct.toFixed(1) + '%';
  document.getElementById('accountSav').textContent = savPct.toFixed(1) + '% (' + '₹' + fmt(savingsTotal) + ')';
}

function closeAccountModal() {
  document.getElementById('accountModal').style.display = 'none';
}
