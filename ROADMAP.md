# Clean Browser — Özellik Yol Haritası

Sırayla üstten alta gidilecek. Her madde: **ne / neden**, _uygulama notu_, ⏱ efor.
Durum: ⬜ yapılmadı · 🟡 devam · ✅ bitti

---

## Tier 1 — En yüksek etki (önce bunlar)

### ✅ 1. Tam sayfa (scroll) yakalama
**Ne:** Sadece görünen alanı değil, sayfanın tüm yüksekliğini tek PNG olarak çek.
**Neden:** Bir screenshot aracının en çok istenen özelliği; landing page / uzun sayfalar için şart.
_Uygulama:_ webview'in `executeJavaScript` ile `scrollHeight`'ını al → webview'i geçici olarak tam yüksekliğe boyutla (veya `webContents.capturePage` yerine offscreen tam-yükseklik render) → çek → eski boyuta dön. Alternatif: `webview.getWebContentsId()` üzerinden main'de `webContents.capturePage()` ile parça parça çekip birleştir. Bara "Tam sayfa" toggle'ı veya ayrı buton.
⏱ Orta-yüksek (scroll/stitch mantığı).

### ✅ 2. Panoya kopyala
**Ne:** Çekimi dosyaya kaydetmeden doğrudan clipboard'a koy.
**Neden:** Slack/Figma/Notion'a hızlı yapıştırma — günlük kullanımın çoğu.
_Uygulama:_ main'de `clipboard.writeImage(nativeImage)`. Capture sonucu zaten `nativeImage`; yeni IPC `browser:copy`. Kısayol ⌘⇧C + menü öğesi. Toast "Panoya kopyalandı".
⏱ Düşük.

### ✅ 3. Export ölçeği (@1x/@2x/@3x) + format
**Ne:** Retina yüksek çözünürlük çıktı; PNG/JPEG/WebP + kalite.
**Neden:** Keskin görseller; JPEG ile küçük dosya.
_Uygulama:_ `capturePage` zaten cihaz DPI'ında çekiyor; ölçek için pencere/`zoomFactor` ayarı ya da `nativeImage.resize`. Format için `toPNG()/toJPEG(q)`. Settings'e "Export" bölümü (ölçek segmenti + format dropdown + kalite slider). Dosya adı template'i.
⏱ Düşük-orta.

### ✅ 4. Backdrop / arka plan preset'leri
**Ne:** Çerçevenin arkasına (padding alanına) gradient / düz renk / duvar kâğıdı / desen.
**Neden:** Screely/Pika/Shots tarzı paylaşılabilir "güzel screenshot"; en görünür kazanç.
_Uygulama:_ Zaten `--page-color` + `canvasPadding` altyapısı var. `.capture-canvas` background'ını gradient/görsel destekleyecek şekilde genişlet. Settings'e hazır preset galerisi (mesh gradient'ler, düz tonlar, "site renginden türet"). Padding'i de preset'e bağla.
⏱ Orta.

---

## Tier 2 — Çekim kalitesi

### ⬜ 5. Çekimden önce element gizleme / cookie banner kapatma
**Ne:** Çekimden hemen önce seçili elementleri veya yaygın cookie/consent banner'larını gizle.
**Neden:** Temiz shot'ın en büyük düşmanı pop-up'lar.
_Uygulama:_ webview'e `insertCSS` ile kullanıcı-tanımlı CSS + hazır "yaygın banner gizle" kuralları (`[id*=cookie], [class*=consent]…`). Settings'e textarea + "scrollbar gizle" toggle'ı. Çekim öncesi uygula, sonra geri al.
⏱ Orta.

### ✅ 6. Özel / sahte adres metni
**Ne:** Yüklenen URL `localhost:3000` iken barda `yoursite.com` göster.
**Neden:** Pazarlama/demo görselleri; gerçek URL'i sızdırmadan.
_Uygulama:_ Adres input'una "görüntülenen metin" override'ı (gerçek `currentUrl`'den ayrı bir state). `syncPageState` override varsa input'u ezmesin. Settings veya bar üzerinde küçük kilit/edit.
⏱ Düşük.

### ✅ 7. Scrollbar gizleme (çekimde)
**Ne:** Çekim anında sayfa scrollbar'larını gizle.
**Neden:** Daha temiz kenarlar.
_Uygulama:_ capture-mode sırasında webview'e `::-webkit-scrollbar{display:none}` inject. (#5 ile birlikte gidebilir.)
⏱ Düşük.

---

## Tier 3 — Tarayıcı / iş akışı

### ✅ 8. Durumu hatırlama (kalıcılık)
**Ne:** Son URL, pencere boyutu, bar görünürlük toggle'ları restart'ta korunsun.
**Neden:** Her açılışta yeniden kurmak yorucu.
_Uygulama:_ `chromeVisibility` ve son URL'i settings dosyasına/`localStorage`'a yaz. Açılışta geri yükle.
⏱ Düşük.

### ⬜ 9. Sayfa zoom kontrolü
**Ne:** Sayfayı büyüt/küçült (⌘+ / ⌘- / ⌘0).
**Neden:** Yoğun sayfaları sığdırmak / detay yakalamak.
_Uygulama:_ `webview.setZoomFactor()`. Menü + kısayol.
⏱ Düşük.

### ✅ 10. Özel boyut girişi (responsive mod)
**Ne:** Preset'lerin yanında elle genişlik×yükseklik gir.
**Neden:** Tam breakpoint testi.
_Uygulama:_ Bara/menüye küçük "WxH" input; `setWindowSize`. Mevcut preset altyapısını kullan.
⏱ Düşük-orta.

### ⬜ 11. Yer imleri / son URL'ler
**Ne:** Adres çubuğunda dropdown ile sık/son siteler.
**Neden:** Tekrar tekrar yazmamak.
_Uygulama:_ Son N URL'i sakla; adres input focus'ta liste. İsteğe bağlı sabitleme.
⏱ Orta.

### ⬜ 12. Yükleme progress bar'ı
**Ne:** Bar altında ince ilerleme çizgisi.
**Neden:** Geri bildirim; şu an sadece reload ikonu dönüyor.
_Uygulama:_ webview `did-start/stop-loading` + `did-fail-load` ile ince bir `.progress` elementi animasyonu.
⏱ Düşük.

---

## Tier 4 — Çerçeve stilleri

### ⬜ 13. Tarayıcı skin preset'leri
**Ne:** Safari / Chrome / minimal gibi hazır chrome stilleri.
**Neden:** Farklı sunum ihtiyaçları.
_Uygulama:_ Settings preset'leri (bar yüksekliği/renk/trafik ışığı stili/adres hizası kombinasyonları). Mevcut token sistemi buna hazır.
⏱ Orta.

### ✅ 14. Sosyal medya en-boy oranı preset'leri
**Ne:** 16:9, kare (1:1), story (9:16), OG (1200×630).
**Neden:** Doğrudan paylaşıma uygun çıktı.
_Uygulama:_ Pencere/canvas oranını sabitleyen preset'ler; #4 backdrop ile birlikte güçlü.
⏱ Orta.

### ✅ 15. Açık/Koyu chrome teması (manuel)
**Ne:** Auto-match'ten bağımsız elle açık/koyu bar.
**Neden:** Kontrol isteyen kullanıcı.
_Uygulama:_ `bar-dark` sınıfı + token sistemi zaten var; settings'e basit segment.
⏱ Düşük.

---

## Tier 5 — İleri / opsiyonel

### ⬜ 16. Annotasyon (ok, metin, blur/redaksiyon)
Çekim sonrası üstüne çizim; blur ile hassas bilgi gizleme. ⏱ Yüksek.

### ⬜ 17. Çekim geçmişi galerisi
Uygulama içinde son çekimler ızgarası, hızlı tekrar-aç / sil. ⏱ Orta-yüksek.

### ⬜ 18. Toplu / batch yakalama
URL listesi + seçili breakpoint'lerde otomatik çoklu çekim. ⏱ Yüksek.

### ⬜ 19. Kısayol cheatsheet
Tüm kısayolları gösteren küçük overlay (⌘/). ⏱ Düşük.

---

### Notlar
- Mevcut mimari: Electron + DOM `<webview>` (sayfa), `mainWindow.capturePage()` (çekim), settings dosyası + IPC broadcast, native menü.
- Çoğu Tier 1-2 özelliği mevcut `settings` + `capture` altyapısına temiz oturur; yeni IPC kanalı + settings alanı pattern'i tekrarlanır.
