# 🎬 Video to Motion Photo & Live Photo Converter

> **100% Client-Side Universal Converter untuk Mengubah Video Menjadi Android Motion Photo (.jpg), TikTok Live Motion (.mp4), dan iPhone Live Photo (.zip)**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Client-Side](https://img.shields.io/badge/Privacy-100%25%20Client--Side-emerald.svg)
![Zero-Backend](https://img.shields.io/badge/Backend-None%20(Local%20RAM)-purple.svg)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20TikTok%20%7C%20iOS-sky.svg)

---

## 🌟 Fitur Utama Terbaru

- 🔄 **Koreksi Rotasi Video Langsung (0°, 90°, 180°, 270°)**:
  - Menyelesaikan masalah video yang terbalik atau miring saat direkam di smartphone (seperti video ping pong atau kamera selfie).
  - Rotasi dibakar (*baked-in*) secara fisik ke dalam piksel kanvas dan stream video MP4, sehingga posisi foto dan video dijamin selalu tegak di perangkat apa pun.
- 🎵 **Mode Khusus: TikTok & WA Ready (.mp4)**:
  - Klip video loop 1.5 – 3 detik dengan audio sinkron (persis seperti hasil unduhan Live Photo dari WhatsApp).
  - Dijamin **100% langsung bergerak otomatis dan bersuara** saat diunggah ke TikTok di HP Android tanpa terpotong oleh kompresor server foto TikTok.
- 🤖 **Universal Dual-Engine Android Motion Photo (`.jpg`)**:
  - Menggabungkan **Google Camera XMP Specification** di depan dan **Samsung SEF (Structured Extension Format: `SEFH` + `MotionPhoto_Data` + `SEFT`)** di ujung belakang.
  - Kompatibel penuh dengan **Google Photos**, **Galeri Bawaan Samsung One UI**, **Xiaomi HyperOS / MIUI**, dan ponsel Android lainnya.
- 🍏 **Dukungan Apple Live Photo Dual-Asset (iOS)**:
  - Menyuntikkan *Apple Content Identifier UUID* yang serasi ke dalam foto diam (`.jpg`) dan video klip (`.mov`) dalam arsip `.zip` siap pakai untuk AirDrop atau iCloud.
- 📦 **Paket Lengkap (All-in-One)**:
  - Mengunduh seluruh format sekaligus (Android `.jpg` + TikTok `.mp4` + iPhone `.zip`).
- 📱 **Simulator Live Interaktif di Browser**:
  - Pengguna dapat mengarahkan kursor (*hover*) atau **tekan & tahan (*press & hold*)** pada foto hasil konversi untuk melihat simulasi gerakan sebelum diunduh.
- 🎨 **Desain Liquid Glass Berstandar Tinggi**:
  - Mengikuti estetika *Liquid Glass* berkontras tinggi (Dark & Light Mode otomatis) senada dengan Image Converter.
- 🔒 **100% Client-Side Local Memory**:
  - Seluruh manipulasi biner, pemotongan, dan render berlangsung langsung di RAM browser. Video tidak pernah diunggah ke server mana pun.

---

## 🔍 Struktur Biner Dual-Engine

```text
[00-02]  SOI: 0xFFD8
[02-..]  APP1: Adobe XMP Header <GCamera:MotionPhoto="1"> (Untuk Google Photos)
[..-..]  JPEG Upright Image Scan Data (Resolusi penuh & rotasi tegak)
[..-..]  EOI: 0xFFD9
[..-..]  Standard H.264 MP4 Video Stream (Dengan audio sinkron)
[..-EOF] Samsung SEF Block (SEFH + Tag 0x0A30 "MotionPhoto_Data" + SEFT) (Untuk Galeri Samsung & Android)
```

---

## 🚀 Cara Menjalankan

Cukup buka file `index.html` langsung di browser modern mana pun (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari, atau Opera):

```bash
# Atau menggunakan local HTTP server sederhana:
npx serve "c:\kuliah\CV\Portofolio\tool\format\video to live foto"
```

---

## 📄 Lisensi

Proyek ini dirilis di bawah lisensi [MIT License](LICENSE).
