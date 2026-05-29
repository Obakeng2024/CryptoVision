let allCoins = [];
let marketCapChart = null;
let gainersChart = null;
let updateInterval = null;

async function fetchCryptoData() {
    showLoading(true);
    try {
        const response = await fetch(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h'
        );
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        allCoins = data.map(coin => ({
            id: coin.id,
            rank: coin.market_cap_rank,
            name: coin.name,
            symbol: coin.symbol.toUpperCase(),
            image: coin.image,
            current_price: coin.current_price,
            market_cap: coin.market_cap,
            total_volume: coin.total_volume,
            price_change_percentage_24h: coin.price_change_percentage_24h,
            high_24h: coin.high_24h,
            low_24h: coin.low_24h,
            ath: coin.ath,
            ath_change_percentage: coin.ath_change_percentage
        }));
        
        updateGlobalStats(data);
        updateCharts();
        renderCryptoGrid();
        startAutoRefresh();
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('cryptoGrid').innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:3rem; background: var(--bg-card); border-radius:20px;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem; color: var(--warning);"></i>
                <p style="margin-top:1rem;">Unable to load crypto data. Please check your internet connection and refresh.</p>
                <button onclick="location.reload()" style="margin-top:1rem; padding:0.7rem 1.5rem; background: var(--primary); border:none; border-radius:10px; color:white; cursor:pointer;">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
        document.getElementById('totalCoins').textContent = '0';
        document.getElementById('totalMarketCap').textContent = '$0';
        document.getElementById('totalVolume').textContent = '$0';
        document.getElementById('btcDominance').textContent = '0%';
    } finally {
        showLoading(false);
    }
}

function updateGlobalStats(data) {
    document.getElementById('totalCoins').textContent = data.length;
    
    const totalMarketCap = data.reduce((sum, coin) => sum + coin.market_cap, 0);
    document.getElementById('totalMarketCap').textContent = formatCurrency(totalMarketCap);
    
    const totalVolume = data.reduce((sum, coin) => sum + coin.total_volume, 0);
    document.getElementById('totalVolume').textContent = formatCurrency(totalVolume);
    
    const btcData = data.find(c => c.symbol === 'btc');
    if (btcData) {
        const dominance = (btcData.market_cap / totalMarketCap * 100).toFixed(1);
        document.getElementById('btcDominance').textContent = `${dominance}%`;
    }
}

function getTop10ByMarketCap() {
    return allCoins.slice(0, 10);
}

function getTopGainers() {
    return [...allCoins]
        .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
        .slice(0, 6);
}

function updateCharts() {
    const top10 = getTop10ByMarketCap();
    if (marketCapChart) marketCapChart.destroy();
    
    const ctxPie = document.getElementById('marketCapChart').getContext('2d');
    marketCapChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: top10.map(c => c.symbol),
            datasets: [{
                data: top10.map(c => c.market_cap),
                backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { color: '#94a3b8', font: { size: 11 } }
                },
                tooltip: { 
                    callbacks: { 
                        label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}`
                    }
                }
            }
        }
    });
    
    const gainers = getTopGainers();
    if (gainersChart) gainersChart.destroy();
    
    const ctxBar = document.getElementById('gainersChart').getContext('2d');
    gainersChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: gainers.map(c => c.symbol),
            datasets: [{
                label: '24h Change (%)',
                data: gainers.map(c => c.price_change_percentage_24h),
                backgroundColor: gainers.map(c => c.price_change_percentage_24h >= 0 ? '#10b981' : '#ef4444'),
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { display: false },
                tooltip: { 
                    callbacks: { 
                        label: (ctx) => `${ctx.raw.toFixed(2)}%`
                    }
                }
            },
            scales: { 
                y: { 
                    ticks: { color: '#94a3b8', callback: (v) => v + '%' }, 
                    grid: { color: '#1e293b' } 
                }, 
                x: { 
                    ticks: { color: '#94a3b8' }, 
                    grid: { display: false } 
                }
            }
        }
    });
}

function filterAndSort() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sortBy = document.getElementById('sortFilter').value;
    
    let filtered = allCoins.filter(coin => 
        coin.name.toLowerCase().includes(searchTerm) || 
        coin.symbol.toLowerCase().includes(searchTerm)
    );
    
    switch(sortBy) {
        case 'price-desc':
            filtered.sort((a, b) => b.current_price - a.current_price);
            break;
        case 'price-asc':
            filtered.sort((a, b) => a.current_price - b.current_price);
            break;
        case 'change-desc':
            filtered.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
            break;
        case 'change-asc':
            filtered.sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h);
            break;
        default:
            filtered.sort((a, b) => a.rank - b.rank);
    }
    
    document.getElementById('resultCount').textContent = `Showing ${filtered.length} of ${allCoins.length} coins`;
    renderCryptoGrid(filtered);
}

function renderCryptoGrid(coinsList = null) {
    const coins = coinsList || allCoins;
    const grid = document.getElementById('cryptoGrid');
    
    if (!coins.length) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem;">No cryptocurrencies found</div>';
        return;
    }
    
    grid.innerHTML = coins.map(coin => `
        <div class="crypto-card" onclick="showCoinDetails('${coin.id}')">
            <div class="card-header">
                <img src="${coin.image}" alt="${coin.name}" class="crypto-icon" onerror="this.src='https://via.placeholder.com/48?text=💰'">
                <div class="crypto-name">
                    <h3>${escapeHtml(coin.name)}</h3>
                    <div class="crypto-symbol">${coin.symbol}</div>
                </div>
                <div style="margin-left: auto; font-size:0.8rem; color:var(--text-secondary);">#${coin.rank}</div>
            </div>
            <div class="price-info">
                <span class="current-price">${formatCurrency(coin.current_price)}</span>
                <span class="price-change ${coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">
                    ${coin.price_change_percentage_24h >= 0 ? '+' : ''}${coin.price_change_percentage_24h?.toFixed(2)}%
                </span>
            </div>
            <div class="market-stats">
                <span><i class="fas fa-chart-line"></i> Market Cap: ${formatCompact(coin.market_cap)}</span>
                <span><i class="fas fa-chart-simple"></i> 24h Vol: ${formatCompact(coin.total_volume)}</span>
            </div>
        </div>
    `).join('');
}

async function showCoinDetails(coinId) {
    showLoading(true);
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}`);
        if (!response.ok) throw new Error('Failed to fetch details');
        const data = await response.json();
        
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div style="text-align: center;">
                <img src="${data.image.large}" style="width: 100px; margin-bottom: 1rem;" onerror="this.src='https://via.placeholder.com/100?text=💰'">
                <h2 style="margin-bottom: 0.5rem;">${escapeHtml(data.name)} (${data.symbol.toUpperCase()})</h2>
                <div style="background: rgba(59,130,246,0.1); padding: 1rem; border-radius: 12px; margin: 1rem 0;">
                    <p style="font-size: 2rem; font-weight: 700;">${formatCurrency(data.market_data.current_price.usd)}</p>
                    <p class="${data.market_data.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}" style="display: inline-block; padding: 0.2rem 0.8rem; border-radius: 20px;">
                        24h Change: ${data.market_data.price_change_percentage_24h?.toFixed(2)}%
                    </p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0;">
                    <div>
                        <p style="color: var(--text-secondary); font-size:0.8rem;">Market Cap</p>
                        <p style="font-weight: 600;">${formatCurrency(data.market_data.market_cap.usd)}</p>
                    </div>
                    <div>
                        <p style="color: var(--text-secondary); font-size:0.8rem;">24h Volume</p>
                        <p style="font-weight: 600;">${formatCurrency(data.market_data.total_volume.usd)}</p>
                    </div>
                    <div>
                        <p style="color: var(--text-secondary); font-size:0.8rem;">All-Time High</p>
                        <p style="font-weight: 600;">${formatCurrency(data.market_data.ath.usd)}</p>
                    </div>
                    <div>
                        <p style="color: var(--text-secondary); font-size:0.8rem;">Circulating Supply</p>
                        <p style="font-weight: 600;">${formatCompact(data.market_data.circulating_supply)}</p>
                    </div>
                </div>
                ${data.description?.en ? `<p style="margin: 1rem 0; font-size:0.85rem; color:var(--text-secondary);">${data.description.en.substring(0, 200)}...</p>` : ''}
                <a href="${data.links.homepage[0] || '#'}" target="_blank" style="display: inline-block; margin-top: 1rem; background: var(--primary); color: white; padding: 0.7rem 1.5rem; border-radius: 10px; text-decoration: none;">
                    <i class="fas fa-external-link-alt"></i> Visit Website
                </a>
            </div>
        `;
        document.getElementById('modal').classList.add('active');
    } catch (error) {
        console.error('Error fetching details:', error);
        alert('Failed to load coin details. Please try again.');
    } finally {
        showLoading(false);
    }
}

function formatCurrency(value) {
    if (!value || value === 0) return '$0';
    if (value < 1) return `$${value.toFixed(4)}`;
    if (value < 1000) return `$${value.toFixed(2)}`;
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatCompact(value) {
    if (!value) return '0';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toLocaleString()}`;
}

function startAutoRefresh() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => { 
        fetchCryptoData(); 
    }, 60000);
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (show) loader.classList.add('active');
    else loader.classList.remove('active');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('searchInput').addEventListener('input', filterAndSort);
document.getElementById('sortFilter').addEventListener('change', filterAndSort);

window.onclick = (e) => {
    const modal = document.getElementById('modal');
    if (e.target === modal) closeModal();
};

fetchCryptoData();