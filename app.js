document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SABİTLER VE ORTAK FONKSİYONLAR ---
    const DB_NAME = 'ellolist_media_db';
    let mediaList = [];
    let currentUserId = '';

    const KATEGORILER = [
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

    // Dropdown doldurma (ortak)
    function populateDropdown(selectElement, options) {
        if (!selectElement) return;
        
        // İlk seçeneği (Seçiniz... veya Tüm...) koru
        const firstOption = selectElement.options[0];
        selectElement.innerHTML = '';
        selectElement.appendChild(firstOption);
        
        options.forEach(opt => {
            selectElement.innerHTML += `<option value="${opt}">${opt}</option>`;
        });
    }

    // --- 2. SAYFA TESPİTİ VE ÖZEL LOGIC ---
    // Önce veriyi yükle, sonra hangi sayfada olduğumuza bakalım
    loadList(); 
    const pageName = window.location.pathname.split('/').pop() || 'index.html';

    // --- ======================= ---
    // --- ===== LİSTE SAYFASI ===== ---
    // --- ======================= ---
    if (pageName === 'index.html' || pageName === '') {
        
        // DOM Elemanları (index.html'e özel)
        const mediaListContainer = document.getElementById('mediaListContainer');
        const emptyState = document.getElementById('emptyState');
        const userIdDisplay = document.getElementById('userIdDisplay');
        const filterKategori = document.getElementById('filterKategori');
        const filterDurum = document.getElementById('filterDurum');
        const filterPuan = document.getElementById('filterPuan');
        const filterSiralama = document.getElementById('filterSiralama');
        const searchBar = document.getElementById('searchBar');

        // ID'yi göster
        const uid = getOrCreateUserId();
        if (userIdDisplay) {
            userIdDisplay.textContent = `Kullanıcı ID: #${uid.substring(9, 18)}`;
        }

        // Dropdown'ları doldur
        populateDropdown(filterKategori, KATEGORILER);
        populateDropdown(filterDurum, DURUMLAR);
        
        // --- Liste Fonksiyonları (index.html'e özel) ---

        function renderList() {
            // Filtre değerlerini al
            const kategori = filterKategori.value;
            const durum = filterDurum.value;
            const puan = parseInt(filterPuan.value) || 0;
            const siralama = filterSiralama.value;
            const arama = searchBar.value.toLowerCase().trim();

            // Filtrele
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
                    filteredList.sort((a, b) => (b.id || 0) - (a.id || 0)); // ID (tarih) bazlı
                    break;
            }

            // Boş durum kontrolü
            if (filteredList.length === 0) {
                emptyState.style.display = 'block';
                mediaListContainer.innerHTML = '';
            } else {
                emptyState.style.display = 'none';
                // Kartları oluştur
                mediaListContainer.innerHTML = filteredList.map(item => createMediaCardHTML(item)).join('');
            }
            
            // Dinamik olarak oluşturulan kartlara event listener ekle
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
            // Düzenleme sayfasına ID ile yönlendir
            window.location.href = `form.html?id=${itemId}`;
        }

        // Event Listeners (index.html'e özel)
        filterKategori.addEventListener('change', renderList);
        filterDurum.addEventListener('change', renderList);
        filterPuan.addEventListener('change', renderList);
        filterSiralama.addEventListener('change', renderList);
        searchBar.addEventListener('input', renderList);

        // Başlat (index.html'e özel)
        renderList();
    }

    // --- ======================= ---
    // --- ===== FORM SAYFASI ====== ---
    // --- ======================= ---
    else if (pageName === 'form.html') {
        
        // DOM Elemanları (form.html'e özel)
        const mediaForm = document.getElementById('mediaForm');
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
        const thumbnailPreview = document.getElementById('thumbnailPreview');
        const thumbnailPreviewImage = document.getElementById('thumbnailPreviewImage');
        const thumbnailPlaceholder = document.getElementById('thumbnailPlaceholder');
        const deleteButton = document.getElementById('deleteButton');
        const cancelButton = document.getElementById('cancelButton'); // Bu artık bir <a>

        // --- Form Fonksiyonları (form.html'e özel) ---

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
            // Silme butonu gizliyken İptal butonunu ayarla
            cancelButton.style.gridColumn = '1 / -1'; // Tam genişlik
            
            // Thumbnail önizlemesini sıfırla
            thumbnailPreviewImage.style.display = 'none';
            thumbnailPreviewImage.src = '';
            thumbnailPlaceholder.style.display = 'block';
        }
        
        function loadItemForEdit(itemId) {
             const item = mediaList.find(i => i.id === itemId);
             if (!item) {
                console.error("Öğe bulunamadı!");
                window.location.href = 'index.html'; // Bulamazsa anasayfaya dön
                return;
             }
             
             formTitle.textContent = 'Öğe Ekle/Düzenle';
             formItemId.value = item.id;
             formBaslik.value = item.baslik;
             formKategori.value = item.kategori;
             formDurum.value = item.durum;
             formYazar.value = item.yazar || '';
             formTur.value = item.tur || '';
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
             
             // Silme butonunu göster ve grid'i ayarla
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
            };

            if (itemId) {
                // Düzenle
                mediaList = mediaList.map(item => 
                    item.id === itemId ? { ...item, ...itemData, id: itemId } : item // id'nin korunmasını sağla
                );
            } else {
                // Yeni Ekle
                itemData.id = Date.now().toString();
                mediaList.push(itemData);
            }
            
            saveList();
            // Kayıttan sonra anasayfaya dön
            window.location.href = 'index.html';
        }
        
        function handleDelete() {
            const itemId = formItemId.value;
            if (!itemId) return;
            
            // Gerçek uygulamada burada bir onay (confirm) gerekir
            // if (confirm("Bu öğeyi silmek istediğinize emin misiniz?")) { ... }
            
            mediaList = mediaList.filter(item => item.id !== itemId);
            saveList();
            // Sildikten sonra anasayfaya dön
            window.location.href = 'index.html';
        }

        // --- Thumbnail Fonksiyonları (form.html'e özel) ---
        
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
        
        // --- Event Listeners (form.html'e özel) ---
        mediaForm.addEventListener('submit', handleSave);
        deleteButton.addEventListener('click', handleDelete);
        formStarRating.addEventListener('click', (e) => {
            const star = e.target.closest('.star');
            if (star) {
                updateStarRating(star.dataset.value);
            }
        });

        // --- Başlatma (form.html'e özel) ---
        
        // Dropdown'ları doldur
        populateDropdown(formKategori, KATEGORILER);
        populateDropdown(formDurum, DURUMLAR);
        populateDropdown(formIlerlemeBirimi, BIRIMLER);
        
        // URL'den ID'yi kontrol et (Düzenleme modu için)
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
        
        // --- Stats Fonksiyonu (stats.html'e özel) ---
        
        function renderStats() {
            const total = mediaList.length;
            const tamamlanan = mediaList.filter(i => i.durum === 'Tamamlandı').length;
            const izleniyor = mediaList.filter(i => i.durum === 'İzleniyor').length;
            const okunuyor = mediaList.filter(i => i.durum === 'Okunuyor').length;
            
            // ID'lerin varlığını kontrol et
            document.getElementById('statGenelToplam').textContent = total;
            document.getElementById('statToplamTamamlanan').textContent = tamamlanan;
            document.getElementById('statToplamIzleniyor').textContent = izleniyor;
            document.getElementById('statToplamOkunuyor').textContent = okunuyor;
            
            // Nicel İlerleme
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
            document.getEleme
