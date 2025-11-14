document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SABİTLER VE ORTAK FONKSİYONLAR ---
    const DB_NAME = 'ellolist_media_db';
    let mediaList = [];
    let currentUserId = '';

    // GÜNCELLEME: "KATEGORILER" ana kategori oldu
    const ANA_KATEGORILER = [
        "Kitap", "Roman", "Webtoon", "Manga", "Film", "Dizi", "Anime", "Müzik", "Podcast", "Diğer"
    ];

    const DURUMLAR = [
        "Planlandı", "İzleniyor", "Okunuyor", "Beklemede", "Bırakıldı", "Tamamlandı"
    ];
    
    const BIRIMLER = [
        "Bölüm", "Sayfa", "Sezon", "Cilt", "Film", "Kitap", "Parça", "Dakika", "Diğer"
    ];

    function saveList() {
        localStorage.setItem(DB_NAME, JSON.stringify(mediaList));
    }

    function loadList() {
        const data = localStorage.getItem(DB_NAME);
        mediaList = data ? JSON.parse(data) : [];
    }
    
    function getOrCreateUserId() {
        let uid = localStorage.getItem('ellolist_user_id');
        if (!uid) {
            uid = `ellolist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem('ellolist_user_id', uid);
        }
        currentUserId = uid;
        return uid;
    }

    /**
     * DÜZELTME: Bu fonksiyon JS çökmesini engellemek için yeniden yazıldı.
     * Bir select elementini, ilk seçeneğini (örn: "Seçiniz...") koruyarak doldurur.
     */
    function populateDropdown(selectElement, options) {
        if (!selectElement) return;
        
        // İlk seçeneği (Seçiniz... veya Tüm...) HTML olarak sakla
        const firstOptionHTML = selectElement.options[0] ? selectElement.options[0].outerHTML : '';
        
        selectElement.innerHTML = firstOptionHTML; // Önce sadece ilk seçeneği ayarla
        
        // Sonra kalan seçenekleri ekle
        options.forEach(opt => {
            selectElement.innerHTML += `<option value="${opt}">${opt}</option>`;
        });
    }

    // --- 2. SAYFA TESPİTİ VE ÖZEL LOGIC ---
    loadList(); 
    const pageName = window.location.pathname.split('/').pop() || 'index.html';

    // --- ======================= ---
    // --- ===== LİSTE SAYFASI ===== ---
    // --- ======================= ---
    if (pageName === 'index.html' || pageName === '') {
        
        const mediaListContainer = document.getElementById('mediaListContainer');
        const emptyState = document.getElementById('emptyState');
        const userIdDisplay = document.getElementById('userIdDisplay');
        const filterKategori = document.getElementById('filterKategori');
        const filterDurum = document.getElementById('filterDurum');
        const filterPuan = document.getElementById('filterPuan');
        const filterSiralama = document.getElementById('filterSiralama');
        const searchBar = document.getElementById('searchBar');

        const uid = getOrCreateUserId();
        if (userIdDisplay) {
            userIdDisplay.textContent = `Kullanıcı ID: #${uid.substring(9, 18)}`;
        }

        // Dropdown'ları doldur (Ana Kategoriler ile)
        populateDropdown(filterKategori, ANA_KATEGORILER);
        populateDropdown(filterDurum, DURUMLAR);
        
        function renderList() {
            const kategori = filterKategori.value;
            const durum = filterDurum.value;
            const puan = parseInt(filterPuan.value) || 0;
            const siralama = filterSiralama.value;
            const arama = searchBar.value.toLowerCase().trim();

            let filteredList = mediaList.filter(item => {
                const kategoriMatch = (kategori === 'all' || item.kategori === kategori);
                const durumMatch = (durum === 'all' || item.durum === durum);
                const puanMatch = (puan === 0 || (parseInt(item.puan) || 0) >= puan);
                
                // GÜNCELLEME: Arama artık "tur" (etiketler) alanını da kontrol ediyor
                const aramaMatch = (arama === '' ||
                    item.baslik.toLowerCase().includes(arama) ||
                    (item.yazar && item.yazar.toLowerCase().includes(arama)) ||
                    (item.tur && item.tur.toLowerCase().includes(arama)) // 'tur' alanı etiketler oldu
                );
                return kategoriMatch && durumMatch && puanMatch && aramaMatch;
            });

            // Sıralama (değişiklik yok)
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
                    filteredList.sort((a, b) => (b.id || 0) - (a.id || 0));
                    break;
            }

            if (filteredList.length === 0) {
                emptyState.style.display = 'block';
                mediaListContainer.innerHTML = '';
            } else {
                emptyState.style.display = 'none';
                mediaListContainer.innerHTML = filteredList.map(item => createMediaCardHTML(item)).join('');
            }
            
            bindDynamicCardListeners();
        }
        
        function createMediaCardHTML(item) {
            const mevcut = parseInt(item.mevcutIlerleme) || 0;
            const toplam = parseInt(item.toplamDeger) || 0;
            let progressPercent = 0;
            let progressText = `${mevcut} / ${toplam} ${item.ilerlemeBirimi || ''}`;
            
            if (toplam > 0) {
                progressPercent = (mevcut / toplam) * 100;
            }
            if (toplam === 0) {
                progressText = item.durum === 'Tamamlandı' ? 'Tamamlandı' : 'İlerleme girilmedi';
            }
            if (item.durum === 'Tamamlandı') {
                progressPercent = 100;
            }

            const ratingStars = item.puan > 0 
                ? `<i class="fas fa-star"></i> ${item.puan}/5` 
                : '<i class="far fa-star"></i> Puanlanmadı';
                
            const thumbnailHTML = item.thumbnailData
                ? `<img src="${item.thumbnailData}" alt="${item.baslik}">`
                : `<i class="fas fa-image placeholder-icon"></i>`;

            return `
                <div class="media-card" data-id="${item.id}">
                    <div class="thumbnail">
                        ${thumbnailHTML}
                    </div>
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
                            <div class="progress-bar-container">
                                <div class="progress-bar" style="width: ${progressPercent}%;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function bindDynamicCardListeners() {
            document.querySelectorAll('.media-card').forEach(card => {
                card.addEventListener('click', handleCardClick);
            });
        }
        
        function handleCardClick(event) {
            const card = event.currentTarget;
            const itemId = card.dataset.id;
            window.location.href = `form.html?id=${itemId}`;
        }

        // Event Listeners (index.html'e özel)
        filterKategori.addEventListener('change', renderList);
        filterDurum.addEventListener('change', renderList);
        filterPuan.addEventListener('change', renderList);
        filterSiralama.addEventListener('change', renderList);
        searchBar.addEventListener('input', renderList);

        renderList();
    }

    // --- ======================= ---
    // --- ===== FORM SAYFASI ====== ---
    // --- ======================= ---
    else if (pageName === 'form.html') {
        
        const mediaForm = document.getElementById('mediaForm');
        const formTitle = document.getElementById('formTitle');
        const formItemId = document.getElementById('formItemId');
        const formBaslik = document.getElementById('formBaslik');
        const formKategori = document.getElementById('formKategori');
        const formDurum = document.getElementById('formDurum');
        const formYazar = document.getElementById('formYazar');
        const formTur = document.getElementById('formTur'); // Bu artık etiketler
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
        const thumbnailPreview = document.getElementById('thumbnailPreview');
        const thumbnailPreviewImage = document.getElementById('thumbnailPreviewImage');
        const thumbnailPlaceholder = document.getElementById('thumbnailPlaceholder');
        const deleteButton = document.getElementById('deleteButton');
        const cancelButton = document.getElementById('cancelButton');

        function updateStarRating(value) {
            const stars = formStarRating.querySelectorAll('.star');
            stars.forEach(star => {
                if (parseInt(star.dataset.value) <= parseInt(value)) {
                    star.classList.add('filled');
                    star.innerHTML = '<i class="fas fa-star"></i>';
                } else {
                    star.classList.remove('filled');
                    star.innerHTML = '<i class="far fa-star"></i>';
                }
            });
            formPuan.value = value;
        }

        function resetForm() {
            mediaForm.reset();
            formItemId.value = '';
            formPuan.value = '0';
            formThumbnailData.value = '';
            updateStarRating(0);
            formTitle.textContent = 'Yeni Öğe Ekle';
            
            deleteButton.style.display = 'none';
            cancelButton.style.gridColumn = '1 / -1'; // Tam genişlik
            
            thumbnailPreviewImage.style.display = 'none';
            thumbnailPreviewImage.src = '';
            thumbnailPlaceholder.style.display = 'block';
        }
        
        function loadItemForEdit(itemId) {
             const item = mediaList.find(i => i.id === itemId);
             if (!item) {
                console.error("Öğe bulunamadı!");
                window.location.href = 'index.html';
                return;
             }
             
             formTitle.textContent = 'Öğe Ekle/Düzenle';
             formItemId.value = item.id;
             formBaslik.value = item.baslik;
             formKategori.value = item.kategori;
             formDurum.value = item.durum;
             formYazar.value = item.yazar || '';
             formTur.value = item.tur || ''; // Etiketler
             formAciklama.value = item.aciklama || '';
             formMevcutIlerleme.value = item.mevcutIlerleme || 0;
             formToplamDeger.value = item.toplamDeger || 0;
             formIlerlemeBirimi.value = item.ilerlemeBirimi || BIRIMLER[0];
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
             cancelButton.style.gridColumn = 'auto'; // Normal genişlik
        }
        
        function handleSave(event) {
            event.preventDefault();
            
            if (!formBaslik.value || !formKategori.value || !formDurum.value) {
                console.error("Zorunlu alanlar (Başlık, Kategori, Durum) doldurulmalıdır.");
                formBaslik.reportValidity();
                formKategori.reportValidity();
                formDurum.reportValidity();
                return;
            }
            
            const itemId = formItemId.value;
            const itemData = {
                baslik: formBaslik.value,
                kategori: formKategori.value, // Ana Kategori
                durum: formDurum.value,
                yazar: formYazar.value,
                tur: formTur.value, // Etiketler
                aciklama: formAciklama.value,
                mevcutIlerleme: formMevcutIlerleme.value,
                toplamDeger: formToplamDeger.value,
                ilerlemeBirimi: formIlerlemeBirimi.value,
                puan: formPuan.value,
                baglanti: formBaglanti.value,
                hedefTarih: formHedefTarih.value,
                notlar: formNotlar.value,
                thumbnailData: formThumbnailData.value,
            };

            if (itemId) {
                mediaList = mediaList.map(item => 
                    item.id === itemId ? { ...item, ...itemData, id: itemId } : item
                );
            } else {
                itemData.id = Date.now().toString();
                mediaList.push(itemData);
            }
            
            saveList();
            window.location.href = 'index.html';
        }
        
        function handleDelete() {
            const itemId = formItemId.value;
            if (!itemId) return;
            
            // Gerçek bir uygulamada burada onay gerekir, ancak prompt/alert yasak.
            mediaList = mediaList.filter(item => item.id !== itemId);
            saveList();
            window.location.href = 'index.html';
        }

        thumbnailButton.addEventListener('click', () => {
            formThumbnailInput.click();
        });
        
        formThumbnailInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.size > 1 * 1024 * 1024) { // 1MB
                console.warn("Dosya boyutu çok büyük! Maksimum 1MB.");
                formThumbnailInput.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = event.target.result;
                formThumbnailData.value = base64String;
                thumbnailPreviewImage.src = base64String;
                thumbnailPreviewImage.style.display = 'block';
                thumbnailPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
        
        mediaForm.addEventListener('submit', handleSave);
        deleteButton.addEventListener('click', handleDelete);
        formStarRating.addEventListener('click', (e) => {
            const star = e.target.closest('.star');
            if (star) {
                updateStarRating(star.dataset.value);
            }
        });

        // --- Başlatma (form.html'e özel) ---
        
        // Dropdown'ları doldur (Ana Kategoriler ile)
        populateDropdown(formKategori, ANA_KATEGORILER);
        populateDropdown(formDurum, DURUMLAR);
        populateDropdown(formIlerlemeBirimi, BIRIMLER);
        
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');
        
        if (editId) {
            loadItemForEdit(editId);
        } else {
            resetForm();
        }
    }

    // --- ======================= ---
    // --- ==== İSTATİSTİK SAYFASI === ---
    // --- ======================= ---
    else if (pageName === 'stats.html') {
        
        function renderStats() {
            const total = mediaList.length;
            const tamamlanan = mediaList.filter(i => i.durum === 'Tamamlandı').length;
            const izleniyor = mediaList.filter(i => i.durum === 'İzleniyor').length;
            const okunuyor = mediaList.filter(i => i.durum === 'Okunuyor').length;
            
            document.getElementById('statGenelToplam').textContent = total;
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
            
            // İstatistikleri Ana Kategorilere göre hesapla
            ANA_KATEGORILER.forEach(cat => {
                const count = mediaList.filter(i => i.kategori === cat && i.durum === 'Tamamlandı').length;
                const elId = `statComp${cat.replace(/ /g, '')}`; // Örn: statCompWebtoon
                const el = document.getElementById(elId);
                if (el) {
                    el.textContent = count;
                }
            });
        }

        renderStats();
    }
});
