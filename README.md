# ✂️ SilenceCutter Pro — Adobe Premiere Pro Sessizlik Kesici Eklentisiİ

**SilenceCutter Pro**, Adobe Premiere Pro'da timeline'a attığınız videolardaki sessiz kısımları (duraksamaları, boşlukları) milisaniye ve kare (frame) hassasiyetiyle tespit edip otomatik olarak kesen, kalan konuşmaları ses kayması olmadan uç uca birleştiren (**Ripple Delete**) profesyonel bir CEP eklentisidir.

---

## 🚀 Öne Çıkan Özellikler

1. **Sıfır Dış Bağımlılık (FFmpeg Kurulumu Gerektirmez!)**
   - İçerisinde Windows Media Foundation tabanlı yerel ses analiz motoru (`bin/AudioAnalyzer.exe` — kaynak kodu `src/AudioAnalyzer.cs`) barındırır.
   - Bilgisayarınızda FFmpeg kurulu olmasa bile `.mp4`, `.mov`, `.mkv`, `.avi`, `.wav`, `.mp3`, `.m4a` videolarının sesini doğrudan ve çok yüksek hızda analiz eder (FFmpeg kuruluysa onu da yedek motor olarak destekler).

2. **Canlı Dalga Formu Önizleme (Sıfır Bekleme Süresi)**
   - Videonuzu **bir kez** analiz ettikten sonra, **Sessizlik Eşiği (dB)**, **Min. Sessizlik Süresi (ms)**, **Kelime Başı/Sonu Payı (Padding)** sürgülerini değiştirdiğinizde tekrar analiz beklemezsiniz!
   - Dalga formu üzerindeki kırmızı kesim bölgeleri ve kazanılan süre istatistiği **anında (60 FPS)** güncellenir.

3. **✨ Akıllı Otomatik Eşik (Otsu Bimodal Algılama)**
   - **"✨ Otomatik Eşik Bul"** butonuna bastığınızda videonuzun dip gürültüsü ile konuşma ses yüksekliği arasındaki en ideal dB eşiğini matematiksel olarak otomatik bulur.

4. **5 Farklı Kesim ve Kurgu Modu**
   - **✂️ Kes ve Birleştir (Ripple Delete)**: Sessiz kısımları kesip siler ve kalan konuşmaları boşluksuz birleştirir. Çoklu katman (B-Roll V2, A2) senkronunu ve klibin başlangıç noktasını korur.
   - **🕳️ Kes ve Boşluk Bırak (Lift Delete)**: Sessiz bölgeleri kesip siler, yerlerinde boşluk bırakır.
   - **🔇 Sessiz Kısımları Devre Dışı Bırak (Disable Klip)**: Zararsız (Non-Destructive) kurgu — sessiz parçaları silmez, timeline üzerinde pasif (`Disabled`) hale getirir.
   - **🔪 Sadece Jilet At (Razor Only)**: Sessizlik başlangıç ve bitişlerine kesik atar, hiçbir parçayı silmez.
   - **🏷️ Sadece İşaretleyici Ekle (Sequence Markers)**: Kesim yapmadan timeline üzerine sessiz bölgeleri gösteren işaretleyiciler ekler.

5. **Etkileşimli Timeline Navigasyonu ve Bölge Seçimi**
   - Dalga formuna veya bulunan sessiz bölgeler listesindeki herhangi bir satıra tıkladığınızda Premiere Pro'daki oynatma çubuğu (Playhead) doğrudan o saniyeye gider.
   - Kesilmesini istemediğiniz özel bir duraksamanın yanındaki tiki kaldırarak o bölgeyi koruyabilirsiniz.

---

## 📦 Kurulum

### Yöntem 1: Tek Tıkla Otomatik Kurulum (Önerilen)
1. Klasör içindeki **`Kurulum-Install.bat`** dosyasına çift tıklayın.
2. Betik otomatik olarak:
   - Adobe CEP `PlayerDebugMode` (imzasız eklenti çalıştırma) kayıt defteri ayarını aktif eder,
   - `bin\AudioAnalyzer.exe` ses motorunu derler,
   - Eklentiyi `%APPDATA%\Adobe\CEP\extensions\com.silencecutter.pro` klasörüne kopyalar.
3. **Adobe Premiere Pro**'yu açın (açıksa yeniden başlatın).
4. Üst menüden **`Window > Extensions > SilenceCutter Pro`** yolunu izleyerek paneli açın.

---

## 🎬 Nasıl Kullanılır?

1. Premiere Pro'da videonuzu sekansa (Timeline) sürükleyin.
2. **SilenceCutter Pro** panelini açın.
3. İsterseniz sadece timeline'da seçtiğiniz klibi, isterseniz tüm sekansı analiz etmek için **"🔍 Sesi Analiz Et"** butonuna tıklayın.
4. Dalga formu ekrana geldiğinde **"✨ Otomatik Eşik Bul"** butonuna tıklayın veya hazır profillerden (*YouTube / Standart*, *Hızlı Shorts/Reels*, *Podcast*) birini seçin.
5. **"✂️ Sessiz Yerleri Kes ve Birleştir"** butonuna tıklayın. Saniyeler içinde tüm sessiz kısımlar kesilip birleştirilecektir! *(Beğenmezseniz Premiere Pro'da `Ctrl+Z` ile geri alabilirsiniz.)*

---

## 🗂️ Proje Klasör Yapısı

```text
silencecutter/
├── CSXS/
│   └── manifest.xml          # Adobe CEP eklenti manifestosu (Premiere Pro 2019 - 2026+)
├── bin/
│   └── AudioAnalyzer.exe     # Windows Media Foundation yerel ses analiz motoru
├── src/
│   └── AudioAnalyzer.cs      # AudioAnalyzer.exe C# kaynak kodu
├── host/
│   └── index.jsx             # Premiere Pro ExtendScript (QE & Standart DOM kesim motoru)
├── node/
│   └── analyzer.js           # Node.js çoklu ses analiz katmanı (MediaFoundation / FFmpeg / WAV)
├── client/
│   ├── index.html            # Eklenti arayüzü (Türkçe)
│   ├── style.css             # Premiere Pro koyu tema tasarımı
│   ├── CSInterface.js        # Adobe CEP iletişim köprüsü
│   ├── detector.js           # Gerçek zamanlı sessizlik & Otsu otomatik eşik algoritması
│   └── app.js                # Etkileşimli dalga formu (Canvas) ve arayüz kontrolcüsü
├── tests/
│   └── plugin.test.js        # Birim ve entegrasyon testleri
├── Kurulum-Install.bat       # Tek tıkla Windows kurulum betiği
└── Kaldir-Uninstall.bat      # Tek tıkla kaldırma betiği
```
