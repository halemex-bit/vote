// Worker API Configuration
const WORKER_BASE_URL = 'https://my-vote-api.ahal3ms.workers.dev/';

async function callWorker(endpoint, payload = {}) {
    try {
        const response = await fetch(WORKER_BASE_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Worker error: ${response.status}`);
        const text = await response.text();
        try { return JSON.parse(text); } catch { return text; }
    } catch (error) {
        console.error('Worker API Error:', error);
        throw error;
    }
}

// Storage upload function
async function uploadReceipt(fileName, fileData) {
    return await callWorker('upload-receipt', { fileName: fileName, fileData: fileData });
}

async function fetchTikTokOEmbed(url) {
    try {
        const response = await fetch(`https://www.tiktok.com/oembed?url=${url}`);
        const data = await response.json();
        return data.thumbnail_url;
    } catch (e) {
        console.error("OEmbed Error", e);
        return null;
    }
}

// --- GLOBAL STATE ---
let currentLang = 'my';
let globalFeedData = [];
let votedBooths = [];
let currentVotes = 0;
let dbAnnouncement = [];
let chartInstances = {};
const MAX_VOTES = 5;
let html5QrCode; // Scanner Instance

// --- LANGUAGE SYSTEM ---
const langData = {
    'my': {
        'login_sub': 'Undian & komen ikhlas penentu kualiti bazaar akan datang.',
        'phone': 'Nombor Telefon', 'phone_hint': 'Pemenang akan dihubungi melalui nombor ini. Pastikan betul!',
        'btn_continue': 'TERUSKAN', 'copyright': 'Hak Cipta Terpelihara ©', 'nav_home': 'Utama', 'nav_feed': 'Feed', 'nav_map': 'Peta', 'nav_profile': 'Profil',
        'enter_otp': 'Masukkan Kod OTP', 'btn_verify': 'SAHKAN & MASUK', 'btn_resend': 'Belum dapat kod? Hantar Semula',
        'verify_email': 'Pengesahan Email', 'verify_email_hint': 'Emel akan digunakan untuk tujuan rasmi.', 'btn_identity': 'SAHKAN IDENTITI',
        'quota': 'UNDIAN', 'rate_design': 'DESIGN BOOTH', 'sub_design': 'Kecantikan & Kreativiti', 'rate_value': 'HARGA & PRODUK', 'sub_value': 'Kualiti & Berbaloi',
        'live_header': 'Suara Pengundi Terkini', 'day': 'HARI', 'hour': 'JAM', 'min': 'MIN', 'sec': 'SAAT',
        'btn_cancel': 'Batal', 'btn_submit': 'HANTAR UNDIAN', 'btn_full': 'KUOTA PENUH',
        'vote_title': 'ANDA JURI, ', 'ph_name': 'Nama Penuh', 'ph_email': 'Email', 'ph_review': 'Review Jujur: Apa yang best? Service laju? Produk rare? (Optional)',
        'ticker': 'Absolut Bazaar 2026 - Jadual: 15-17 Mac 2026 | Lokasi: Lebuh Victoria, George Town, Penang.',
        'modal_history_title': 'Rekod Undi Anda', 'no_votes_msg': 'Anda belum meletakkan undian lagi.'
    },
    'en': {
        'login_sub': 'Your honest votes and reviews determine the quality of the upcoming bazaar.',
        'phone': 'Phone Number', 'phone_hint': 'Winners will be contacted via this number. Make sure it\'s correct!',
        'btn_continue': 'CONTINUE', 'copyright': 'Copyright ©', 'nav_home': 'Home', 'nav_feed': 'Feed', 'nav_map': 'Map', 'nav_profile': 'Profile',
        'enter_otp': 'Enter OTP Code', 'btn_verify': 'VERIFY & ENTER', 'btn_resend': 'Didn\'t receive code? Resend',
        'verify_email': 'Email Verification', 'verify_email_hint': 'Email will be used for official purposes.', 'btn_identity': 'VERIFY IDENTITY',
        'quota': 'VOTES', 'rate_design': 'BOOTH DESIGN', 'sub_design': 'Beauty & Creativity', 'rate_value': 'PRICE & PRODUCT', 'sub_value': 'Quality & Value',
        'live_header': 'Latest Voter Voices', 'day': 'DAYS', 'hour': 'HOURS', 'min': 'MINS', 'sec': 'SECS',
        'btn_cancel': 'Cancel', 'btn_submit': 'SUBMIT VOTE', 'btn_full': 'QUOTA FULL',
        'vote_title': 'YOU ARE THE JURY, ', 'ph_name': 'Full Name', 'ph_email': 'Email', 'ph_review': 'Honest Review (Optional)',
        'ticker': 'Absolut Bazaar 2026 - Schedule: March 15-17, 2026 | Location: Lebuh Victoria, George Town, Penang.',
        'modal_history_title': 'Your Vote History', 'no_votes_msg': 'You haven\'t placed any votes yet.'
    }
};

function setLanguage(lang) {
    currentLang = lang;
    document.getElementById('btn_my').classList.toggle('active', lang === 'my');
    document.getElementById('btn_en').classList.toggle('active', lang === 'en');
    updateLanguageUI();
}

function updateTickerText() {
    const el = document.getElementById('txt_ticker');
    if (!el) return;
    if (dbAnnouncement && Array.isArray(dbAnnouncement) && dbAnnouncement.length > 0) {
        let textArray = [];
        if (currentLang === 'my') textArray = dbAnnouncement.filter(x => x.is_active).map(x => x.text_my);
        else textArray = dbAnnouncement.filter(x => x.is_active).map(x => x.text_en);
        if (textArray.length > 0) el.innerHTML = textArray.join("   ●   ");
        else el.innerText = langData[currentLang].ticker;
    } else {
        el.innerText = langData[currentLang].ticker;
    }
}

function updateLanguageUI() {
    const t = langData[currentLang];
    const map = {
        'txt_login_sub': t.login_sub, 'lbl_phone': t.phone, 'txt_phone_hint': t.phone_hint, 'btnCheckUser': t.btn_continue,
        'txt_copyright': t.copyright, 'lbl_enter_otp': t.enter_otp, 'btn_verify_otp': t.btn_verify, 'btn_resend': t.btn_resend,
        'lbl_verify_email': t.verify_email, 'btn_verify_identity': t.btn_identity,
        'txt_quota': t.quota,
        'lbl_rate_design': t.rate_design, 'sub_rate_design': t.sub_design, 'lbl_rate_value': t.rate_value, 'sub_rate_value': t.sub_value,
        'txt_live_header': t.live_header, 'lbl_day': t.day, 'lbl_hour': t.hour, 'lbl_min': t.min, 'lbl_sec': t.sec,
        'btnCancel': t.btn_cancel, 'nav_home': t.nav_home, 'nav_feed': t.nav_feed, 'nav_map': t.nav_map, 'nav_profile': t.nav_profile,
    };
    for (const [id, txt] of Object.entries(map)) { const el = document.getElementById(id); if (el) el.innerText = txt; }

    document.getElementById('txt_vote_title').innerHTML = t.vote_title + '<span style="color:var(--accent);">PENENTU!</span>';
    document.getElementById('inputNama').placeholder = t.ph_name;
    document.getElementById('inputEmail').placeholder = t.ph_email;
    document.getElementById('inputReview').placeholder = t.ph_review;
    updateTickerText();
}

// --- NAVIGATION FUNCTIONS ---
function switchPage(pageId) {
    document.getElementById('voting-section').classList.add('hidden');
    document.getElementById('map-section').classList.add('hidden');
    document.getElementById('feed-section').classList.add('hidden');
    document.getElementById(pageId).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToTop() { setActiveNav(0); switchPage('voting-section'); }
function showFeedPage() { setActiveNav(1); switchPage('feed-section'); fetchFullFeed(); }
function showMapPage() { setActiveNav(3); switchPage('map-section'); }
function setActiveNav(idx) {
    document.querySelectorAll('.nav-btn').forEach((btn, i) => {
        if (i === idx) btn.classList.add('active'); else btn.classList.remove('active');
    });
}

// --- SCANNER MODAL LOGIC (NEW) ---
function toggleQrScanner() {
    const modal = document.getElementById('scannerModal');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        switchScannerTab('qr'); // Default Tab
    } else {
        closeScannerModal();
    }
}

function closeScannerModal() {
    document.getElementById('scannerModal').classList.add('hidden');
    stopQrScanner();
}

function switchScannerTab(tabName) {
    // UI Updates
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Logic Switch
    if (tabName === 'qr') {
        document.querySelector('button[onclick="switchScannerTab(\'qr\')"]').classList.add('active');
        document.getElementById('tab-qr').classList.add('active');
        startQrScanner();
    } else {
        stopQrScanner(); // Stop camera if not in QR tab
        if (tabName === 'ar') {
            document.querySelector('button[onclick="switchScannerTab(\'ar\')"]').classList.add('active');
            document.getElementById('tab-ar').classList.add('active');
        } else if (tabName === 'promo') {
            document.querySelector('button[onclick="switchScannerTab(\'promo\')"]').classList.add('active');
            document.getElementById('tab-promo').classList.add('active');
        }
    }
}

function startQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) return;
    html5QrCode = new Html5Qrcode("qr-reader-modal");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess)
        .catch(e => { console.error("Camera Error", e); });
}

function stopQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => { html5QrCode.clear(); }).catch(e => console.log(e));
    }
}

function onScanSuccess(decodedText) {
    let bid = null;
    try {
        const url = new URL(decodedText); const params = new URLSearchParams(url.search);
        if (params.has('calon')) bid = params.get('calon'); else if (params.has('booth_id')) bid = params.get('booth_id');
    } catch (e) { bid = decodedText; } // Fallback text

    if (bid) {
        document.getElementById('boothDisplay').innerText = "BOOTH: " + bid;
        document.getElementById('boothIdInput').value = bid;
        closeScannerModal();
        fetchMainPopupAd();
        showAdsPopup(() => { showModal('success', 'Berjaya!', 'Anda di booth: ' + bid); });
    }
}

// --- STEPPER RENDERER ---
function renderStepper(count) {
    for (let i = 1; i <= 5; i++) {
        const el = document.querySelector(`#step${i} .step-counter`);
        const parent = document.getElementById(`step${i}`);
        el.classList.remove('active', 'completed');
        parent.classList.remove('completed');
        el.innerHTML = i;
        if (i <= count) {
            el.classList.add('completed');
            el.innerHTML = '<i class="fas fa-check"></i>';
            parent.classList.add('completed');
        } else {
            if (i === count + 1) el.classList.add('active');
        }
    }
}

// --- MISSION LOGIC ---
function copyHashtags() {
    const text = "#abgr2026 #absolutvisitmalaysia #AbsolutUnifiTM";
    navigator.clipboard.writeText(text).then(() => { showModal('success', 'Disalin!', 'Hashtag telah disalin. Paste di caption anda!'); });
}

async function submitSocialMission() {
    const link = document.getElementById('socialLinkInput').value;
    const phone = localStorage.getItem('userPhone');
    const btn = document.getElementById('btnSubmitMission');

    if (!link) {
        const m = document.getElementById('modalMsg');
        m.innerHTML = "<span style='color:var(--danger); font-weight:bold;'>⚠️ Sila masukkan link post!</span>";
        m.classList.add('shake'); setTimeout(() => m.classList.remove('shake'), 500);
        return;
    }

    btn.innerText = "MENGHANTAR..."; btn.disabled = true;
    try {
        await callWorker('submit-mission', { user_phone: phone, social_link: link, status: 'pending' });
        btn.style.background = 'var(--success)';
        btn.innerText = "BERJAYA! ✓";
        document.getElementById('modalMsg').innerHTML = "<span style='color:var(--success); font-weight:bold;'>Link berjaya dihantar! Sila tekan HANTAR UNDIAN SEKARANG di bawah.</span>";
    } catch (error) {
        showModal('warning', 'Ralat', error.message || 'Gagal menghantar misi.');
        btn.innerText = "HANTAR LINK (MISI)"; btn.disabled = false;
    }
}

// --- RECEIPT LOGIC ---
function toggleReceiptInput() {
    const type = document.getElementById('receiptType').value;
    if (type === 'shopeepay') {
        document.getElementById('inputShopee').classList.remove('hidden');
        document.getElementById('inputPhysical').classList.add('hidden');
    } else {
        document.getElementById('inputShopee').classList.add('hidden');
        document.getElementById('inputPhysical').classList.remove('hidden');
    }
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxWidth = 1024;
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                canvas.width = width; canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => { resolve(blob); }, 'image/jpeg', 0.7);
            };
        };
        reader.onerror = (e) => reject(e);
    });
}

async function processReceiptUpload() {
    const btn = document.getElementById('btnSubmitReceipt');
    const type = document.getElementById('receiptType').value;
    const fileInput = document.getElementById('receiptFile');
    const amount = document.getElementById('receiptAmount').value;
    const phone = localStorage.getItem('userPhone');

    if (parseFloat(amount) < 300) {
        const m = document.getElementById('modalMsg');
        m.innerHTML = "<span style='color:var(--danger); font-weight:bold;'>⚠️ Belanja mesti minima RM300!</span>";
        m.classList.add('shake'); setTimeout(() => m.classList.remove('shake'), 500);
        return;
    }

    let ref = "";
    if (type === 'shopeepay') {
        ref = document.getElementById('receiptRef').value;
        if (!ref) { document.getElementById('modalMsg').innerHTML = "<span style='color:var(--danger); font-weight:bold;'>⚠️ Sila masukkan Order ID!</span>"; return; }
    } else {
        ref = document.getElementById('receiptRefPhysical').value;
        if (!ref) { document.getElementById('modalMsg').innerHTML = "<span style='color:var(--danger); font-weight:bold;'>⚠️ Sila masukkan No Resit!</span>"; return; }
        ref = "PHY-" + ref;
    }

    if (!amount || fileInput.files.length === 0) {
        document.getElementById('modalMsg').innerHTML = "<span style='color:var(--danger); font-weight:bold;'>⚠️ Sila lengkapkan gambar & amaun!</span>"; return;
    }

    btn.disabled = true; btn.innerText = "UPLOADING...";
    try {
        const file = fileInput.files[0];
        const compressedFile = await compressImage(file);
        const reader = new FileReader();
        const base64Data = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(compressedFile);
        });
        const fileName = `receipts/${phone}_${Date.now()}.jpg`;
        const uploadResult = await callWorker('upload-receipt', { fileName: fileName, fileData: base64Data });
        const finalRef = type === 'shopeepay' ? ref : (ref + '-' + Date.now().toString().slice(-4));

        await callWorker('submit-mission', {
            user_phone: phone, amount: parseFloat(amount),
            transaction_ref: finalRef, receipt_url: uploadResult.publicUrl, status: 'pending'
        });

        btn.style.background = 'var(--success)'; btn.style.color = '#fff'; btn.innerText = "RESIT DITERIMA! ✓";
        document.getElementById('modalMsg').innerHTML = "<span style='color:var(--success); font-weight:bold;'>Resit berjaya! Sila tekan HANTAR UNDIAN SEKARANG.</span>";

    } catch (e) {
        console.error(e);
        btn.innerText = "GAGAL! UPLOAD SEMULA"; btn.style.background = "var(--danger)"; btn.disabled = false;
        document.getElementById('modalMsg').innerHTML = "<span style='color:var(--danger); font-weight:bold;'>⚠️ Gagal upload. Sila cuba lagi.</span>";
    }
}

// --- FEED SYSTEM ---
async function fetchFullFeed() {
    const c = document.getElementById('fullFeedList');
    try {
        const result = await callWorker('get-feed', {});
        const data = (typeof result === 'object' && result !== null && result.data) ? result.data : result;

        if (data && Array.isArray(data)) {
            globalFeedData = data;
            const activeBtn = document.querySelector('.filter-btn.active');
            if (activeBtn && activeBtn.id === 'filter_love') applyFilter('most_loved');
            else if (activeBtn && activeBtn.id === 'filter_book') applyFilter('bookmarks');
            else if (activeBtn && activeBtn.id === 'filter_new') applyFilter('newest');
            else applyFilter('newest');
        } else { c.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Tiada data feed.</div>'; }
    } catch (error) { c.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Gagal muat turun feed.</div>'; }
}

function handleBookmark(id, btn) {
    let books = JSON.parse(localStorage.getItem('userBookmarks') || "[]");
    if (books.includes(id)) {
        books = books.filter(b => b !== id);
        btn.innerHTML = '<i class="far fa-bookmark"></i>'; btn.style.color = '#555';
    } else {
        if (books.length >= 20) return showModal('warning', 'Penuh', 'Max 20 bookmark sahaja.');
        books.push(id);
        btn.innerHTML = '<i class="fas fa-bookmark"></i>'; btn.style.color = 'var(--accent)';
    }
    localStorage.setItem('userBookmarks', JSON.stringify(books));
    if (document.getElementById('filter_book').classList.contains('active')) applyFilter('bookmarks');
}

async function handleLike(id, btnElement) {
    const likedPosts = JSON.parse(localStorage.getItem('liked_posts') || "[]");
    if (likedPosts.includes(id)) { showModal('info', 'Sudah Like', 'Anda sudah like post ini!'); return; }
    const countSpan = btnElement.querySelector('.like-count');
    let currentVal = parseInt(countSpan.innerText);
    countSpan.innerText = currentVal + 1;
    btnElement.style.color = '#e74c3c'; btnElement.classList.add('impulse');
    try {
        await callWorker('increment-like', { quote_id: id });
        likedPosts.push(id); localStorage.setItem('liked_posts', JSON.stringify(likedPosts));
    } catch (error) { console.error(error); countSpan.innerText = currentVal; btnElement.style.color = '#555'; }
}

window.toggleReview = function (id, btn) { document.getElementById(id).classList.remove('line-clamp-3'); btn.style.display = 'none'; }

async function fetchLiveReviews() {
    const c = document.getElementById('liveFeedContent');
    if (!c) return; c.innerHTML = '';
    try {
        const result = await callWorker('get-feed', { limit: 15 });
        const data = (typeof result === 'object' && result !== null && result.data) ? result.data : result;
        if (data && data.length) {
            document.getElementById('liveReviews').classList.remove('hidden');
            data.forEach((v, i) => {
                const s1 = '★'.repeat(v.rate_design) + '☆'.repeat(5 - v.rate_design);
                const s2 = '★'.repeat(v.rate_value) + '☆'.repeat(5 - v.rate_value);
                const isLong = v.review.length > 80;
                c.innerHTML += `
                    <div class="live-card">
                    <div class="live-top">
                        <span class="live-booth">${v.booth_id}</span>
                        <div class="live-rating-col"><div>Design: <span class="star-gold">${s1}</span></div><div>Harga: <span class="star-gold">${s2}</span></div></div>
                    </div>
                    <div class="live-msg"><span id="rev-${i}" class="${isLong ? 'line-clamp-3' : ''}">${v.review}</span>${isLong ? `<span class="read-more-btn" onclick="toggleReview('rev-${i}',this)">...Lebih</span>` : ''}</div>
                    </div>`;
            });
        }
    } catch (error) { console.log("Live Review Error:", error); }
}

function applyFilter(type) {
    if (type !== 'search') {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        if (type === 'newest') document.getElementById('filter_new').classList.add('active');
        if (type === 'most_loved') document.getElementById('filter_love').classList.add('active');
        if (type === 'bookmarks') document.getElementById('filter_book').classList.add('active');
        if (type === 'design') document.getElementById('filter_design').classList.add('active');
        if (type === 'price') document.getElementById('filter_price').classList.add('active');
    }
    let sorted = [...globalFeedData];
    const query = document.getElementById('feedSearch').value.toUpperCase();
    if (query) sorted = sorted.filter(x => (x.booth_id && x.booth_id.toUpperCase().includes(query)) || (x.review && x.review.toUpperCase().includes(query)));

    if (type === 'bookmarks') {
        const books = JSON.parse(localStorage.getItem('userBookmarks') || "[]");
        sorted = sorted.filter(x => books.includes(x.id));
        if (sorted.length === 0 && !query) { document.getElementById('fullFeedList').innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Tiada simpanan bookmark.</div>'; return; }
    } else if (type === 'most_loved') {
        sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0)); sorted = sorted.slice(0, 15);
    } else if (type === 'design') sorted.sort((a, b) => b.rate_design - a.rate_design);
    else if (type === 'price') sorted.sort((a, b) => b.rate_value - a.rate_value);
    else sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    renderFeedList(sorted);
}

function renderFeedList(data) {
    const c = document.getElementById('fullFeedList'); c.innerHTML = '';
    if (data.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Tiada rekod dijumpai.</div>'; return; }

    const myLikes = JSON.parse(localStorage.getItem('liked_posts') || "[]");
    const myBookmarks = JSON.parse(localStorage.getItem('userBookmarks') || "[]");

    data.forEach((v, i) => {
        const s1 = '★'.repeat(v.rate_design) + '☆'.repeat(5 - v.rate_design);
        const s2 = '★'.repeat(v.rate_value) + '☆'.repeat(5 - v.rate_value);
        let rawName = v.nama || v.voter_name || v.display_name || "USER";
        let displayName = rawName.toUpperCase();
        if (displayName.length > 6) displayName = displayName.substring(0, 6) + "..";
        const isLong = v.review.length > 80;
        const shortText = isLong ? v.review.substring(0, 80) + "..." : v.review;
        const fullText = v.review;
        const isLiked = myLikes.includes(v.id);
        const likeColor = isLiked ? '#e74c3c' : '#555';
        const likeCount = v.likes || 0;
        const isBookmarked = myBookmarks.includes(v.id);
        const bookmarkColor = isBookmarked ? 'var(--accent)' : '#555';
        const bookmarkIcon = isBookmarked ? '<i class="fas fa-bookmark"></i>' : '<i class="far fa-bookmark"></i>';
        const thumbHtml = v.tiktok_thumb ? `<div style="margin-top:5px; border-radius:10px; overflow:hidden;"><img src="${v.tiktok_thumb}" style="width:100%; height:auto; display:block;"></div>` : '';

        c.innerHTML += `
        <div class="feed-card fade-in">
            <div class="feed-header">
                <div style="display:flex; flex-direction:column;">
                    <span class="feed-booth">${v.booth_id}</span>
                    <span style="font-size:0.65rem; color:#666; font-weight:700;">${displayName}</span>
                </div>
                <div class="feed-ratings"><div>Design: <span style="color:#d4af37;">${s1}</span></div><div>Harga: <span style="color:#d4af37;">${s2}</span></div></div>
            </div>
            <div class="feed-body">
                <span id="full-rev-${i}" class="${isLong ? 'hidden' : ''}">${fullText}</span>
                <span id="short-rev-${i}" class="${!isLong ? 'hidden' : ''}">${shortText}</span>
                ${isLong ? `<span class="see-more-feed" onclick="document.getElementById('short-rev-${i}').classList.add('hidden'); document.getElementById('full-rev-${i}').classList.remove('hidden'); this.style.display='none';">Lihat Penuh</span>` : ''}
                ${thumbHtml}
            </div>
            <div style="margin-top:10px; padding-top:5px; border-top:1px solid rgba(0,0,0,0.05); display:flex; justify-content:flex-end; gap:15px;">
                <button onclick="handleLike(${v.id}, this)" style="background:none; border:none; cursor:pointer; font-size:0.9rem; font-weight:700; color:${likeColor}; display:inline-flex; align-items:center; gap:5px;"><i class="fas fa-heart"></i> <span class="like-count">${likeCount}</span></button>
                <button onclick="handleBookmark(${v.id}, this)" style="background:none; border:none; cursor:pointer; font-size:0.9rem; color:${bookmarkColor};">${bookmarkIcon}</button>
            </div>
        </div>`;
    });
}

// --- USER LOGIC ---
function loadUserProfile() {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
        const p = JSON.parse(saved);
        document.getElementById('inputNama').value = p.nama || '';
        document.getElementById('inputEmail').value = p.email || '';
        document.getElementById('inputTelco').value = p.telco || '';
        document.getElementById('displayUserName').innerText = p.nama || "User";
        toggleUserInfo(false);
    } else { toggleUserInfo(true); }
}

function toggleUserInfo(showInputs) {
    const inputs = document.getElementById('userInfoInputs');
    if (showInputs) { inputs.classList.remove('hidden'); } else { inputs.classList.add('hidden'); }
}

function showProfileDetails() {
    setActiveNav(4);
    const saved = localStorage.getItem('userProfile');
    if (saved) {
        const p = JSON.parse(saved);
        document.getElementById('viewName').innerText = p.nama;
        document.getElementById('viewEmail').innerText = p.email;
        document.getElementById('viewPhone').innerText = localStorage.getItem('userPhone');
        document.getElementById('viewTelco').innerText = p.telco;
        showModal('info', 'Profil Pengguna', '');
        document.getElementById('profileViewSection').classList.remove('hidden');
    } else { showModal('warning', 'Tiada Data', 'Sila log masuk dahulu.'); }
}

async function showVoteHistory() {
    const t = langData[currentLang];
    const listContainer = document.getElementById('historyList');
    const phone = localStorage.getItem('userPhone');
    showModal('info', t.modal_history_title, '');
    document.getElementById('historySection').classList.remove('hidden');
    document.getElementById('modalMsg').style.display = 'none';
    renderStepper(currentVotes);
    listContainer.innerHTML = '<li style="text-align:center; color:#888;">Loading...</li>';
    try {
        const result = await callWorker('get-voter-history', { phone_input: phone });
        const data = (typeof result === 'object' && result !== null && result.data) ? result.data : result;
        listContainer.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach((vote, index) => {
                const sDesign = '★'.repeat(vote.rate_design);
                const sValue = '★'.repeat(vote.rate_value);
                const reviewTxt = vote.review ? `"${vote.review}"` : "<i>Tiada review</i>";
                const li = document.createElement('li');
                li.className = 'history-item';
                li.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-weight:900; color:var(--accent); font-size:0.9rem;">${vote.booth_id}</span>
                        <span style="font-size:0.7rem; color:#888;">#${index + 1}</span>
                    </div>
                    <div style="font-size:0.75rem; color:#555; margin-bottom:5px;">
                        <div>Design: <span style="color:#d4af37;">${sDesign}</span></div>
                        <div>Value: <span style="color:#d4af37;">${sValue}</span></div>
                    </div>
                    <div style="font-size:0.75rem; font-style:italic; color:#666; border-top:1px dashed #ccc; padding-top:3px;">${reviewTxt}</div>
                `;
                listContainer.appendChild(li);
            });
        } else { listContainer.innerHTML = `<li style="text-align:center; color:#888; font-style:italic;">${t.no_votes_msg}</li>`; }
    } catch (e) { console.error(e); listContainer.innerHTML = '<li style="text-align:center; color:red;">Gagal memuat turun rekod.</li>'; }
}

function enableEditMode() {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
        const p = JSON.parse(saved);
        document.getElementById('inputNama').value = p.nama || '';
        document.getElementById('inputEmail').value = p.email || '';
        document.getElementById('inputTelco').value = p.telco || '';
    }
    closeModal(); toggleUserInfo(true);
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    document.getElementById('btnSaveProfile').classList.remove('hidden');
    scrollToTop();
}

function cancelEditMode() {
    toggleUserInfo(false);
    document.getElementById('cancelEditBtn').classList.add('hidden');
    document.getElementById('btnSaveProfile').classList.add('hidden');
}

function saveUserProfile() {
    const nama = document.getElementById('inputNama').value;
    const email = document.getElementById('inputEmail').value;
    const telco = document.getElementById('inputTelco').value;
    if (!nama || !email || !telco) { alert("Sila lengkapkan semua maklumat."); return; }
    localStorage.setItem('userProfile', JSON.stringify({ nama, email, telco }));
    toggleUserInfo(false);
    document.getElementById('cancelEditBtn').classList.add('hidden');
    document.getElementById('btnSaveProfile').classList.add('hidden');
    alert("Profil berjaya disimpan!");
    document.getElementById('displayUserName').innerText = nama;
}

// --- ADS SYSTEM ---
function showAdsPopup(callback) {
    const adsModal = document.getElementById('adsModal');
    adsModal.classList.remove('hidden');
    if (adsModal.timeoutId) clearTimeout(adsModal.timeoutId);
    adsModal.timeoutId = setTimeout(() => { if (!adsModal.classList.contains('hidden')) closeAdsPopupManual(callback); }, 4000);
    adsModal.onCloseCallback = callback;
}
function closeAdsPopupManual(callback) {
    const adsModal = document.getElementById('adsModal');
    if (!adsModal.classList.contains('hidden')) {
        adsModal.classList.add('hidden');
        const cb = callback || adsModal.onCloseCallback;
        if (cb && typeof cb === 'function') cb();
        adsModal.onCloseCallback = null;
    }
}
async function fetchMainPopupAd() {
    try {
        const result = await callWorker('get-sponsor', { id: 9 });
        const data = (typeof result === 'object' && result !== null && result.data) ? result.data : result;
        if (data) {
            const img = document.getElementById('mainAdsImg');
            const link = document.getElementById('mainAdsLink');
            if (img) img.src = data.image_url; if (link) link.href = data.target_url || "#";
        }
    } catch (e) { console.log(e); }
}

// --- LOAD EVENT DETAILS ---
async function fetchEventConfig() {
    try {
        const result = await callWorker('get-event-settings', {});
        const data = (typeof result === 'object' && result !== null && result.data) ? result.data : result;
        if (data) {
            const logo = document.querySelector('.hero-logo');
            if (logo && data.logo_url) logo.src = data.logo_url;
            const title = document.querySelector('.hero-text');
            if (title && data.event_title) title.innerText = data.event_title;
            if (data.event_date) { window.targetDateOverride = new Date(data.event_date).getTime(); }
        }
    } catch (e) { console.log(e); }
}

// --- CHART LOGIC ---
async function fetchAndRenderStats() {
    try {
        const result = await callWorker('get-public-stats', {});
        const data = (typeof result === 'object' && result !== null && result.data) ? result.data : result;
        if (!data) return;
        const rawGender = data.gender || {};
        const genderFiltered = { 'Lelaki': rawGender['Lelaki'] || 0, 'Perempuan': rawGender['Perempuan'] || 0 };
        renderPieChart('genderPie', genderFiltered, 'genderLegend', ['#003366', '#e74c3c']);
        renderPieChart('genPie', data.gen, 'genLegend', ['#3498db', '#9b59b6', '#2ecc71', '#f1c40f']);
    } catch (e) { console.log("Chart Error", e); }
}

function renderPieChart(canvasId, dataObj, legendId, colors) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    const labels = Object.keys(dataObj); const dataVal = Object.values(dataObj);
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: dataVal, backgroundColor: colors, borderWidth: 2, borderColor: '#e0e5ec' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } } }
    });
    document.getElementById(legendId).innerHTML = labels.map((l, i) => `<span style="color:${colors[i % colors.length]}; margin-right:5px;">● ${l}</span>`).join(" ");
}

// --- LOGIN & AUTH ---
async function handleLoginFlow() {
    const phone = document.getElementById('loginPhone').value.trim();
    const btn = document.getElementById('btnCheckUser');
    if (phone.length < 9) { showModal('warning', 'Ralat', 'Nombor tidak sah.'); return; }
    const ori = btn.innerText; btn.innerText = "..."; btn.disabled = true;
    try {
        const result = await callWorker('check-user-exists', { phone_input: phone });
        const data = (typeof result === 'object' && result !== null && result.data !== undefined) ? result.data : result;
        btn.classList.add('hidden');
        if (data) document.getElementById('emailField').classList.remove('hidden');
        else requestOTP(phone);
    } catch (e) { showModal('warning', 'Ralat', 'Gagal check user.'); btn.innerText = ori; btn.disabled = false; }
}

async function requestOTP(phone) {
    try {
        const result = await callWorker('request-otp', { phone_input: phone });
        const otpCode = (typeof result === 'string') ? result : (result.data || result);
        if (otpCode) {
            showModal('otp', 'Kod OTP', '', otpCode);
            document.getElementById('otpField').classList.remove('hidden');
            localStorage.setItem('serverOtpHash', otpCode);
        } else { showModal('warning', 'Ralat', 'Gagal OTP: Kod kosong.'); }
    } catch (e) { console.error(e); showModal('warning', 'Ralat', 'Gagal OTP.'); }
}

function resendCurrentOtp() {
    const phone = document.getElementById('loginPhone').value.trim();
    if (phone.length < 9) return;
    requestOTP(phone);
}

function verifyOtpLogin() {
    const inp = document.getElementById('otpInput').value;
    if (inp === localStorage.getItem('serverOtpHash')) completeLogin(document.getElementById('loginPhone').value);
    else showModal('warning', 'Salah', 'OTP Salah!');
}

async function verifyEmailLogin() {
    const p = document.getElementById('loginPhone').value;
    const e = document.getElementById('verifyEmailInput').value;
    const btn = document.getElementById('btn_verify_identity');
    btn.innerText = "MENYEMAK..."; btn.disabled = true;
    try {
        const result = await callWorker('verify-user-login', { phone_input: p, email_input: e });
        const data = (typeof result === 'object' && result !== null && result.data !== undefined) ? result.data : result;
        if (data) { completeLogin(p); } else { showModal('warning', 'Gagal', 'Email tidak sepadan dengan rekod.'); btn.innerText = "SAHKAN IDENTITI"; btn.disabled = false; }
    } catch (e) { showModal('warning', 'Ralat', 'Ralat sistem. Cuba lagi.'); btn.innerText = "SAHKAN IDENTITI"; btn.disabled = false; }
}

function completeLogin(phone) {
    localStorage.setItem('isUserVerified', 'true'); localStorage.setItem('userPhone', phone);
    localStorage.removeItem('serverOtpHash'); checkLoginStatus();
}

function checkLoginStatus() {
    const hist = localStorage.getItem('votedBoothsLog');
    if (hist) votedBooths = JSON.parse(hist);
    if (localStorage.getItem('isUserVerified') === 'true') {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('voting-section').classList.remove('hidden');
        document.getElementById('formPhone').value = localStorage.getItem('userPhone');
        document.getElementById('stickyFooter').classList.remove('hidden');
        loadUserProfile(); syncUserStatus(localStorage.getItem('userPhone')); fetchLiveReviews();
    } else { document.getElementById('stickyFooter').classList.add('hidden'); showAdsPopup(); }
}

async function syncUserStatus(phone) {
    try {
        const result = await callWorker('check-vote-count', { phone_input: phone });
        const data = (typeof result === 'object' && result !== null && result.data) ? result.data : result;
        if (data) {
            currentVotes = data.count || 0;
            const luckyNum = data.lucky_number;
            localStorage.setItem('userVotes', currentVotes);
            document.getElementById('voteCount').innerText = currentVotes;
            const luckyBox = document.getElementById('luckyDrawContainer');
            if (currentVotes >= MAX_VOTES) {
                const b = document.getElementById('btnPreSubmit');
                b.disabled = true; b.innerText = langData[currentLang].btn_full; b.style.background = '#ccc';
                luckyBox.classList.remove('hidden');
                if (luckyNum) {
                    const displayNum = luckyNum.toString().startsWith('KL') ? luckyNum : 'KL' + luckyNum;
                    document.getElementById('userLuckyNumber').innerText = displayNum;
                } else { document.getElementById('userLuckyNumber').innerText = "PROSES..."; }
            } else {
                const b = document.getElementById('btnPreSubmit');
                b.disabled = false; b.innerText = langData[currentLang].btn_submit; b.style.background = 'var(--accent)';
                luckyBox.classList.add('hidden');
            }
        }
    } catch (error) { console.error("Error check vote:", error); currentVotes = 0; }
}

// --- VOTING LOGIC ---
function handlePreSubmit() {
    if (document.getElementById('bot_trap').value !== "") return;
    if (currentVotes >= MAX_VOTES) { showModal('warning', 'Penuh', 'Kuota undian penuh.'); return; }

    const form = document.getElementById('voteForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        const bid = document.getElementById('boothIdInput').value;
        if (!bid) { showModal('warning', 'Tiada Booth', 'Sila scan booth QR dahulu!'); return; }
        return;
    }

    const boothId = document.getElementById('boothIdInput').value;
    if (votedBooths.includes(boothId)) { showModal('warning', 'Dah Undi!', 'Anda dah undi booth ini.'); return; }
    showModal('confirm', 'PENGESAHAN', 'Lengkapkan langkah di bawah untuk menghantar undian.', submitVoteReal);
}

async function submitVoteReal(modalData) {
    const btn = document.getElementById('btnPreSubmit');
    btn.innerText = "..."; btn.disabled = true;

    const fd = new FormData(document.getElementById('voteForm'));
    const profile = { nama: fd.get('nama'), email: fd.get('email'), telco: fd.get('telco') };
    localStorage.setItem('userProfile', JSON.stringify(profile));

    let demo = JSON.parse(localStorage.getItem('userDemographics')) || {};
    if (currentVotes === 0 && modalData) { demo = modalData; localStorage.setItem('userDemographics', JSON.stringify(demo)); }
    let futureValue = modalData?.future_attend || null;
    const eventReviewText = document.getElementById('eventReview').value;
    if (currentVotes === 4 && eventReviewText) { futureValue += " | EventReview: " + eventReviewText; }

    const votePayload = {
        p_phone: localStorage.getItem('userPhone'), p_booth_id: fd.get('booth_id'),
        p_design: parseInt(fd.get('rate_design')), p_value: parseInt(fd.get('rate_value')),
        p_review: fd.get('review'), p_nama: profile.nama, p_email: profile.email,
        p_telco: profile.telco, p_jantina: demo.jantina || null, p_umur: demo.umur_gen || null,
        p_negeri: demo.negeri || null, p_status: modalData?.status || null, p_future: futureValue,
        p_tiktok_link: fd.get('tiktok_link') || null, p_tiktok_thumb: localStorage.getItem('tempTikTokThumb') || null
    };

    try {
        const result = await callWorker('submit-vote', votePayload);
        const error = result.error;
        if (!error) {
            currentVotes++; votedBooths.push(votePayload.p_booth_id);
            localStorage.setItem('votedBoothsLog', JSON.stringify(votedBooths));
            document.getElementById('voteCount').innerText = currentVotes;
            showModal('success', 'Berjaya', 'Terima kasih!');
            document.getElementById('voteForm').reset();
            document.getElementById('formPhone').value = localStorage.getItem('userPhone');
            document.getElementById('boothIdInput').value = votePayload.p_booth_id;
            syncUserStatus(votePayload.p_phone); loadUserProfile(); fetchLiveReviews();
            setTimeout(() => { document.getElementById('liveReviews').scrollIntoView({ behavior: "smooth" }); }, 1500);
        } else { showModal('warning', 'Ralat', error.message); }
    } catch (e) { showModal('warning', 'Ralat', e.message || "Ralat tidak diketahui."); }

    if (currentVotes < MAX_VOTES) { btn.disabled = false; btn.innerText = langData[currentLang].btn_submit; }
}

// --- CAROUSEL & LIVE FEED ---
let slideIndex = 0;
function startCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    setInterval(() => {
        slides[slideIndex].classList.remove('active');
        slideIndex = (slideIndex + 1) % slides.length;
        slides[slideIndex].classList.add('active');
    }, 3000);
}

// --- CHAR COUNT LOGIC ---
const reviewInput = document.getElementById('inputReview');
if (reviewInput) {
    reviewInput.addEventListener('input', function () {
        const current = this.value.length;
        const max = this.getAttribute('maxlength');
        document.getElementById('charCount').innerText = `${current}/${max}`;
    });
}

// --- TIKTOK LOGIC ---
const tikInput = document.getElementById('tiktokLink');
if (tikInput) {
    tikInput.addEventListener('change', async function () {
        const val = this.value;
        if (val && val.includes('tiktok.com')) {
            const thumb = await fetchTikTokOEmbed(val);
            if (thumb) localStorage.setItem('tempTikTokThumb', thumb);
        }
    });
}

// --- BOOTH ANIMATION LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const boothId = params.get('booth_id');
    const boothEl = document.getElementById('boothDisplay');

    if (boothId) {
        if (boothEl) boothEl.innerText = "BOOTH: " + boothId;
        if (document.getElementById('boothIdInput')) document.getElementById('boothIdInput').value = boothId;
    } else {
        // Animation 3s
        if (boothEl) {
            setTimeout(() => {
                boothEl.style.width = "50px";
                boothEl.style.height = "50px";
                boothEl.style.padding = "10px";
                boothEl.style.display = "flex";
                boothEl.style.alignItems = "center";
                boothEl.style.justifyContent = "center";
                boothEl.innerHTML = '<i class="fas fa-qrcode" style="font-size:1.5rem;"></i>';
            }, 3000);
        }
    }
});

async function fetchSponsors() {
    try {
        const result = await callWorker('get-sponsors', { is_active: true });
        let data = (typeof result === 'object' && result !== null && result.data) ? result.data : result;
        if (data && Array.isArray(data) && data.length) {
            const c = document.getElementById('sponsorContainer');
            if (!c) return; c.innerHTML = '';
            data.forEach((s, i) => { c.innerHTML += `<div class="carousel-slide ${i === 0 ? 'active' : ''}"><a href="${s.target_url || '#'}" target="_blank" style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;"><img src="${s.image_url}" class="carousel-img"></a></div>`; });
            startCarousel();
        }
    } catch (e) { console.error('Sponsor fetch error:', e); }
}
async function fetchAnnouncement() {
    try {
        const result = await callWorker('get-announcements', { is_active: true });
        let data = (typeof result === 'object' && result !== null && result.data) ? result.data : result;
        if (data && Array.isArray(data)) { dbAnnouncement = data; updateTickerText(); }
    } catch (e) { console.error('Announcement fetch error:', e); }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    setLanguage('my'); checkLoginStatus(); fetchSponsors(); fetchAnnouncement(); fetchMainPopupAd(); fetchEventConfig();
    const p = new URLSearchParams(window.location.search);
    const bid = p.get('calon') || p.get('booth_id') || "V-001";
    document.getElementById('boothDisplay').innerText = "BOOTH: " + bid;
    document.getElementById('boothIdInput').value = bid;
    let target = new Date("March 15, 2026 00:00:00").getTime();
    setInterval(() => {
        if (window.targetDateOverride) target = window.targetDateOverride;
        const now = new Date().getTime(); const diff = target - now;
        if (diff > 0) {
            document.getElementById('d-val').innerText = Math.floor(diff / (1000 * 60 * 60 * 24));
            document.getElementById('h-val').innerText = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            document.getElementById('m-val').innerText = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            document.getElementById('s-val').innerText = Math.floor((diff % (1000 * 60)) / 1000);
        }
    }, 1000);
});

// --- MODAL & LOGIC GABUNGAN ---
function showModal(type, title, msg, onConfirm) {
    const m = document.getElementById('neuModal');
    m.classList.remove('hidden');
    document.getElementById('modalTitle').innerText = title;
    const msgEl = document.getElementById('modalMsg');
    msgEl.innerHTML = msg; msgEl.style.display = 'block'; msgEl.style.color = "#666"; msgEl.style.fontWeight = "normal";

    document.getElementById('modalIconText').classList.remove('hidden');
    document.getElementById('modalIconImg').classList.add('hidden');
    document.getElementById('btnCancel').classList.add('hidden');
    document.getElementById('otpDisplaySection').classList.add('hidden');
    document.getElementById('historySection').classList.add('hidden');
    document.getElementById('profileViewSection').classList.add('hidden');
    document.getElementById('field-demographic').classList.add('hidden');
    document.getElementById('field-status').classList.add('hidden');
    document.getElementById('field-future').classList.add('hidden');
    document.getElementById('field-social').classList.add('hidden');
    document.getElementById('field-receipt').classList.add('hidden');

    const btnConfirm = document.getElementById('btnConfirm');
    btnConfirm.disabled = false;
    btnConfirm.innerText = (type === 'confirm') ? "HANTAR UNDIAN SEKARANG" : "OK";
    btnConfirm.style.opacity = "1";
    btnConfirm.onclick = closeModal;

    if (type === 'success') {
        document.getElementById('modalIconText').classList.add('hidden');
        document.getElementById('modalIconImg').classList.remove('hidden');
    } else if (type === 'otp') {
        document.getElementById('otpDisplaySection').classList.remove('hidden');
        document.getElementById('serverOtpText').innerText = onConfirm;
    } else if (type === 'confirm') {
        document.getElementById('modalIconText').classList.add('hidden');
        document.getElementById('modalIconImg').classList.remove('hidden');
        document.getElementById('btnCancel').classList.remove('hidden');

        if (onConfirm === submitVoteReal) {
            if (currentVotes === 0) {
                document.getElementById('field-demographic').classList.remove('hidden');
                setTimeout(fetchAndRenderStats, 100);
            } else if (currentVotes === 1) {
                document.getElementById('field-status').classList.remove('hidden');
            } else if (currentVotes === 2) {
                document.getElementById('field-social').classList.remove('hidden');
            } else if (currentVotes === 3) {
                document.getElementById('field-receipt').classList.remove('hidden');
            } else if (currentVotes === 4) {
                document.getElementById('field-future').classList.remove('hidden');
            }

            btnConfirm.onclick = function () {
                if (btnConfirm.disabled) return;
                const payload = {};
                if (currentVotes === 0) {
                    const gender = document.querySelector('input[name="modal_jantina"]:checked');
                    const gen = document.querySelector('input[name="modal_gen"]:checked');
                    const negeri = document.getElementById('modal_negeri').value;
                    if (!gender || !gen || !negeri) {
                        const m = document.getElementById('modalMsg');
                        m.innerHTML = "<span style='color:var(--danger); font-weight:bold;'>⚠️ Sila lengkapkan semua info!</span>";
                        m.classList.add('shake'); setTimeout(() => m.classList.remove('shake'), 500);
                        return;
                    }
                    payload.jantina = gender.value; payload.umur_gen = gen.value; payload.negeri = negeri;
                } else if (currentVotes === 1) {
                    const status = document.querySelector('input[name="modal_status"]:checked');
                    if (!status) {
                        const m = document.getElementById('modalMsg');
                        m.innerHTML = "<span style='color:var(--danger); font-weight:bold;'>⚠️ Sila pilih status anda!</span>";
                        m.classList.add('shake'); setTimeout(() => m.classList.remove('shake'), 500);
                        return;
                    }
                    payload.status = status.value;
                } else if (currentVotes === 4) {
                    const future = document.querySelector('input[name="modal_future"]:checked');
                    if (!future) {
                        const m = document.getElementById('modalMsg');
                        m.innerHTML = "<span style='color:var(--danger); font-weight:bold;'>⚠️ Sila jawab soalan kehadiran!</span>";
                        m.classList.add('shake'); setTimeout(() => m.classList.remove('shake'), 500);
                        return;
                    }
                    payload.future_attend = future.value;
                }
                btnConfirm.disabled = true; btnConfirm.innerText = "MEMPROSES..."; btnConfirm.style.opacity = "0.7";
                closeModal(); onConfirm(payload);
            };
        } else { btnConfirm.onclick = function () { onConfirm(); closeModal(); }; }
    }
}

function closeModal() { document.getElementById('neuModal').classList.add('hidden'); }
function copyOTP() { navigator.clipboard.writeText(document.getElementById('serverOtpText').innerText).then(() => { showModal('success', 'Berjaya', 'Kod disalin!'); }); }