// Bu kod artık auth.html, index.html, form.html ve stats.html tarafından paylaşılmaktadır.
// Hangi sayfada olduğunu tespit eder ve o sayfaya özel mantığı çalıştırır.

// --- 1. GEREKLİ FIREBASE MODÜLLERİNİ IMPORT ET ---
// Bu modüller auth.html'de başlatılan global window değişkenlerinden alınacak
// veya sayfa doğrudan yüklenirse (örn. yenileme) SDK'dan alınacak.

import {
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged,
    signOut,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
    getFirestore, 
    doc, 
    getDoc, 
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM BAŞLANGIÇ ---
document.addEventListener('DOMContentLoaded', () => {

    // --- 2. FIREBASE VE GLOBAL DEĞİŞKENLERİ AYARLA ---
    
    // auth.html'de SDK'ları zaten yükledik ve window'a ekledik.
    // Eğer kullanıcı sayfayı yenilerse (örn index.html), bu değişkenler boş olabilir,
    // bu yüzden onları tekrar almaya çalışırız.
    // Bu, auth.html'deki 'window.firebaseAuth' atamasıyla çalışır.
    
    const auth = window.firebaseAuth || getAuth();
    const db = window.firebaseDb || getFirestore();
    
    // Uygulama ID'si (Firestore yolu için gerekli)
    // Bu __app_id global değişkeni canvas ortamı tarafından sağlanır
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    
    // Hata ayıklama logları (zaten auth.html'de çağrıldı ama yedek)
    setLogLevel('Debug');

    let mediaList = []; // Veritabanından gelen veriler için lokal kopya
    let currentUserId = null;
    let mediaCollectionRef = null; // Kullanıcıya özel koleksiyon referansı
    let unsubscribeSnapshot = null; // onSnapshot dinleyicisini kapatmak için

    const pageName = window.location.pathname.split('/').pop() || 'index.html';

    // --- 3. SABİT VERİLER (Dropdownlar için) ---
    const ANA_KATEGORILER = [
        "Kitap", "Roman", "Webtoon", "Manga", "Film", "Dizi", "Anime", "Müzik", "Podcast", "Diğer"
    ];
    const DURUMLAR = [
        "Planlandı", "İzleniyor", "Okunuyor", "Beklemede", "Bırakıldı", "Tamamlandı"
    ];
    const BIRIMLER = [
        "Bölüm", "Sayfa", "Sezon", "Cilt", "Film", "Kitap", "Parça", "Dakika", "Diğer"
    ];

    // --- 4. ORTAK YARDIMCI FONKSİYONLAR ---

    function populateDropdown(selectElement, options) {
        if (!selectElement) return;
        // Mevcut seçili değeri veya ilk seçeneği koru
        const firstOptionHTML = selectElement.options[0] ? selectElement.options[0].outerHTML : '';
        selectElement.innerHTML = firstOptionHTML;
        options.forEach(opt => {
            selectElement.innerHTML += `<option value="${opt}">${opt}</option>`;
        });
    }
    
    function showUserId(uid) {
        const displays = document.querySelectorAll('#userIdDisplay');
        displays.forEach(display => {
            if (display) {
                // Kullanıcı ID'sini daha okunabilir yap
                display.textContent = `Kullanıcı: #${uid.substring(0, 8)}...`;
            }
        });
    }

    // Çıkış yapma fonksiyonu
    function handleLogout() {
        console.log("Çıkış yapılıyor...");
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot(); // Firestore dinleyicisini kapat
            console.log("Firestore dinleyicisi kapatıldı.");
        }
        signOut(auth).then(() => {
            console.log("Çıkış başarılı.");
            window.location.href = 'auth.html'; // Giriş sayfasına yönlendir
        }).catch((error) => {
            console.error("Çıkış hatası:", error);
        });
    }
    
    // index.html'deki çıkış butonuna listener ekle
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // --- 5. ANA KİMLİK DOĞRULAMA MANTIĞI (TÜM SAYFALARI KONTROL EDER) ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // --- KULLANICI GİRİŞ YAPTI ---
            console.log("Kullanıcı durumu değişti: Giriş yapıldı", user.uid);
            currentUserId = user.uid;
            showUserId(currentUserId);
            
            // Kullanıcıya özel Firestore koleksiyonunu ayarla
            mediaCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/media`);

            if (pageName === 'auth.html') {
                // Zaten giriş yapmış ve auth sayfasında, anasayfaya yönlendir
                console.log("Giriş yapılmış, auth.html'den index.html'e yönlendiriliyor.");
                window.location.href = 'index.html';
            } else {
                // Doğru sayfadasın, o sayfanın mantığını çalıştır
                runPageSpecificLogic(true); 
            }
        } else {
            // --- KULLANICI GİRİŞ YAPMADI ---
            console.log("Kullanıcı durumu değişti: Çıkış yapıldı veya misafir");
            currentUserId = null;
            
            if (pageName !== 'auth.html') {
                // Korumalı bir sayfada (örn: index) ama giriş yapmamış, auth'a yönlendir
                console.log("Giriş yapılmamış, korumalı sayfadan auth.html'e yönlendiriliyor.");
                window.location.href = 'auth.html';
            } else {
                // Zaten auth sayfasında, giriş yapma mantığını çalıştır
                runPageSpecificLogic(false);
            }
        }
    });

    /**
     * Hangi sayfada olduğumuzu kontrol eder ve o sayfanın ana fonksiyonlarını çalıştırır.
     */
    function runPageSpecificLogic(isLoggedIn) {
        
        // --- AUTH.HTML MANTIĞI ---
        if (pageName === 'auth.html') {
            if (!isLoggedIn) {
                // Kullanıcı giriş yapmamış, giriş yapmayı dene
                // __initial_auth_token global değişkeni auth.html'de bulunur
                const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                const authMessage = document.getElementById('authMessage');
                
                if (initialAuthToken) {
                    console.log("Özel token ile giriş deneniyor...");
                    signInWithCustomToken(auth, initialAuthToken)
                        .catch((error) => {
                            console.error("Özel token girişi başarısız:", error);
                            authMessage.innerHTML = `<p style="color: var(--error-color);">Giriş başarısız oldu. Lütfen tekrar deneyin.</p>`;
                        });
                } else {
                    // Token yoksa (örn: lokal test), anonim giriş yap
                    console.log("Token yok, anonim giriş deneniyor...");
                    signInAnonymously(auth)
                        .catch((error) => {
                            console.error("Anonim giriş başarısız:", error);
                            authMessage.innerHTML = `<p style="color: var(--error-color);">Anonim giriş başarısız oldu.</p>`;
                        });
                }
            }
        }
        
        // Giriş yapmış kullanıcılar için diğer sayfaların mantığı
        if (!isLoggedIn) return; // Giriş yapmadıysa, aşağıdaki kodlar çalışmasın

        // --- INDEX.HTML MANTIĞI ---
        if (pageName === 'index.html' || pageName === '') {
            runIndexLogic();
        }
        
        // --- FORM.HTML MANTIĞI ---
        if (pageName === 'form.html') {
            runFormLogic();
        }
        
        // --- STATS.HTML MANTIĞI ---
        if (pageName === 'stats.html') {
            runStatsLogic();
        }
    }

    // --- 6. SAYFAYA ÖZEL FONKSİYONLAR ---

    // ===================================
    //      INDEX.HTML MANTIĞI
    // ===================================
    function runIndexLogic() {
        const mediaListContainer = document.getElementById('mediaListContainer');
        const emptyState = document.getElementById('emptyState');
        const filterKategori = document.getElementById('filterKategori');
        const filterDurum = document.getElementById('filterDurum');
        const filterPuan = document.getElementById('filterPuan');
        const filterSiralama = document.getElementById('filterSiralama');
        const searchBar = document.getElementById('searchBar');
        
        // Eğer index.html'de değilsek (örn. app.js'i import eden form.html'deysek)
        // bu elementler null olur, hata almamak için kontrol et
        if (!mediaListContainer) return;

        populateDropdown(filterKategori, ANA_KATEGORILER);
        populateDropdown(filterDurum, DURUMLAR);

        function renderList() {
            // Filtre değerleri
            const kategori = filterKategori.value;
            const durum = filterDurum.value;
            const puan = parseInt(filterPuan.value) || 0;
            const siralama = filterSiralama.value;
            const arama = searchBar.value.toLowerCase().trim();

            let filteredList = mediaList.filter(item => {
                const kategoriMatch = (kategori === 'all' || item.kategori === kategori);
                const durumMatch = (durum === 'all' || item.durum === durum);
                const puanMatch = (puan === 0 || (parseInt(item.puan) || 0) >= puan);
                const aramaMatch = (arama === '' ||
                    item.baslik.toLowerCase().includes(arama) ||
                    (item.yazar && item.yazar.toLowerCase().includes(arama)) ||
                    (item.tur && item.tur.toLowerCase().includes(arama))
                );
                return kategoriMatch && durumMatch && puanMatch && aramaMatch;
            });

            // Sırala
            switch (siralama) {
                case 'baslik-asc':
                    filteredList.sort((a, b) => a.baslik.localeCompare(b.baslik, 'tr'));
                    break;
                case 'baslik-desc':
                    filteredList.sort((a, b) => b.baslik.localeCompare(a.baslik, 'tr'));
                    break;
                case 'puan-desc':
                    filteredList.sort((a, b) => (parseInt(b.puan) || 0) - (parseInt(a.puan) || 0));
                    break;
                case 'puan-asc':
                    filteredList.sort((a, b) => (parseInt(a.puan) || 0) - (parseInt(b.puan) || 0));
                    break;
                case 'tarih-desc':
                default:
                    // Firestore'dan gelen veride 'createdAt' alanı olmalı (addDoc ile eklenir)
                    // Eğer yoksa, ID'ye (genellikle zamana dayalı) göre sırala
                    filteredList.sort((a, b) => (b.createdAt || b.id) - (a.createdAt || a.id));
                    break;
            }

            if (filteredList.length === 0) {
                emptyState.style.display = 'block';
                mediaListContainer.innerHTML = '';
            } else {
                emptyState.style.display = 'none';
                mediaListContainer.innerHTML = filteredList.map(createMediaCardHTML).join('');
            }
            bindDynamicCardListeners();
        }
        
        function createMediaCardHTML(item) {
            const mevcut = parseInt(item.mevcutIlerleme) || 0;
            const toplam = parseInt(item.toplamDeger) || 0;
            let progressPercent = 0;
            let progressText = `${mevcut} / ${toplam} ${item.ilerlemeBirimi || ''}`;
            
            if (toplam > 0) progressPercent = (mevcut / toplam) * 100;
            if (toplam === 0) progressText = item.durum === 'Tamamlandı' ? 'Tamamlandı' : 'İlerleme girilmedi';
            if (item.durum === 'Tamamlandı') progressPercent = 100;

            const ratingStars = item.puan > 0 ? `<i class="fas fa-star"></i> ${item.puan}/5` : '<i class="far fa-star"></i> Puanlanmadı';
            const thumbnailHTML = item.thumbnailData ? `<img src="${item.thumbnailData}" alt="${item.baslik}">` : `<i class="fas fa-image placeholder-icon"></i>`;

            return `
                <div class="media-card" data-id="${item.id}">
                    <div class="thumbnail">${thumbnailHTML}</div>
                    <div class="card-content">
                        <div class="card-header">
                            <h3>${item.baslik}</h3>
                            <span class="status-badge" data-status="${item.durum}">${item.durum}</span>
                        </div>
                        <div class="card-meta">
                            <span class="card-author">${item.yazar || 'Bilinmiyor'}</span>
                            <span class="card-rating">${ratingStars}</span>
                        </div>
                        <div class="progress-info">
                            <span>Aşamalı İlerleme (${progressText})</span>
                            <div class="progress-bar-container"><div class="progress-bar" style="width: ${progressPercent}%;"></div></div>
                        </div>
                    </div>
                </div>`;
        }
        
        function bindDynamicCardListeners() {
            document.querySelectorAll('.media-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    window.location.href = `form.html?id=${e.currentTarget.dataset.id}`;
                });
            });
        }

        // Filtre dinleyicileri
        [filterKategori, filterDurum, filterPuan, filterSiralama].forEach(el => {
            el.addEventListener('change', renderList);
        });
        searchBar.addEventListener('input', renderList);

        // Firestore'dan verileri dinle
        if (unsubscribeSnapshot) unsubscribeSnapshot(); // Önceki dinleyiciyi kapat
        unsubscribeSnapshot = onSnapshot(mediaCollectionRef, (snapshot) => {
            console.log("Firestore verisi güncellendi.");
            mediaList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            
            // Veri yüklendikten sonra spinner'ı gizle
            const spinner = emptyState.querySelector('.spinner');
            if(spinner) spinner.style.display = 'none';

            renderList(); // Veri her değiştiğinde listeyi yeniden çiz
        }, (error) => {
            console.error("Firestore dinleme hatası:", error);
            emptyState.innerHTML = `<p style="color: var(--error-color);">Veriler yüklenemedi. Lütfen sayfayı yenileyin.</p>`;
        });
    }

    // ===================================
    //      FORM.HTML MANTIĞI
    // ===================================
    function runFormLogic() {
        const mediaForm = document.getElementById('mediaForm');
        
        // Eğer form.html'de değilsek (örn. index.html)
        if (!mediaForm) return;

        // Form elemanları
        const formTitle = document.getElementById('formTitle');
        const formItemId = document.getElementById('formItemId');
        const formBaslik = document.getElementById('formBaslik');
        const formKategori = document.getElementById('formKategori');
        const formDurum = document.getElementById('formDurum');
        const formYazar = document.getElementById('formYazar');
        const formTur = document.getElementById('formTur');
        const formAciklama = document.getElementById('formAciklama');
        const formMevcutIlerleme = document.getElementById('formMevcutIlerleme');
        const formToplamDeger = document.getElementById('formToplamDeger');
        const formIlerlemeBirimi = document.getElementById('formIlerlemeBirimi');
        const formPuan = document.getElementById('formPuan');
        const formStarRating = document.getElementById('formStarRating');
        const formBaglanti = document.getElementById('formBaglanti');
        const formHedefTarih = document.getElementById('formHedefTarih');
        const formNotlar = document.getElementById('formNotlar');
        const thumbnailButton = document.getElementById('thumbnailButton');
        const formThumbnailInput = document.getElementById('formThumbnailInput');
        const formThumbnailData = document.getElementById('formThumbnailData');
        const thumbnailPreviewImage = document.getElementById('thumbnailPreviewImage');
        const thumbnailPlaceholder = document.getElementById('thumbnailPlaceholder');
        const deleteButton = document.getElementById('deleteButton');
        const cancelButton = document.getElementById('cancelButton');
        const aiGenerateButton = document.getElementById('aiGenerateButton');
        const formButtonsContainer = document.querySelector('.form-buttons');


        populateDropdown(formKategori, ANA_KATEGORILER);
        populateDropdown(formDurum, DURUMLAR);
        populateDropdown(formIlerlemeBirimi, BIRIMLER);

        function updateStarRating(value) {
            formPuan.value = value;
            formStarRating.querySelectorAll('.star').forEach(star => {
                const filled = parseInt(star.dataset.value) <= parseInt(value);
                star.classList.toggle('filled', filled);
                star.innerHTML = filled ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
            });
        }

        function resetForm() {
            mediaForm.reset();
            formItemId.value = '';
            formPuan.value = '0';
            formThumbnailData.value = '';
            updateStarRating(0);
            formTitle.textContent = 'Yeni Öğe Ekle';
            deleteButton.style.display = 'none';
            formButtonsContainer.classList.remove('edit-mode'); // CSS sınıfını kaldır
            thumbnailPreviewImage.style.display = 'none';
            thumbnailPlaceholder.style.display = 'block';
        }

        async function loadItemForEdit(itemId) {
            try {
                const docRef = doc(db, `artifacts/${appId}/users/${currentUserId}/media`, itemId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const item = docSnap.data();
                    formTitle.textContent = 'Öğe Ekle/Düzenle';
                    formItemId.value = docSnap.id;
                    formBaslik.value = item.baslik;
                    formKategori.value = item.kategori;
                    formDurum.value = item.durum;
                    formYazar.value = item.yazar || '';
                    formTur.value = item.tur || '';
                    formAciklama.value = item.aciklama || '';
                    formMevcutIlerleme.value = item.mevcutIlerleme || 0;
                    formToplamDeger.value = item.toplamDeger || 0;
                    formIlerlemeBirimi.value = item.ilerlemeBirimi || '';
                    formPuan.value = item.puan || 0;
                    formBaglanti.value = item.baglanti || '';
                    formHedefTarih.value = item.hedefTarih || '';
                    formNotlar.value = item.notlar || '';
                    formThumbnailData.value = item.thumbnailData || '';
                    
                    updateStarRating(item.puan || 0);
                    
                    if (item.thumbnailData) {
                        thumbnailPreviewImage.src = item.thumbnailData;
                        thumbnailPreviewImage.style.display = 'block';
                        thumbnailPlaceholder.style.display = 'none';
                    }
                    
                    deleteButton.style.display = 'block';
                    formButtonsContainer.classList.add('edit-mode'); // CSS sınıfını ekle
                } else {
                    console.error("Düzenlenecek öğe bulunamadı!");
                    resetForm();
                }
            } catch (error) {
                console.error("Öğe yükleme hatası:", error);
            }
        }

        async function handleSave(event) {
            event.preventDefault();
            if (!formBaslik.value || !formKategori.value || !formDurum.value) {
                // Gerçek bir alert/modal kullan
                console.error("Başlık, Kategori ve Durum zorunlu alanlardır.");
                return;
            }

            const itemId = formItemId.value;
            const itemData = {
                baslik: formBaslik.value,
                kategori: formKategori.value,
                durum: formDurum.value,
                yazar: formYazar.value,
                tur: formTur.value,
                aciklama: formAciklama.value,
                mevcutIlerleme: formMevcutIlerleme.value,
                toplamDeger: formToplamDeger.value,
                ilerlemeBirimi: formIlerlemeBirimi.value,
                puan: formPuan.value,
                baglanti: formBaglanti.value,
                hedefTarih: formHedefTarih.value,
                notlar: formNotlar.value,
                thumbnailData: formThumbnailData.value,
                updatedAt: new Date().toISOString(), // Güncelleme tarihi ekle
            };

            try {
                if (itemId) {
                    // Düzenle
                    const docRef = doc(db, `artifacts/${appId}/users/${currentUserId}/media`, itemId);
                    await setDoc(docRef, itemData, { merge: true }); // merge: true = update
                    console.log("Öğe güncellendi:", itemId);
                } else {
                    // Yeni Ekle
                    itemData.createdAt = new Date().toISOString(); // Oluşturma tarihi ekle
                    const docRef = await addDoc(mediaCollectionRef, itemData);
                    console.log("Öğe eklendi:", docRef.id);
                }
                window.location.href = 'index.html'; // Kayıttan sonra anasayfaya dön
            } catch (error) {
                console.error("Kaydetme hatası:", error);
            }
        }

        async function handleDelete() {
            const itemId = formItemId.value;
            if (!itemId) return;

            // Gerçek bir onay modal'ı gerekir, şimdilik confirm kullanıyoruz
            if (confirm("Bu öğeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
                try {
                    const docRef = doc(db, `artifacts/${appId}/users/${currentUserId}/media`, itemId);
                    await deleteDoc(docRef);
                    console.log("Öğe silindi:", itemId);
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error("Silme hatası:", error);
                }
            }
        }

        // AI Fonksiyonu
        async function handleAiGenerate() {
            const title = formBaslik.value;
            if (!title) {
                // Gerçek bir uyarı modal'ı kullan
                console.warn("Lütfen bir başlık girin.");
                return;
            }
            
            aiGenerateButton.disabled = true;
            aiGenerateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Oluşturuluyor...';
            
            // Canvas ortamı API key'i otomatik sağlar
            const apiKey = ""; 
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{ 
                    parts: [{ 
                        text: `Şu medya başlığı için kısa, 1-2 cümlelik, Türkçe bir özet oluştur: "${title}"` 
                    }] 
                }]
            };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API hatası: ${response.status} - ${errorText}`);
                }
                
                const result = await response.json();
                
                if (result.candidates && result.candidates.length > 0) {
                    const text = result.candidates[0].content.parts[0].text;
                    formAciklama.value = text; // Açıklama kutusunu doldur
                } else {
                    throw new Error("API'den geçerli bir yanıt alınamadı.");
                }
                
            } catch (error) {
                console.error("AI oluşturma hatası:", error);
                // Gerçek bir hata modal'ı kullan
            } finally {
                aiGenerateButton.disabled = false;
                aiGenerateButton.innerHTML = '<i class="fas fa-sparkles"></i> AI ile Oluştur';
            }
        }

        // Form dinleyicileri
        mediaForm.addEventListener('submit', handleSave);
        deleteButton.addEventListener('click', handleDelete);
        aiGenerateButton.addEventListener('click', handleAiGenerate);
        formStarRating.addEventListener('click', (e) => {
            const star = e.target.closest('.star');
            if (star) updateStarRating(star.dataset.value);
        });
        thumbnailButton.addEventListener('click', () => formThumbnailInput.click());
        formThumbnailInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 1 * 1024 * 1024) { // 1MB
                console.error("Dosya boyutu 1MB'dan büyük olamaz.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                formThumbnailData.value = event.target.result; // Base64 verisini gizli alana kaydet
                thumbnailPreviewImage.src = event.target.result;
                thumbnailPreviewImage.style.display = 'block';
                thumbnailPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });

        // Sayfa yüklendiğinde düzenleme modunu kontrol et
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');
        if (editId) {
            loadItemForEdit(editId);
        } else {
            resetForm();
        }
    }

    // ===================================
    //      STATS.HTML MANTIĞI
    // ===================================
    function runStatsLogic() {
        // Eğer stats.html'de değilsek (örn. index.html)
        const statGenelToplam = document.getElementById('statGenelToplam');
        if (!statGenelToplam) return;

        function renderStats() {
            // mediaList (global) Firestore'dan gelen verileri içerir
            const total = mediaList.length;
            const tamamlanan = mediaList.filter(i => i.durum === 'Tamamlandı').length;
            const izleniyor = mediaList.filter(i => i.durum === 'İzleniyor').length;
            const okunuyor = mediaList.filter(i => i.durum === 'Okunuyor').length;
            
            statGenelToplam.textContent = total;
            document.getElementById('statToplamTamamlanan').textContent = tamamlanan;
            document.getElementById('statToplamIzleniyor').textContent = izleniyor;
            document.getElementById('statToplamOkunuyor').textContent = okunuyor;
            
            const toplamSayfa = mediaList
                .filter(i => (i.kategori === 'Kitap' || i.kategori === 'Roman') && i.ilerlemeBirimi === 'Sayfa')
                .reduce((sum, i) => sum + (parseInt(i.mevcutIlerleme) || 0), 0);
            const toplamWebMan = mediaList
                .filter(i => i.kategori === 'Webtoon' || i.kategori === 'Manga')
                .reduce((sum, i) => sum + (parseInt(i.mevcutIlerleme) || 0), 0);
            const toplamDiziAnime = mediaList
                .filter(i => i.kategori === 'Dizi' || i.kategori === 'Anime')
                .reduce((sum, i) => sum + (parseInt(i.mevcutIlerleme) || 0), 0);
            const toplamFilm = mediaList
                .filter(i => i.kategori === 'Film' && i.durum === 'Tamamlandı')
                .length;
            
            document.getElementById('statToplamSayfa').textContent = toplamSayfa;
            document.getElementById('statToplamWebMan').textContent = toplamWebMan;
            document.getElementById('statToplamDiziAnime').textContent = toplamDiziAnime;
            document.getElementById('statToplamFilm').textContent = toplamFilm;
            
            ANA_KATEGORILER.forEach(cat => {
                const count = mediaList.filter(i => i.kategori === cat && i.durum === 'Tamamlandı').length;
                const elId = `statComp${cat.replace(/ /g, '')}`;
                const el = document.getElementById(elId);
                if (el) el.textContent = count;
            });
        }

        // Firestore'dan verileri dinle
        if (unsubscribeSnapshot) unsubscribeSnapshot(); // Önceki dinleyiciyi kapat
        unsubscribeSnapshot = onSnapshot(mediaCollectionRef, (snapshot) => {
            console.log("Firestore verisi güncellendi (Stats).");
            mediaList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            renderStats(); // Veri her değiştiğinde istatistikleri yeniden çiz
        }, (error) => {
            console.error("Firestore dinleme hatası (Stats):", error);
        });
    }

}); // --- DOM BAŞLANGIÇ BİTİŞİ ---
