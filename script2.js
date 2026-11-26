// ---- script2.js: script.js चा दुसरा भाग (script.js नंतर load होतो) ----
// ---------- Add Stock / Purchase ----------
async function searchPurchaseArticle() {
    const artNo = document.getElementById('purArtNo').value.trim(); if(!artNo) return;
    const { data: articles, error } = await supabaseClient.from('articles').select(`id, article_no, name, cost_price, stock_batches (color, size)`).eq('shop_id', currentShopId).eq('article_no', artNo).single();
    if (error || !articles) { showToast("Article not found!", true); document.getElementById('purArticleDetails').style.display = 'none'; return; }
    foundPurchaseArticle = articles;
    document.getElementById('purArtName').innerText = `[${articles.article_no}] ${articles.name}`;
    const colorSelect = document.getElementById('purColor'); colorSelect.innerHTML = '';
    let uniqueColors = new Set();
    articles.stock_batches.forEach(batch => { let c = batch.color || ''; if (c === 'Default') c = ''; uniqueColors.add(c); });
    uniqueColors.forEach(color => { let displayColor = (color === '') ? 'No Color' : color; colorSelect.innerHTML += `<option value="${esc(color)}">${esc(displayColor)}</option>`; });
    colorSelect.innerHTML += '<option value="__new__">➕ New color…</option>';
    updatePurchaseSizes(); document.getElementById('purCost').value = articles.cost_price || 0; document.getElementById('purArticleDetails').style.display = 'block';
}

function updatePurchaseSizes() {
    const color = document.getElementById('purColor').value; const sizeSelect = document.getElementById('purSize'); sizeSelect.innerHTML = '';
    let uniqueSizes = new Set();
    foundPurchaseArticle.stock_batches.forEach(batch => { let bColor = batch.color || ''; if (bColor === 'Default') bColor = ''; if(bColor === color) uniqueSizes.add(String(batch.size).trim()); });
    uniqueSizes.forEach(size => { sizeSelect.innerHTML += `<option value="${esc(size)}">Size ${esc(size)}</option>`; });
    sizeSelect.innerHTML += '<option value="__new__">➕ New size…</option>';
    togglePurNew();
}
function togglePurNew() {
    document.getElementById('purNewColor').style.display = document.getElementById('purColor').value === '__new__' ? 'block' : 'none';
    document.getElementById('purNewSize').style.display = document.getElementById('purSize').value === '__new__' ? 'block' : 'none';
}

async function processPurchase() {
    let color = document.getElementById('purColor').value; let size = document.getElementById('purSize').value;
    if (color === '__new__') { color = document.getElementById('purNewColor').value.trim(); if (!color) { showToast("Enter the new color name", true); return; } }
    if (size === '__new__') { size = document.getElementById('purNewSize').value.trim(); if (!size || !(Number(size) > 0)) { showToast("Enter a valid new size", true); return; } }
    const qty = parseInt(document.getElementById('purQty').value); const cost = parseInt(document.getElementById('purCost').value) || 0; const supplier = document.getElementById('purSupplier').value;
    if(!size || !qty || qty <= 0) { showToast("Invalid details!", true); return; }
    let query = supabaseClient.from('stock_batches').select('id, remaining_qty, initial_qty').eq('shop_id', currentShopId).eq('article_id', foundPurchaseArticle.id).eq('size', size);
    if(color && color !== 'Default') { query = query.eq('color', color); } else { query = query.or('color.is.null,color.eq.Default,color.eq.'); }
    const { data: existingBatch } = await query.limit(1).maybeSingle();
    if (existingBatch) { await supabaseClient.from('stock_batches').update({ remaining_qty: existingBatch.remaining_qty + qty, initial_qty: existingBatch.initial_qty + qty }).eq('id', existingBatch.id); } 
    else { await supabaseClient.from('stock_batches').insert([{ shop_id: currentShopId, article_id: foundPurchaseArticle.id, size: size, color: color, initial_qty: qty, remaining_qty: qty, cost_price: cost }]); }
    await supabaseClient.from('purchases').insert([{ shop_id: currentShopId, article_id: foundPurchaseArticle.id, size: size, quantity: qty, cost_price: cost, supplier_name: supplier }]);
    showToast(`✅ Added ${qty} pairs to stock!`, false); document.getElementById('purArticleDetails').style.display = 'none'; document.getElementById('purArtNo').value = ''; document.getElementById('purSupplier').value = ''; document.getElementById('purNewColor').value = ''; document.getElementById('purNewSize').value = '';
}

// ---------- Low Stock Alert ----------
async function loadLowStockAlerts() {
    const container = document.getElementById('lowStockListContainer');
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Loading...</p>';
    const { data: articles } = await supabaseClient.from('articles').select(`id, article_no, name, category, stock_batches (color, size, remaining_qty)`).eq('shop_id', currentShopId);
    let lowStockHtml = '';
    if(articles) {
        articles.forEach(art => {
            let totalPairs = 0, sizeDetails = [];
            (art.stock_batches || []).forEach(b => {
                totalPairs += b.remaining_qty;
                if (b.remaining_qty > 0) {
                    let c = b.color || ''; if(c === 'Default') c = '';
                    let s = String(b.size).trim();
                    let display = (c ? c + " - " : "") + "Size " + s;
                    sizeDetails.push(`<span style="background: rgba(16,185,129,0.15); color: var(--success); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px; display:inline-block; margin-bottom:4px;">${display}: ${b.remaining_qty}</span>`);
                }
            });
            if (totalPairs <= 2) {
                let badgeColor = totalPairs === 0 ? 'var(--danger)' : 'var(--warning)';
                lowStockHtml += `
                <div class="app-card" style="border-left: 4px solid ${badgeColor}; padding: 15px; margin-bottom: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                        <h4 style="margin:0; font-size:15px;">[${esc(art.article_no)}] ${esc(art.name) || 'Unnamed'}</h4>
                        <span style="background:${badgeColor}; color:white; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">Total: ${totalPairs}</span>
                    </div>
                    <p style="margin:0 0 8px 0; font-size:12px; color:var(--text-muted);">${esc(art.category)}</p>
                    <div style="font-size: 12px; font-weight: 600; color: var(--text-light); margin-bottom: 5px;">Available Sizes:</div>
                    <div>${sizeDetails.length ? sizeDetails.join('') : '<span style="color:var(--danger); font-weight:bold;">Out of Stock</span>'}</div>
                    <div style="display:flex; gap:8px; margin-top:12px; border-top: 1px dashed var(--border-color); padding-top:12px;">
                        <button class="btn-primary" onclick="quickAddStock('${esc(art.article_no)}')" style="flex:1; margin:0; padding:8px; font-size:12px; border-radius:8px;"><i class="fa-solid fa-plus"></i> Add Stock</button>
                        ${!isStaffMode ? `<button class="btn-danger" onclick="askConfirm('Delete this article permanently?', () => deleteArticle('${art.id}'))" style="flex:1; margin:0; padding:8px; font-size:12px; border-radius:8px;"><i class="fa-solid fa-trash"></i> Delete</button>` : ''}
                    </div>
                </div>`;
            }
        });
    }
    if(lowStockHtml === '') { container.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--success);"><i class="fa-solid fa-check-circle" style="font-size: 40px; margin-bottom: 10px;"></i><h3>All Good!</h3><p>All shoes have enough stock in all sizes.</p></div>'; } else { container.innerHTML = lowStockHtml; }
}

function quickAddStock(artNo) { switchTab('purchase'); document.getElementById('purArtNo').value = artNo; searchPurchaseArticle(); }

// ---------- History & Reports ----------
let histFilter = 'all';
function setHistFilter(f, el) {
    histFilter = f;
    document.querySelectorAll('#historyScreen .hist-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active'); loadHistory();
}
function delBtn(kind, id) {
    return isStaffMode ? '' : `<button class="hist-del" onclick="deleteHistory('${kind}','${id}')"><i class="fa-solid fa-trash"></i></button>`;
}

// ---------- Owner PIN check (for deleting history) ----------
let pinCallback = null;
async function verifyOwnerPin(pin) {
    let email = currentUser && currentUser.email;
    if (!email) { const { data } = await supabaseClient.auth.getUser(); email = data && data.user && data.user.email; }
    if (!email) return false;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pin });
    return !error;
}
function askOwnerPin(msg, callback) {
    document.getElementById('pinConfirmMsg').innerText = msg;
    document.getElementById('pinConfirmErr').innerText = '';
    const inp = document.getElementById('pinConfirmInput'); inp.value = '';
    document.getElementById('pinConfirmModal').style.display = 'flex';
    pinCallback = callback;
    setTimeout(() => inp.focus(), 100);
}
function closePinModal() { document.getElementById('pinConfirmModal').style.display = 'none'; pinCallback = null; }
async function submitOwnerPin() {
    const pin = document.getElementById('pinConfirmInput').value.trim();
    const err = document.getElementById('pinConfirmErr'), btn = document.getElementById('pinConfirmOk');
    if (!pin) { err.innerText = 'Enter owner PIN'; return; }
    btn.disabled = true; err.innerText = 'Checking...';
    let ok = false;
    try { ok = await verifyOwnerPin(pin); } catch (e) { ok = false; }
    btn.disabled = false;
    if (!ok) { err.innerText = 'Wrong PIN. Try again.'; return; }
    const cb = pinCallback; closePinModal();
    if (cb) cb();
}

function deleteHistory(kind, id) {
    const msg = kind === 'sale' ? 'Delete this bill? (Stock will be added back)' : kind === 'return' ? 'Delete this return entry? (Stock will be reduced)' : 'Delete this expense?';
    askOwnerPin(msg + '\nEnter owner PIN to continue.', async () => {
        const fn = { sale: 'delete_sale', return: 'delete_return', expense: 'delete_expense' }[kind];
        const { error } = await supabaseClient.rpc(fn, { p_id: String(id) });
        if (error) { showToast('Error: ' + error.message, true); return; }
        showToast('Deleted ✅', false); loadHistory();
    });
}
function clearHistory() {
    const dateEl = document.getElementById('histDate');
    const d = (dateEl && dateEl.value) || localDateStr(new Date());
    askOwnerPin(`Delete ALL history (Sales, Returns, Expenses) for ${d}? Stock will not change.\nEnter owner PIN to continue.`, async () => {
        const r = dayRange(d);
        const { error } = await supabaseClient.rpc('clear_history', { p_from: r[0], p_to: r[1] });
        if (error) { showToast('Error: ' + error.message, true); return; }
        showToast('History cleared ✅', false); switchTab('history');
    });
}
function fmtTime(iso) { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
async function loadHistory() {
    const dateEl = document.getElementById('histDate');
    if(!dateEl.value) dateEl.value = localDateStr(new Date());
    const list = document.getElementById('historyList');
    list.innerHTML = skeleton(3);
    const r = dayRange(dateEl.value);
    const { data, error } = await supabaseClient.rpc('get_history', { p_from: r[0], p_to: r[1] });
    if (error) { list.innerHTML = `<div class="hist-empty">Error: ${esc(error.message)}</div>`; return; }
    const sales = data.sales || [], rets = data.returns || [], exps = data.expenses || [];
    let sTotal = 0, rTotal = 0, eTotal = 0;
    sales.forEach(s => sTotal += s.total_amount); rets.forEach(x => rTotal += x.refund_amount); exps.forEach(x => eTotal += x.amount);
    document.getElementById('histSales').innerText = '₹' + sTotal; document.getElementById('histReturns').innerText = '₹' + rTotal; document.getElementById('histNet').innerText = '₹' + (sTotal - rTotal - eTotal);

    let rows = [];
    sales.forEach(s => rows.push({ t: s.sale_date, type: 'sale', html: `
        <div class="hist-card sale"><div class="hist-head"><span class="hist-badge sale"><i class="fa-solid fa-bag-shopping"></i> Sale</span><span class="hist-right"><span class="hist-time">${fmtTime(s.sale_date)}</span>${delBtn('sale', s.id)}</span></div>
        ${(s.items||[]).map(i => `<div class="hist-line"><span>[${esc(i.article_no)}] ${esc(i.name||'')} • S${esc(i.size)} × ${i.qty}</span><b>₹${i.qty * i.price}</b></div>`).join('')}
        ${s.discount_amount > 0 ? `<div class="hist-line muted"><span>Discount</span><b>-₹${s.discount_amount}</b></div>` : ''}
        <div class="hist-total"><span>Total</span><b class="pos">+₹${s.total_amount}</b></div></div>` }));
    rets.forEach(x => rows.push({ t: x.return_date, type: 'return', html: `
        <div class="hist-card ret"><div class="hist-head"><span class="hist-badge ret"><i class="fa-solid fa-rotate-left"></i> Return</span><span class="hist-right"><span class="hist-time">${fmtTime(x.return_date)}</span>${delBtn('return', x.id)}</span></div>
        <div class="hist-line"><span>[${esc(x.article_no||'-')}] ${esc(x.name||'')} • S${esc(x.size)} × ${x.quantity}</span><b class="warn">-₹${x.refund_amount}</b></div></div>` }));
    exps.forEach(x => rows.push({ t: x.expense_date, type: 'expense', html: `
        <div class="hist-card exp"><div class="hist-head"><span class="hist-badge exp"><i class="fa-solid fa-money-bill-transfer"></i> Expense</span><span class="hist-right"><span class="hist-time">${fmtTime(x.expense_date)}</span>${delBtn('expense', x.id)}</span></div>
        <div class="hist-line"><span>${esc(x.reason)}</span><b class="neg">-₹${x.amount}</b></div></div>` }));
    rows = rows.filter(x => histFilter === 'all' || x.type === histFilter).sort((a, b) => new Date(b.t) - new Date(a.t));
    list.innerHTML = rows.length ? rows.map(x => x.html).join('') : emptyState('fa-folder-open', 'No records for this day');
}

function shiftHistDay(delta) {
    const el = document.getElementById('histDate');
    const d = new Date((el.value || localDateStr(new Date())) + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    if (d > new Date()) { showToast('Future dates have no records', true); return; }
    el.value = localDateStr(d); loadHistory();
}

async function loadReportData() {
    const selectedDate = document.getElementById('reportDate').value;
    if (!selectedDate || !currentShopId) return;
    const [rStart, rEnd] = dayRange(selectedDate);
    const { data } = await supabaseClient.rpc('get_history', { p_from: rStart, p_to: rEnd });
    const H = data || {};
    let totalSales = 0, totalProfit = 0;
    (H.sales || []).forEach(x => { totalSales += x.total_amount; totalProfit += x.total_profit; });
    (H.returns || []).forEach(r => { totalSales -= r.refund_amount; totalProfit -= (r.refund_amount - (r.cost || 0) * r.quantity); });
    (H.expenses || []).forEach(e => { totalProfit -= e.amount; });
    document.getElementById('reportSales').innerText = "₹" + totalSales; document.getElementById('reportProfit').innerText = "₹" + totalProfit;
    if(document.getElementById('salesChart')) { loadChartData('weekly'); }
}

let mySalesChart = null;
async function loadChartData(type) {
    if (!currentShopId || typeof Chart === 'undefined') return;
    const btnWeekly = document.getElementById('btnWeekly'); const btnMonthly = document.getElementById('btnMonthly');
    const on = (b) => { b.style.background = 'linear-gradient(135deg, #1D4ED8, #1E40AF)'; b.style.color = 'white'; };
    const off = (b) => { b.style.background = 'transparent'; b.style.color = 'var(--primary)'; };
    if (type === 'weekly') { on(btnWeekly); off(btnMonthly); } else { on(btnMonthly); off(btnWeekly); }

    const days = type === 'weekly' ? 7 : 28;
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
    const { data: sales } = await supabaseClient.from('sales').select('total_amount, sale_date').eq('shop_id', currentShopId).gte('sale_date', start.toISOString());
    const perDay = {};
    (sales || []).forEach(x => { const k = localDateStr(new Date(x.sale_date)); perDay[k] = (perDay[k] || 0) + x.total_amount; });

    let labels = [], salesData = [];
    if (type === 'weekly') { for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); labels.push(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })); salesData.push(perDay[localDateStr(d)] || 0); } } 
    else { for (let w = 0; w < 4; w++) { let total = 0; for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + w * 7 + i); total += perDay[localDateStr(d)] || 0; } labels.push(`Week ${w + 1}`); salesData.push(total); } }

    if (mySalesChart) { mySalesChart.destroy(); }
    const ctx = document.getElementById('salesChart').getContext('2d');
    mySalesChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Sales (₹)', data: salesData, backgroundColor: 'rgba(29, 78, 216, 0.7)', borderColor: 'rgba(29, 78, 216, 1)', borderWidth: 1, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { color: '#94A3B8' } }, x: { grid: { display: false }, ticks: { color: '#94A3B8' } } } } });
}

// ---------- Helpers & PWA ----------
function skeleton(n) { return Array.from({ length: n }, () => '<div class="skeleton"></div>').join(''); }
function emptyState(icon, text, btn) { return `<div class="empty-state"><i class="fa-solid ${icon}"></i><p>${text}</p>${btn || ''}</div>`; }

if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error', err)); }); }

// ---------- PWA & Logout ----------
async function handleLogout() {
    await supabaseClient.auth.signOut();
    isStaffMode = false; currentShopId = null; currentUser = null; cart = []; currentShopName = ''; currentBillData = null;
    foundSaleArticle = null; foundReturnArticle = null; foundPurchaseArticle = null;
    document.getElementById('headerShopName').innerText = 'SJ Digital Labs';
    localStorage.removeItem('isStaff'); 
    document.getElementById('topHeader').style.display = 'none'; document.getElementById('bottomNav').style.display = 'none'; document.getElementById('superAdminScreen').style.display = 'none';
    document.getElementById('loginShopName').value = ''; document.getElementById('loginPin').value = '';
    switchTab(''); document.getElementById('loginScreen').style.display = 'block'; document.getElementById('nav-dash').style.display = 'flex';
    let navMore = document.getElementById('nav-more'); navMore.setAttribute('onclick', 'toggleSidebar()'); navMore.innerHTML = '<i class="fa-solid fa-bars nav-icon"></i> Menu';
    document.getElementById('nav-stock').style.display = 'flex'; document.getElementById('nav-sale').style.display = 'flex';
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { 
        currentUser = session.user; 
        if (currentUser.email === ADMIN_EMAIL) {
            document.getElementById('loginScreen').style.display = 'none'; document.getElementById('topHeader').style.display = 'none'; document.getElementById('superAdminScreen').style.display = 'block'; document.getElementById('bottomNav').style.display = 'none'; loadSuperAdminData();
        } else {
            const { data: shop } = await supabaseClient.from('shops').select('*').eq('auth_email', currentUser.email).single();
            if(shop) {
                if (shop.status !== 'active' || !shop.expiry_date || new Date() > new Date(shop.expiry_date)) { await supabaseClient.auth.signOut(); showToast("Subscription expired / inactive! Contact Admin.", true); return; }
                const currentStaffMode = localStorage.getItem('isStaff') === 'true';
                if (currentStaffMode && !shop.staff_pin) { await supabaseClient.auth.signOut(); localStorage.removeItem('isStaff'); document.getElementById('loginScreen').style.display = 'block'; document.getElementById('topHeader').style.display = 'none'; document.getElementById('bottomNav').style.display = 'none'; showToast("Staff access revoked! Owner removed the PIN.", true); return; }
                currentShopId = shop.id; currentShopName = shop.shop_name; 
                currentShopDetails = shopDetailsFrom(shop);
                document.getElementById('headerShopName').innerText = currentShopName; isStaffMode = currentStaffMode; showOwnerDashboard(); 
            } else { await handleLogout(); showToast("Shop data not found. Please login again.", true); }
        }
    }
}

// ---------- Staff Pin ----------
async function loadStaffPin() {
    const { data } = await supabaseClient.from('shops').select('staff_pin').eq('id', currentShopId).single();
    document.getElementById('displayStaffPin').innerText = (data && data.staff_pin) ? data.staff_pin : '----';
}

async function generateStaffPin() {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    showToast("Saving new PIN...", false);
    const { error } = await supabaseClient.from('shops').update({ staff_pin: newPin }).eq('id', currentShopId);
    if (error) { showToast("Database Error: " + error.message, true); return; }
    document.getElementById('displayStaffPin').innerText = newPin; showToast("✅ New Staff PIN Generated!", false);
}

async function resetStaffPin() {
    showToast("Removing PIN...", false);
    const { error } = await supabaseClient.from('shops').update({ staff_pin: null }).eq('id', currentShopId);
    if (error) { showToast("Database Error: " + error.message, true); return; }
    document.getElementById('displayStaffPin').innerText = '----'; showToast("Staff PIN Removed!", false);
}

// ---------- Super Admin Functions ----------
function switchAdminTab(tabName, btnElement) {
    currentAdminTab = tabName;
    document.querySelectorAll('#superAdminScreen .hist-tab').forEach(t => t.classList.remove('active'));
    btnElement.classList.add('active');
    
    document.getElementById('adminTab-shops').style.display = 'none';
    document.getElementById('adminTab-payments').style.display = 'none';
    document.getElementById('adminTab-comms').style.display = 'none';
    document.getElementById('adminTab-logs').style.display = 'none';
    
    document.getElementById('adminTab-' + tabName).style.display = 'block';
    
    if (tabName === 'shops') loadSuperAdminData();
    else if (tabName === 'payments') loadAdminPayments();
    else if (tabName === 'comms') loadAdminAnnouncements();
    else if (tabName === 'logs') loadAdminLogs();
}

async function loadSuperAdminData() {
    const list = document.getElementById('saOwnerList');
    const searchTerm = document.getElementById('saSearch').value.toLowerCase();
    const { data: shops, error } = await supabaseClient.from('shops').select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = "Error loading shops."; return; }
    
    const today = new Date();
    let activeCount = 0, blockedCount = 0, expiringCount = 0, monthlyRev = 0;
    
    shops.forEach(s => {
        if (s.status === 'active' && s.expiry_date && new Date(s.expiry_date) > today) {
            activeCount++;
            const daysLeft = (new Date(s.expiry_date) - today) / (1000 * 60 * 60 * 24);
            if (daysLeft <= 7) expiringCount++;
        } else if (s.status !== 'active') {
            blockedCount++;
        }
        if (s.last_payment_date && new Date(s.last_payment_date).getMonth() === today.getMonth() && new Date(s.last_payment_date).getFullYear() === today.getFullYear()) {
            monthlyRev += (s.last_payment_amount || 0);
        }
    });

    document.getElementById('saStats').innerText = `Total: ${shops.length} | Active: ${activeCount} | Blocked: ${blockedCount}`;
    document.getElementById('adminActiveShops').innerText = activeCount;
    document.getElementById('adminExpiringShops').innerText = expiringCount;
    document.getElementById('adminMonthlyRevenue').innerText = '₹' + monthlyRev;

    const filtered = shops.filter(s => (s.owner_name && s.owner_name.toLowerCase().includes(searchTerm)) || (s.shop_name && s.shop_name.toLowerCase().includes(searchTerm)));
    
    list.innerHTML = '';
    if(filtered.length === 0) { list.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No shops found.</p>'; return; }
    
    filtered.forEach(s => {
        let isActive = s.status === 'active';
        let expiryStr = s.expiry_date ? new Date(s.expiry_date).toLocaleDateString('en-GB') : 'Not Set';
        let isExpiring = false;
        if (s.expiry_date) {
            const daysLeft = (new Date(s.expiry_date) - today) / (1000 * 60 * 60 * 24);
            if (daysLeft <= 7 && daysLeft > 0 && isActive) isExpiring = true;
        }
        
        list.innerHTML += `
        <div class="sa-card" style="${isExpiring ? 'border-left: 4px solid var(--warning);' : ''}">
            <div class="sa-card-top">
                <div class="sa-avatar">${esc((s.owner_name || 'S').charAt(0).toUpperCase())}</div>
                <div class="sa-info">
                    <h4>${esc(s.owner_name) || 'Unknown'} <span style="font-size: 10px; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">${s.subscription_plan || 'Basic'}</span></h4>
                    <p><i class="fa-solid fa-store"></i> ${esc(s.shop_name)} • <i class="fa-solid fa-phone"></i> ${esc(s.phone) || 'N/A'}</p>
                    <div class="sa-valid" style="${isExpiring ? 'color: var(--warning);' : ''}">
                        <i class="fa-regular fa-calendar-check"></i> Valid till: ${expiryStr} ${isExpiring ? '(Expiring Soon)' : ''}
                    </div>
                </div>
                <div class="sa-toggle ${isActive ? 'active' : ''}" onclick="toggleShopStatus('${s.id}', '${s.status}')"></div>
            </div>
            <div class="sa-actions">
                <a href="tel:${esc(s.phone)}" class="sa-act-btn call"><i class="fa-solid fa-phone"></i> Call</a>
                <a href="https://wa.me/91${esc(s.phone)}" target="_blank" class="sa-act-btn wa"><i class="fa-brands fa-whatsapp"></i> WA</a>
                <button class="sa-act-btn add" onclick="add30Days('${s.id}', '${s.expiry_date}')"><i class="fa-solid fa-clock"></i> +30 Days</button>
                <button class="sa-act-btn edit" onclick="editOwner('${s.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="sa-act-btn del" onclick="askConfirm('Delete this shop completely?', () => deleteOwner('${s.id}'))"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        </div>`;
    });
}

async function exportOwnersExcel() {
    showToast("Generating Excel... ⏳", false);
    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const { data: shops, error } = await supabaseClient.from('shops').select('*');
        if (error || !shops) throw new Error("Could not fetch data.");
        
        let data = shops.map(s => ({
            "Owner Name": s.owner_name || '-',
            "Shop Name": s.shop_name || '-',
            "Phone": s.phone || '-',
            "Status": s.status,
            "Plan": s.subscription_plan || 'Basic',
            "Expiry Date": s.expiry_date ? new Date(s.expiry_date).toLocaleDateString('en-GB') : '-'
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Owners List");
        XLSX.writeFile(wb, `Owners_List_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast("Excel Downloaded! 📥", false);
    } catch(err) {
        showToast("Error: " + err.message, true);
    }
}

function openOwnerModal(mode) {
    document.getElementById('ownerModal').style.display = 'flex';
    if(mode === 'add') {
        document.getElementById('modalTitle').innerText = "Add New Owner";
        document.getElementById('editOwnerId').value = ""; document.getElementById('saOwnerName').value = ""; document.getElementById('saShopName').value = ""; document.getElementById('saPhone').value = ""; document.getElementById('saOwnerPin').value = "";
    }
}

async function editOwner(id) {
    const { data: shop } = await supabaseClient.from('shops').select('*').eq('id', id).single();
    if(shop) {
        document.getElementById('ownerModal').style.display = 'flex';
        document.getElementById('modalTitle').innerText = "Edit Owner";
        document.getElementById('editOwnerId').value = shop.id; document.getElementById('saOwnerName').value = shop.owner_name || ''; document.getElementById('saShopName').value = shop.shop_name || ''; document.getElementById('saPhone').value = shop.phone || ''; document.getElementById('saOwnerPin').value = shop.pin || '';
    }
}

async function saveOwner() {
    const id = document.getElementById('editOwnerId').value;
    const name = document.getElementById('saOwnerName').value; const shopName = document.getElementById('saShopName').value; const phone = document.getElementById('saPhone').value; const pin = document.getElementById('saOwnerPin').value;
    if(!name || !shopName || !pin) { showToast("Name, Shop Name and PIN required!", true); return; }
    if(pin.length < 6) { showToast("PIN must be at least 6 digits!", true); return; }
    if(id) {
        await supabaseClient.from('shops').update({ owner_name: name, shop_name: shopName, phone: phone, pin: pin }).eq('id', id);
        await supabaseClient.from('admin_logs').insert([{ action: `Edited owner details for: ${shopName}` }]);
        showToast("Owner Updated!", false);
    } else {
        const auth_email = `${shopName.replace(/\s+/g, '').toLowerCase()}${Date.now()}@shoeshop.com`;
        const { data: { session: adminSession } } = await supabaseClient.auth.getSession();
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email: auth_email, password: pin, options: { data: { shop_name: shopName } } });
        if (adminSession) { await supabaseClient.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token }); }
        if(authError) { showToast("Error: " + authError.message, true); return; }
        const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { error: shopError } = await supabaseClient.from('shops').insert([{ owner_name: name, shop_name: shopName, phone: phone, pin: pin, auth_email: auth_email, status: 'active', expiry_date: expiry, subscription_plan: 'Basic' }]);
        if(shopError) { showToast("Error: " + shopError.message, true); return; }
        await supabaseClient.from('admin_logs').insert([{ action: `Added new owner: ${shopName}` }]);
        showToast("Owner Added!", false);
    }
    document.getElementById('ownerModal').style.display = 'none'; loadSuperAdminData();
}

async function toggleShopStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await supabaseClient.from('shops').update({ status: newStatus }).eq('id', id);
    await supabaseClient.from('admin_logs').insert([{ action: `Marked shop ID ${id} as ${newStatus}` }]);
    showToast(`Shop marked as ${newStatus}`, false); loadSuperAdminData();
}

async function add30Days(id, currentExpiry) {
    askConfirm("Have you received the payment for +30 Days? (This will be recorded in revenue)", async () => {
        let newDate = currentExpiry ? new Date(currentExpiry) : new Date();
        if(newDate < new Date()) newDate = new Date();
        newDate.setDate(newDate.getDate() + 30);
        
        await supabaseClient.from('admin_logs').insert([{ action: `Added +30 Days to shop ID: ${id}` }]);
        await supabaseClient.from('shops').update({ 
            expiry_date: newDate.toISOString(),
            last_payment_amount: 500, 
            last_payment_date: new Date().toISOString()
        }).eq('id', id);
        
        showToast("+30 Days Added & Payment Recorded!", false); 
        loadSuperAdminData();
    });
}

async function deleteOwner(id) {
    await supabaseClient.from('shops').delete().eq('id', id);
    await supabaseClient.from('admin_logs').insert([{ action: `Deleted shop ID: ${id}` }]);
    showToast("Shop Deleted!", false); loadSuperAdminData();
}

// ---------- Admin: Manual Payment ----------
async function saveManualPayment() {
    const shopName = document.getElementById('payShopName').value.trim();
    const amount = parseInt(document.getElementById('payAmount').value);
    
    if(!shopName || !amount || amount <= 0) { 
        showToast("Enter valid shop name and amount!", true); return; 
    }

    const { data: shop, error } = await supabaseClient.from('shops').select('id, shop_name').ilike('shop_name', `%${shopName}%`).maybeSingle();
    if(!shop) { showToast("Shop not found! Check spelling.", true); return; }

    const { error: updateErr } = await supabaseClient.from('shops').update({
        last_payment_amount: amount,
        last_payment_date: new Date().toISOString()
    }).eq('id', shop.id);

    if(updateErr) { showToast("Error saving payment!", true); return; }

    await supabaseClient.from('admin_logs').insert([{ action: `Recorded manual payment of ₹${amount} for shop: ${shop.shop_name}` }]);
    showToast("✅ Payment Recorded!", false);
    
    document.getElementById('payShopName').value = '';
    document.getElementById('payAmount').value = '';
    document.getElementById('manualPayBox').style.display = 'none';
    
    loadAdminPayments();
    loadSuperAdminData();
}

async function loadAdminPayments() {
    const list = document.getElementById('adminPaymentList');
    list.innerHTML = skeleton(3);
    const { data: shops } = await supabaseClient.from('shops').select('id, shop_name, last_payment_amount, last_payment_date, subscription_plan').gt('last_payment_amount', 0).order('last_payment_date', { ascending: false });
    
    if(!shops || shops.length === 0) { list.innerHTML = emptyState('fa-receipt', 'No payments recorded yet.'); return; }
    
    list.innerHTML = '';
    shops.forEach(s => {
        list.innerHTML += `
        <div class="app-card" style="padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong style="font-size: 14px;">${esc(s.shop_name)}</strong><br>
                <span style="font-size: 11px; color: var(--text-muted);"><i class="fa-regular fa-calendar"></i> ${new Date(s.last_payment_date).toLocaleDateString('en-GB')} • ${s.subscription_plan || 'Basic'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 18px; font-weight: 800; color: var(--success);">₹${s.last_payment_amount}</div>
                <button class="btn-small btn-danger" onclick="deletePaymentRecord('${s.id}')" style="margin: 0; padding: 8px; border-radius: 8px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    });
}

async function deletePaymentRecord(shopId) {
    askConfirm("Delete this payment record? This will reset the shop's payment history.", async () => {
        const { error } = await supabaseClient.from('shops').update({ last_payment_amount: 0, last_payment_date: null }).eq('id', shopId);
        if(error) { showToast("Error deleting payment record!", true); return; }
        await supabaseClient.from('admin_logs').insert([{ action: `Deleted payment record for shop ID: ${shopId}` }]);
        showToast("Payment Record Deleted!", false);
        loadAdminPayments();
        loadSuperAdminData();
    });
}

// ---------- Admin: Announcements ----------
async function sendAnnouncement() {
    const msg = document.getElementById('adminAnnouncementText').value.trim();
    if(!msg) { showToast("Please enter a message!", true); return; }
    
    await supabaseClient.from('announcements').insert([{ message: msg }]);
    await supabaseClient.from('admin_logs').insert([{ action: `Sent announcement: "${msg.substring(0, 20)}..."` }]);
    
    document.getElementById('adminAnnouncementText').value = '';
    showToast("Announcement Sent to All!", false);
    loadAdminAnnouncements();
}

async function loadAdminAnnouncements() {
    const list = document.getElementById('adminAnnouncementList');
    const { data } = await supabaseClient.from('announcements').select('*').order('created_at', { ascending: false });
    
    if(!data || data.length === 0) { list.innerHTML = emptyState('fa-bullhorn', 'No announcements sent.'); return; }
    
    list.innerHTML = '';
    data.forEach(a => {
        list.innerHTML += `
        <div class="app-card" style="padding: 12px; margin-bottom: 10px; border-left: 4px solid var(--primary); display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <p style="margin: 0 0 8px 0; font-size: 14px;">${esc(a.message)}</p>
                <span style="font-size: 11px; color: var(--text-muted);"><i class="fa-solid fa-clock"></i> ${new Date(a.created_at).toLocaleString('en-IN')}</span>
            </div>
            <button class="btn-small btn-danger" onclick="deleteAnnouncement('${a.id}')" style="margin: 0; padding: 8px 10px; border-radius: 8px;"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
}

async function deleteAnnouncement(id) {
    askConfirm("Delete this announcement?", async () => {
        await supabaseClient.from('announcements').delete().eq('id', id);
        showToast("Announcement Deleted!", false);
        loadAdminAnnouncements();
    });
}

async function loadOwnerAnnouncements() {
    const { data } = await supabaseClient.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    const banner = document.getElementById('ownerAnnouncementBanner');
    if(banner && data && data.length > 0) {
        banner.style.display = 'block';
        banner.innerHTML = `<div style="padding: 12px; background: rgba(59, 130, 246, 0.15); border: 1px solid var(--primary); border-radius: 12px; margin-bottom: 12px; display: flex; gap: 10px; align-items: center;">
            <i class="fa-solid fa-bullhorn" style="color: var(--primary); font-size: 20px;"></i>
            <div style="flex: 1;">
                <div style="font-size: 12px; font-weight: bold; color: var(--primary); margin-bottom: 2px;">Admin Announcement</div>
                <div style="font-size: 13px; color: var(--text-light);">${esc(data[0].message)}</div>
            </div>
        </div>`;
    } else if(banner) {
        banner.style.display = 'none';
    }
}

// ---------- Admin: Logs ----------
async function loadAdminLogs() {
    const list = document.getElementById('adminLogList');
    const { data } = await supabaseClient.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50);
    
    if(!data || data.length === 0) { list.innerHTML = emptyState('fa-list-check', 'No activity logs found.'); return; }
    
    list.innerHTML = '';
    data.forEach(l => {
        list.innerHTML += `
        <div style="font-size: 13px; padding: 10px; border-bottom: 1px dashed var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span style="color: var(--primary); font-weight: 700;"><i class="fa-solid fa-circle-info"></i></span> ${esc(l.action)}<br>
                <span style="font-size: 11px; color: var(--text-muted);">${new Date(l.created_at).toLocaleString('en-IN')}</span>
            </div>
            <button class="btn-small btn-danger" onclick="deleteAdminLog('${l.id}')" style="margin: 0; padding: 6px 8px; border-radius: 6px;"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
}

async function deleteAdminLog(id) {
    askConfirm("Delete this log entry?", async () => {
        await supabaseClient.from('admin_logs').delete().eq('id', id);
        showToast("Log Deleted!", false);
        loadAdminLogs();
    });
}

// ---------- Closing, Labels, Excel, Bulk Import, WA, Hold ----------
let closingNet = 0, closingData = {};
async function loadClosing() {
    const r = dayRange(localDateStr(new Date()));
    const { data } = await supabaseClient.rpc('get_history', { p_from: r[0], p_to: r[1] });
    const H = data || {}; let s = 0, rt = 0, e = 0;
    (H.sales || []).forEach(x => s += x.total_amount); (H.returns || []).forEach(x => rt += x.refund_amount); (H.expenses || []).forEach(x => e += x.amount);
    closingNet = s - rt - e; closingData = { s, rt, e, bills: (H.sales || []).length };
    document.getElementById('clBills').innerText = closingData.bills;
    document.getElementById('clSales').innerText = '₹' + s;
    document.getElementById('clReturns').innerText = '-₹' + rt;
    document.getElementById('clExpenses').innerText = '-₹' + e;
    document.getElementById('clNet').innerText = '₹' + closingNet;
    calcClosing();
}

function calcClosing() {
    const open = parseInt(document.getElementById('clOpening').value) || 0;
    const cv = document.getElementById('clCounted').value;
    const box = document.getElementById('clDiff');
    const expected = open + closingNet;
    if (cv === '') {
        box.style.display = 'block';
        box.className = 'close-diff';
        box.innerHTML = `Expected in drawer: <b>₹${expected}</b>`;
        return;
    }
    const diff = (parseInt(cv) || 0) - expected;
    box.style.display = 'block';
    box.className = 'close-diff ' + (diff === 0 ? 'ok' : (diff > 0 ? 'more' : 'less'));
    box.innerHTML = `Expected in drawer: <b>₹${expected}</b><br><br>` + (diff === 0 ? '✅ Cash matches' : (diff > 0 ? `⬆ ₹${diff} extra` : `⬇ ₹${Math.abs(diff)} short`));
}

function shareClosingWA() {
    const shop = currentShopName || 'Shop';
    const open = parseInt(document.getElementById('clOpening').value) || 0;
    const cv = document.getElementById('clCounted').value;
    let t = `🔒 *${shop} - Today's Summary*\n${new Date().toLocaleDateString('en-IN')}\n------------------------\nBills: ${closingData.bills}\nSales: ₹${closingData.s}\nReturns: -₹${closingData.rt}\nExpenses: -₹${closingData.e}\n*Net: ₹${closingNet}*\n------------------------\nOpening: ₹${open}\nExpected: ₹${open + closingNet}`;
    if (cv !== '') t += `\nCounted: ₹${cv}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
}

async function loadLabels() {
    loadScript(JSPDF_URL).catch(() => {}); // preload so PDF is quick
    document.getElementById('labList').innerHTML = skeleton(2);
    const { data, error } = await supabaseClient.from('articles').select('id, article_no, name, mrp, stock_batches (color, size, remaining_qty)').eq('shop_id', currentShopId).order('article_no');
    if (error) { document.getElementById('labList').innerHTML = `<div class="hist-empty">Error: ${esc(error.message)}</div>`; return; }
    labelArticles = data || [];
    document.getElementById('labelSheet').innerHTML = '';
    renderLabelList();
}

let labelArticles = [], labSel = new Set();
function labStock(a) { return (a.stock_batches || []).reduce((s, b) => s + b.remaining_qty, 0); }
function renderLabelList() {
    const q = (document.getElementById('labSearch').value || '').toLowerCase();
    const rows = labelArticles.filter(a => !q || String(a.article_no).toLowerCase().includes(q) || String(a.name || '').toLowerCase().includes(q));
    document.getElementById('labList').innerHTML = rows.length ? rows.map(a => `
        <label class="lab-row"><input type="checkbox" ${labSel.has(a.id) ? 'checked' : ''} onchange="toggleLab('${esc(a.id)}', this.checked)">
        <span class="lab-name">[${esc(a.article_no)}] ${esc(a.name || '')}</span><small>${labStock(a)} pairs${a.mrp ? ' • ₹' + a.mrp : ''}</small></label>`).join('')
        : emptyState('fa-box-open', 'No articles found');
    updateLabCount();
}
function toggleLab(id, on) { if (on) labSel.add(id); else labSel.delete(id); updateLabCount(); }
function labSelectAll(on) {
    const q = (document.getElementById('labSearch').value || '').toLowerCase();
    labelArticles.filter(a => !q || String(a.article_no).toLowerCase().includes(q) || String(a.name || '').toLowerCase().includes(q))
        .forEach(a => on ? labSel.add(a.id) : labSel.delete(a.id));
    renderLabelList();
}
function updateLabCount() { document.getElementById('labCount').innerText = `${labSel.size} article(s) selected`; }

function labQrSvg(text) {
    if (typeof qrcode === 'undefined') return null;
    const qr = qrcode(0, 'M'); qr.addData(String(text)); qr.make();
    const n = qr.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
function labBarSvg(text) {
    if (typeof JsBarcode === 'undefined') return null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, String(text), { format: 'CODE128', displayValue: false, height: 50, margin: 4, width: 2 });
    const w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
    if (!svg.getAttribute('viewBox') && w && h) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.removeAttribute('width'); svg.removeAttribute('height');
    return svg.outerHTML;
}
function getLabelItems() {
    const type = document.getElementById('labType').value, size = document.getElementById('labSize').value;
    const mode = document.getElementById('labMode').value;
    const copies = Math.max(1, Math.min(100, parseInt(document.getElementById('labCopies').value) || 1));
    const showMrp = document.getElementById('labShowMrp').checked, showName = document.getElementById('labShowName').checked;
    const items = [];
    labelArticles.filter(a => labSel.has(a.id)).forEach(a => {
        if (mode === 'copies') { for (let k = 0; k < copies; k++) items.push({ a, color: '', size: '' }); }
        else {
            const agg = {};
            (a.stock_batches || []).forEach(b => { if (b.remaining_qty > 0) { let col = b.color || ''; if (col === 'Default') col = ''; const k = col + '|||' + String(b.size).trim(); agg[k] = (agg[k] || 0) + b.remaining_qty; } });
            Object.keys(agg).forEach(k => { const [col, sz] = k.split('|||'); for (let n = 0; n < agg[k]; n++) items.push({ a, color: col, size: sz }); });
        }
    });
    if (!items.length) { showToast('Select at least one article (with stock for "per pair" mode)', true); return false; }
    if (items.length > 500) { showToast('Too many labels (' + items.length + '). Select fewer articles.', true); return false; }
    return { items, type, size, showMrp, showName };
}
function buildLabels() {
    const cfg = getLabelItems(); if (!cfg) return false;
    const { items, type, size, showMrp, showName } = cfg;
    const make = type === 'qr' ? labQrSvg : labBarSvg;
    const svgCache = {};
    let html = '';
    for (const it of items) {
        const key = it.a.article_no;
        if (!(key in svgCache)) svgCache[key] = make(key);
        if (!svgCache[key]) { showToast('Label library failed to load. Check internet and reload.', true); return false; }
        const meta = [it.color, it.size ? 'S' + it.size : ''].filter(Boolean).join(' • ');
        html += `<div class="lbl ${type}"><div class="lbl-code">${svgCache[key]}</div><div class="lbl-info">
            <b class="lbl-shop">${esc(currentShopName)}</b>
            ${showName && it.a.name ? `<span class="lbl-name">${esc(it.a.name)}</span>` : ''}
            <span class="lbl-no">#${esc(it.a.article_no)}</span>
            ${meta ? `<span class="lbl-meta">${esc(meta)}</span>` : ''}
            ${showMrp && it.a.mrp ? `<b class="lbl-mrp">MRP ₹${it.a.mrp}</b>` : ''}</div></div>`;
    }
    const sheet = document.getElementById('labelSheet');
    sheet.className = 'label-sheet ' + size;
    sheet.innerHTML = html;
    let ps = document.getElementById('labPageStyle');
    if (!ps) { ps = document.createElement('style'); ps.id = 'labPageStyle'; document.head.appendChild(ps); }
    if (size === 'roll50') ps.textContent = '@media print { @page { size: 50mm 30mm; margin: 0; } body { margin: 0; } #labelSheet { position: static !important; gap: 0; } }';
    else if (size === 'roll38') ps.textContent = '@media print { @page { size: 38mm 25mm; margin: 0; } body { margin: 0; } #labelSheet { position: static !important; gap: 0; } }';
    else ps.textContent = '@media print { @page { size: A4; margin: 5mm; } body { margin: 0; } #labelSheet { position: static !important; } }';
    return items.length;
}

// ---------- Labels -> real PDF file (vector QR / barcode) ----------
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
// PDF built-in fonts cannot show Marathi / ₹, so keep plain characters only
function pdfTxt(s) { return String(s == null ? '' : s).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim(); }

function pdfDrawQr(doc, text, x, y, size) {
    const qr = qrcode(0, 'M'); qr.addData(String(text)); qr.make();
    const n = qr.getModuleCount(), quiet = 2, u = size / (n + quiet * 2);
    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) doc.rect(x + (c + quiet) * u, y + (r + quiet) * u, u + 0.01, u + 0.01, 'F');
    }
}

function pdfDrawBar(doc, text, x, y, w, h) {
    const o = {}; JsBarcode(o, String(text), { format: 'CODE128' });
    const bits = o.encodings && o.encodings[0] && o.encodings[0].data;
    if (!bits) throw new Error('Barcode could not be created for ' + text);
    const quiet = 1.5, mw = (w - quiet * 2) / bits.length;
    doc.setFillColor(0, 0, 0);
    let i = 0;
    while (i < bits.length) {
        if (bits[i] === '1') { let j = i; while (j < bits.length && bits[j] === '1') j++; doc.rect(x + quiet + i * mw, y, (j - i) * mw + 0.005, h, 'F'); i = j; }
        else i++;
    }
}

function pdfDrawLabel(doc, cfg, it, x0, y0, w, h, border) {
    const { type, size, showMrp, showName, shop } = cfg;
    const small = size === 'roll38';
    if (border) { doc.setDrawColor(170); doc.setLineWidth(0.15); doc.setLineDashPattern([0.8, 0.8], 0); doc.rect(x0, y0, w, h); doc.setLineDashPattern([], 0); }
    const pad = 1.5;
    const meta = [pdfTxt(it.color), it.size ? 'S' + pdfTxt(it.size) : ''].filter(Boolean).join(' / ');
    const name = showName ? pdfTxt(it.a.name) : '';
    const mrp = showMrp && it.a.mrp ? 'MRP Rs.' + it.a.mrp : '';
    const lines = (availW, center) => {
        const L = [];
        const push = (txt, pt, bold, prio) => { if (txt) L.push({ txt, pt, bold, prio }); };
        doc.setFont('helvetica', 'normal'); doc.setFontSize(small ? 5 : 6);
        push(doc.splitTextToSize(pdfTxt(shop).toUpperCase(), availW)[0], small ? 5 : 6, false, 1);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(small ? 6.5 : 8);
        const nm = name ? doc.splitTextToSize(name, availW).slice(0, 2) : [];
        nm.forEach((s, k) => push(s, small ? 6.5 : 8, true, k === 0 ? 4 : 2));
        push('#' + pdfTxt(it.a.article_no), small ? 6.5 : 8, false, 5);
        push(meta, small ? 6.5 : 8, true, 3);
        push(mrp, small ? 8 : 10, true, 6);
        return L;
    };
    const fit = (L, availH) => {
        const hOf = l => l.pt * 0.3528 * 1.2;
        let total = L.reduce((s, l) => s + hOf(l), 0);
        while (total > availH && L.length > 1) {
            let mi = 0; L.forEach((l, i) => { if (l.prio < L[mi].prio) mi = i; });
            total -= hOf(L[mi]); L.splice(mi, 1);
        }
        return { L, total, hOf };
    };
    const draw = (L, total, hOf, x, y, align) => {
        let cy = y;
        L.forEach(l => { doc.setFont('helvetica', l.bold ? 'bold' : 'normal'); doc.setFontSize(l.pt); doc.setTextColor(0); doc.text(l.txt, x, cy, { baseline: 'top', align }); cy += hOf(l); });
    };
    if (type === 'qr') {
        const q = small ? 18 : 24, qy = y0 + (h - q) / 2;
        pdfDrawQr(doc, it.a.article_no, x0 + pad, qy, q);
        const tx = x0 + pad + q + 1.5, tw = w - pad * 2 - q - 1.5;
        const f = fit(lines(tw), h - pad * 2);
        draw(f.L, f.total, f.hOf, tx, y0 + (h - f.total) / 2, 'left');
    } else {
        const bh = small ? 8 : 11;
        pdfDrawBar(doc, it.a.article_no, x0 + pad, y0 + pad, w - pad * 2, bh);
        const avail = h - pad * 2 - bh - 0.8;
        const f = fit(lines(w - pad * 2), avail);
        draw(f.L, f.total, f.hOf, x0 + w / 2, y0 + pad + bh + 0.8, 'center');
    }
}

async function buildLabelsPdf() {
    const cfg = getLabelItems(); if (!cfg) return null;
    cfg.shop = currentShopName || '';
    await loadScript(JSPDF_URL);
    if (!window.jspdf) throw new Error('PDF library failed to load. Check internet and try again.');
    const { jsPDF } = window.jspdf;
    const { items, size } = cfg;
    let doc;
    if (size === 'a4') {
        doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const cw = 60, ch = 30, gap = 2, cols = 3, rows = 8;
        const x0 = (210 - (cols * cw + (cols - 1) * gap)) / 2, y0 = 8;
        items.forEach((it, i) => {
            const pos = i % (cols * rows);
            if (i > 0 && pos === 0) doc.addPage('a4', 'portrait');
            const r = Math.floor(pos / cols), c = pos % cols;
            pdfDrawLabel(doc, cfg, it, x0 + c * (cw + gap), y0 + r * (ch + gap), cw, ch, true);
        });
    } else {
        const w = size === 'roll38' ? 38 : 50, h = size === 'roll38' ? 25 : 30;
        doc = new jsPDF({ unit: 'mm', format: [w, h], orientation: 'landscape' });
        items.forEach((it, i) => { if (i > 0) doc.addPage([w, h], 'landscape'); pdfDrawLabel(doc, cfg, it, 0, 0, w, h, false); });
    }
    const name = `Labels_${new Date().toISOString().split('T')[0]}.pdf`;
    return new File([doc.output('blob')], name, { type: 'application/pdf' });
}

async function labelsPdfAction(btn, share) {
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating PDF...'; btn.disabled = true;
    try {
        const file = await buildLabelsPdf();
        if (!file) return;
        if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: 'Labels' }); }
            catch (e) { if (e && e.name === 'AbortError') return; saveFileToDevice(file); showToast('Share blocked. PDF saved to device.', false); }
        } else {
            saveFileToDevice(file);
            showToast(share ? 'Sharing not supported here. PDF saved to device.' : 'PDF saved to device', false);
        }
    } catch (err) { showToast('Error: ' + err.message, true); }
    finally { btn.innerHTML = original; btn.disabled = false; }
}
function downloadLabelsPdf(btn) { return labelsPdfAction(btn, false); }
function shareLabelsPdf(btn) { return labelsPdfAction(btn, true); }

function clearLabelPreview() { document.getElementById('labelSheet').innerHTML = ''; showToast("Label Preview Cleared!", false); }
function previewLabels() { const n = buildLabels(); if (n) { showToast(n + ' label(s) ready', false); document.getElementById('labelSheet').scrollIntoView({ behavior: 'smooth' }); } }
function printLabels() { document.body.classList.remove('printing-bill'); if (buildLabels()) { setTimeout(() => { window.print(); }, 500); } }

async function downloadExcel() {
    if(!currentShopId) return;
    showToast("Generating Excel... ⏳", false);
    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const { data: allData } = await supabaseClient.from('sales').select(`sale_date, total_amount, total_profit, sale_items (quantity, size, selling_price, articles(article_no, name))`).eq('shop_id', currentShopId).order('sale_date', { ascending: false });
        let excelData = [];
        if(allData) {
            allData.forEach(s => {
                if(s.sale_items) {
                    s.sale_items.forEach(item => {
                        excelData.push({ Date: new Date(s.sale_date).toLocaleDateString(), "Article No": item.articles?.article_no || 'DELETED', "Name": item.articles?.name || '-', "Size": item.size, "Qty": item.quantity, "Total Amount": s.total_amount, "Profit": s.total_profit });
                    });
                }
            });
        }
        if(excelData.length === 0) { showToast("No data to export!", true); return; }
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
        XLSX.writeFile(wb, "Sales_Report.xlsx");
        showToast("Excel Downloaded! 📥", false);
    } catch (err) { showToast("Error: " + err.message, true); }
}

// Reads every row of a table for this shop (a single request returns at most 1000 rows)
async function fetchAllRows(table, columns) {
    const out = [], size = 1000;
    for (let from = 0; ; from += size) {
        let res = await supabaseClient.from(table).select(columns).eq('shop_id', currentShopId).order('id').range(from, from + size - 1);
        if (res.error) res = await supabaseClient.from(table).select(columns).eq('shop_id', currentShopId).range(from, from + size - 1);
        if (res.error) throw res.error;
        out.push(...(res.data || []));
        if (!res.data || res.data.length < size) break;
    }
    return out;
}

async function downloadFullBackup() {
    if (!currentShopId) return;
    showToast("Preparing backup... ⏳", false);
    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const all = (table, cols) => fetchAllRows(table, cols).then(data => ({ data }));
        const [articlesRes, salesRes, returnsRes, expensesRes, creditsRes, purchasesRes] = await Promise.all([
            all('articles', 'article_no, name, category, cost_price, mrp, stock_batches(color, size, initial_qty, remaining_qty)'),
            all('sales', 'sale_date, total_amount, total_profit, discount_amount, sale_items(quantity, size, selling_price, articles(article_no, name))'),
            all('returns', 'return_date, quantity, refund_amount, size, articles(article_no, name)'),
            all('expenses', 'expense_date, reason, amount'),
            all('credits', 'created_at, customer_name, phone, amount, status'),
            all('purchases', 'purchase_date, quantity, cost_price, size, supplier_name, articles(article_no, name)')
        ]);
        const wb = XLSX.utils.book_new();
        let stockData = [];
        (articlesRes.data || []).forEach(art => {
            (art.stock_batches || []).forEach(batch => {
                stockData.push({ "Article No": art.article_no, "Name": art.name, "Category": art.category, "Color": batch.color || '-', "Size": batch.size, "Initial Stock": batch.initial_qty, "Remaining Stock": batch.remaining_qty, "Cost Price": art.cost_price, "MRP": art.mrp });
            });
        });
        if(stockData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockData), "Stock Details");
        let salesData = [];
        (salesRes.data || []).forEach(sale => {
            (sale.sale_items || []).forEach(item => {
                salesData.push({ "Date": new Date(sale.sale_date).toLocaleString(), "Article No": item.articles?.article_no || 'DELETED', "Name": item.articles?.name || '-', "Size": item.size, "Qty": item.quantity, "Selling Price": item.selling_price, "Total Amount": sale.total_amount, "Profit": sale.total_profit, "Bill Discount": sale.discount_amount });
            });
        });
        if(salesData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), "Sales History");
        let returnsData = (returnsRes.data || []).map(ret => ({ "Date": new Date(ret.return_date).toLocaleString(), "Article No": ret.articles?.article_no || 'DELETED', "Name": ret.articles?.name || '-', "Size": ret.size, "Qty": ret.quantity, "Refund Amount": ret.refund_amount }));
        if(returnsData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(returnsData), "Returns");
        let expensesData = (expensesRes.data || []).map(exp => ({ "Date": new Date(exp.expense_date).toLocaleString(), "Reason": exp.reason, "Amount": exp.amount }));
        if(expensesData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expensesData), "Expenses");
        let creditsData = (creditsRes.data || []).map(cred => ({ "Date": new Date(cred.created_at).toLocaleString(), "Customer": cred.customer_name, "Phone": cred.phone, "Amount": cred.amount, "Status": cred.status }));
        if(creditsData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(creditsData), "Credit Ledger");
        let purchasesData = (purchasesRes.data || []).map(pur => ({ "Date": new Date(pur.purchase_date).toLocaleString(), "Article No": pur.articles?.article_no || 'DELETED', "Name": pur.articles?.name || '-', "Size": pur.size, "Qty": pur.quantity, "Cost": pur.cost_price, "Supplier": pur.supplier_name }));
        if(purchasesData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchasesData), "Purchases");
        if (wb.SheetNames.length === 0) { showToast("No data available for backup!", true); return; }
        XLSX.writeFile(wb, `SJ_Labs_Full_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
        localStorage.setItem('lastBackup', String(Date.now()));
        showToast("✅ Full Backup downloaded successfully!", false);
    } catch (err) { showToast("Backup error: " + err.message, true); }
}

function normGender(g) {
    const v = String(g || '').trim().toLowerCase();
    if (['ladies', 'lady', 'women', 'woman', 'female'].includes(v)) return 'Ladies';
    if (['boys', 'boy', 'kids', 'kid'].includes(v)) return 'Boys';
    if (['girls', 'girl'].includes(v)) return 'Girls';
    return 'Men';
}
function normType(t, gender) {
    const list = (gender === 'Boys' || gender === 'Girls') ? ['School', 'Sport', 'Chappal', 'Sandal', 'Slippers'] : ['Formal', 'Sport', 'Chappal', 'Sandal', 'Slippers'];
    const hit = list.find(x => x.toLowerCase() === String(t || '').trim().toLowerCase());
    return hit || list[0];
}

function downloadImportTemplate() {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(() => {
        const headers = [["Gender", "Type", "Article No", "Name", "Cost Price", "MRP", "Color", "Size", "Qty"]];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Bulk_Import_Template.xlsx");
    }).catch(err => showToast("Error loading excel library", true));
}

async function processExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const statusDiv = document.getElementById('importStatus');
    statusDiv.innerHTML = '<span style="color:var(--warning);"><i class="fa-solid fa-spinner fa-spin"></i> Reading Excel...</span>';
    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet);
                if (json.length === 0) throw new Error("Excel file is empty!");
                let successCount = 0, errorCount = 0;
                for (let i = 0; i < json.length; i++) {
                    const row = json[i];
                    const artNo = String(row['Article No'] || '').trim();
                    const size = String(row['Size'] || '').trim();
                    const qty = parseInt(row['Qty']) || 0;
                    if (!artNo || !size || qty <= 0) { errorCount++; continue; }
                    const gender = normGender(row['Gender']); const type = normType(row['Type'], gender); const name = row['Name'] || 'Unnamed'; const cost = parseInt(row['Cost Price']) || 0; const mrp = parseInt(row['MRP']) || 0; const color = String(row['Color'] || '').trim(); const category = `${gender} - ${type}`;
                    let { data: artData } = await supabaseClient.from('articles').select('id').eq('shop_id', currentShopId).eq('article_no', artNo).maybeSingle();
                    let articleId;
                    if (!artData) {
                        const { data: newArt, error: artErr } = await supabaseClient.from('articles').insert([{ shop_id: currentShopId, article_no: artNo, name: name, category: category, cost_price: cost, mrp: mrp }]).select();
                        if (artErr) { errorCount++; continue; }
                        articleId = newArt[0].id;
                    } else { articleId = artData.id; }
                    let query = supabaseClient.from('stock_batches').select('id, remaining_qty, initial_qty').eq('shop_id', currentShopId).eq('article_id', articleId).eq('size', size);
                    if(color) query = query.eq('color', color); else query = query.or('color.is.null,color.eq.Default,color.eq.');
                    const { data: batch } = await query.limit(1).maybeSingle();
                    if (batch) { await supabaseClient.from('stock_batches').update({ remaining_qty: batch.remaining_qty + qty, initial_qty: batch.initial_qty + qty }).eq('id', batch.id); } 
                    else { await supabaseClient.from('stock_batches').insert([{ shop_id: currentShopId, article_id: articleId, size: size, color: color, initial_qty: qty, remaining_qty: qty, cost_price: cost }]); }
                    successCount++;
                }
                statusDiv.innerHTML = `<span style="color:var(--success);">✅ Success: ${successCount} rows added. ${errorCount > 0 ? '<br><span style="color:var(--danger);">Errors: ' + errorCount + ' (check data)</span>' : ''}</span>`;
                event.target.value = ''; 
                showToast(`Bulk Import Complete! ${successCount} rows added.`, false);
                if (typeof loadDashboardData === 'function') loadDashboardData();
            } catch (err) {
                statusDiv.innerHTML = `<span style="color:var(--danger);">❌ Error: ${err.message}</span>`;
                showToast("Error parsing file: " + err.message, true);
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (error) { statusDiv.innerHTML = `<span style="color:var(--danger);">❌ Error loading library</span>`; }
}

async function shareLowStockWA() {
    const { data, error } = await supabaseClient.from('articles').select('article_no, name, stock_batches (remaining_qty)').eq('shop_id', currentShopId);
    if (error) { showToast('Error: ' + error.message, true); return; }
    const low = (data || []).map(a => ({ a, total: (a.stock_batches || []).reduce((s, b) => s + b.remaining_qty, 0) })).filter(x => x.total <= 2).sort((x, y) => x.total - y.total);
    if (!low.length) { showToast('No low stock articles 👍', false); return; }
    let t = `⚠️ *Low Stock - ${currentShopName || 'Shop'}*\n${new Date().toLocaleDateString('en-IN')}\n------------------------\n`;
    low.forEach(x => { t += `${x.a.article_no} ${x.a.name || ''} - ${x.total === 0 ? 'OUT OF STOCK' : x.total + ' left'}\n`; });
    t += `------------------------\nTotal: ${low.length} article(s)`;
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
}

function heldKey() { return 'heldBills_' + currentShopId; }
function getHeld() { try { return JSON.parse(localStorage.getItem(heldKey()) || '[]'); } catch (e) { return []; } }
function setHeld(a) { try { localStorage.setItem(heldKey(), JSON.stringify(a)); } catch (e) { showToast('Could not save held bill', true); } updateHeldCount(); }
function updateHeldCount() { const el = document.getElementById('heldCount'); if (el) { const n = getHeld().length; el.innerText = n ? `(${n})` : ''; } }
function holdBill() {
    if (!cart.length) { showToast('Add items to the bill first', true); return; }
    const held = getHeld();
    if (held.length >= 5) { showToast('Maximum 5 held bills', true); return; }
    held.push({ t: Date.now(), cart: cart, name: document.getElementById('saleCustName').value, phone: document.getElementById('saleCustPhone').value, discount: document.getElementById('saleDiscount').value, pct: discountPct });
    setHeld(held);
    cart = []; discountPct = 0; renderCart();
    document.getElementById('saleCustName').value = ''; document.getElementById('saleCustPhone').value = ''; document.getElementById('saleDiscount').value = 0;
    showToast('Bill held ⏸', false);
}
function openHeld() {
    const held = getHeld();
    document.getElementById('heldList').innerHTML = held.length ? held.map((b, i) => {
        const items = b.cart.reduce((s, c) => s + c.qty, 0), total = b.cart.reduce((s, c) => s + c.qty * c.price, 0);
        return `<div class="held-row"><span>${items} pair(s) • ₹${total}<small>${esc(b.name || 'No customer')} • ${new Date(b.t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small></span>
            <span style="display:flex; gap:6px;"><button class="btn-success" onclick="resumeHeld(${i})">Resume</button><button class="btn-danger" onclick="deleteHeld(${i})"><i class="fa-solid fa-trash"></i> Delete</button></span></div>`;
    }).join('') : emptyState('fa-pause', 'No held bills');
    document.getElementById('heldModal').style.display = 'flex';
}
function closeHeld() { document.getElementById('heldModal').style.display = 'none'; }
function resumeHeld(i) {
    if (cart.length) { showToast('Finish or hold the current bill first', true); return; }
    const held = getHeld(); const b = held.splice(i, 1)[0]; if (!b) return;
    setHeld(held);
    cart = b.cart;
    document.getElementById('saleCustName').value = b.name || ''; document.getElementById('saleCustPhone').value = b.phone || ''; document.getElementById('saleDiscount').value = b.discount || 0;
    discountPct = b.pct || 0;
    renderCart(); closeHeld(); showToast('Bill resumed', false);
}
function deleteHeld(i) { const held = getHeld(); held.splice(i, 1); setHeld(held); openHeld(); }

let idleTimer;
const IDLE_MS = 10 * 60 * 1000;
function resetIdle() {
    clearTimeout(idleTimer);
    if (!currentShopId) return;
    idleTimer = setTimeout(() => {
        if (!currentShopId) return;
        if (cart.length > 0) { resetIdle(); return; }
        showToast('Logged out due to inactivity', true);
        handleLogout();
    }, IDLE_MS);
}
['click', 'touchstart', 'keydown', 'scroll'].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));
