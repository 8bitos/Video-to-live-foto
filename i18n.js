// i18n translation dictionary for Video to Motion & Live Photo Converter
export const translations = {
  id: {
    appTitle: "Motion & Live Photo Converter",
    appSubtitle: "Ubah video menjadi Android Motion Photo (.jpg) atau iPhone Live Photo langsung di browser secara lokal.",
    
    // Target Format / Mode Selection
    modeLabel: "Pilih Format Target:",
    modeAndroidTitle: "Android Motion Photo (.jpg)",
    modeAndroidDesc: "1 File JPEG tunggal (Google XMP + Samsung SEF). Kompatibel dengan Galeri Samsung, Google Photos, Pixel, Xiaomi.",
    modeTiktokTitle: "TikTok & WA Ready (.mp4)",
    modeTiktokDesc: "Klip video loop 1.5 – 3s persis seperti simpanan WhatsApp. Dijamin 100% bergerak dan bersuara di TikTok!",
    modeAppleTitle: "iPhone Live Photo (.zip)",
    modeAppleDesc: "Sepasang aset kembar (.jpg + .mov) disuntikkan Apple Asset UUID. Siap dikirim via AirDrop atau iCloud.",
    modeDualTitle: "Paket Lengkap (Semua Format)",
    modeDualDesc: "Download semua format sekaligus (Android .jpg + TikTok .mp4 + iPhone .zip) dalam satu arsip ZIP.",

    // Dropzone
    dropTitle: "Tarik & jatuhkan file video ke sini, atau",
    dropBrowse: "pilih file",
    dropSupported: "Format didukung: MP4, MOV, WebM, M4V, MKV (Rekomendasi video pendek 2 - 10 detik)",
    dropPasteHint: "bisa langsung paste file dari clipboard (Ctrl + V)",

    // Video Trimmer & Controls
    trimmerTitle: "Timeline & Pemotong Klip Video",
    rotateBtn: "Putar Rotasi:",
    videoDurationLabel: "Durasi Klip:",
    recommendedDuration: "Ideal: 1.5 – 3.0 detik",
    startTimeLabel: "Waktu Mulai:",
    endTimeLabel: "Waktu Selesai:",
    keyframeSectionTitle: "Pilih Frame Sampul (Foto Statis)",
    keyframeHint: "Geser timeline untuk menentukan frame foto diam yang tampil sebelum foto ditekan:",
    keyframeStartBtn: "Awal",
    keyframeMidBtn: "Tengah",
    keyframeEndBtn: "Akhir",
    keyframeTimeLabel: "Waktu Frame:",

    // Options Bar
    optionsTitle: "Pengaturan Kualitas & Output",
    qualityLabel: "Kualitas Foto:",
    qualityHigh: "Maksimal (95%)",
    qualityMedium: "Tinggi (85%)",
    qualityStandard: "Standar (75%)",
    resolutionLabel: "Resolusi:",
    resOriginal: "Asli (1:1 Source)",
    res1080p: "Full HD (1080p)",
    res720p: "HD (720p)",

    // Action Buttons
    convertBtn: "⚡ Buat Motion Photo",
    processingTitle: "Sedang Memproses...",
    stepExtractCover: "1. Mengekstrak frame foto utama dengan rotasi...",
    stepClipVideo: "2. Menyiapkan segmen video & sinkronisasi audio...",
    stepInjectMetadata: "3. Menyuntikkan metadata Google XMP & Samsung SEF...",
    stepPackaging: "4. Merangkum file hasil akhir...",

    // Result Card
    resultTitle: "Hasil Konversi Siap Diunduh!",
    resultPreviewHint: "Arahkan kursor atau TEKAN LAMA pada foto untuk melihat efek gerak:",
    resultCoverSize: "Ukuran Foto Diam:",
    resultVideoSize: "Ukuran Klip Video:",
    resultTotalSize: "Total Ukuran File:",
    downloadBtn: "Unduh File",
    resetBtn: "Konversi Video Lain",

    // Guide section
    guideTitle: "Cara Memutar di Smartphone",
    guideAndroidTitle: "Di Android (Samsung / Pixel / Xiaomi / Lainnya):",
    guideAndroidStep1: "Pindahkan file .jpg hasil download ke HP Anda (bisa lewat Quick Share, WhatsApp Kirim Dokumen, Google Drive, atau Kabel USB).",
    guideAndroidStep2: "Buka file menggunakan aplikasi Google Photos atau Galeri Bawaan Samsung / Xiaomi.",
    guideAndroidStep3: "Tombol 'Lihat Foto Bergerak' atau 'Play Motion Photo' akan muncul otomatis di atas foto!",
    guideIphoneTitle: "Di iPhone / iPad (iOS):",
    guideIphoneStep1: "Ekstrak file .zip, kirim kedua file (.jpg dan .mov) bersamaan ke iPhone lewat AirDrop atau buka icloud.com/photos di browser PC.",
    guideIphoneStep2: "iOS otomatis menggabungkan keduanya menjadi satu Live Photo dengan ikon konsentris di pojok kiri atas.",

    // Fun facts
    funFactTitle: "Tahukah Anda?",
    funFactBadge: "Trivia Teknologi Kamera",

    // Alerts & Errors
    errorNoFile: "Harap masukkan file video terlebih dahulu.",
    errorInvalidVideo: "Format video tidak dapat diputar di browser ini. Coba gunakan video MP4 atau WebM.",
    errorTrimRange: "Waktu selesai harus lebih besar daripada waktu mulai (minimal durasi 0.5 detik).",
    copiedClipboard: "Berhasil disalin ke clipboard!"
  },
  en: {
    appTitle: "Motion & Live Photo Converter",
    appSubtitle: "Convert any video into Android Motion Photo (.jpg) or Apple Live Photo right in your browser (100% Client-Side).",
    
    // Target Format / Mode Selection
    modeLabel: "Select Target Format:",
    modeAndroidTitle: "Android Motion Photo (.jpg)",
    modeAndroidDesc: "Single JPEG file (Google XMP + Samsung SEF). Compatible with Samsung Gallery, Google Photos, Pixel, Xiaomi.",
    modeTiktokTitle: "TikTok & WA Ready (.mp4)",
    modeTiktokDesc: "Short looping 1.5 – 3s video clip just like WhatsApp saves. Guaranteed to animate & play sound on TikTok!",
    modeAppleTitle: "iPhone Live Photo (.zip)",
    modeAppleDesc: "Paired twin assets (.jpg + .mov) injected with Apple Asset UUID. Ready for AirDrop or iCloud Photos.",
    modeDualTitle: "Complete Bundle (All Formats)",
    modeDualDesc: "Download all formats (Android .jpg + TikTok .mp4 + iPhone .zip) bundled in a single ZIP archive.",

    // Dropzone
    dropTitle: "Drag & drop your video file here, or",
    dropBrowse: "browse file",
    dropSupported: "Supported formats: MP4, MOV, WebM, M4V, MKV (Recommended short video 2 - 10 seconds)",
    dropPasteHint: "or paste video file from clipboard (Ctrl + V)",

    // Video Trimmer & Controls
    trimmerTitle: "Timeline & Video Trimmer",
    rotateBtn: "Rotate Video:",
    videoDurationLabel: "Clip Duration:",
    recommendedDuration: "Ideal: 1.5 – 3.0 seconds",
    startTimeLabel: "Start Time:",
    endTimeLabel: "End Time:",
    keyframeSectionTitle: "Select Cover Photo (Keyframe)",
    keyframeHint: "Scrub timeline to pick the exact still photo displayed before the photo is touched:",
    keyframeStartBtn: "Start",
    keyframeMidBtn: "Middle",
    keyframeEndBtn: "End",
    keyframeTimeLabel: "Frame Time:",

    // Options Bar
    optionsTitle: "Quality & Output Settings",
    qualityLabel: "Photo Quality:",
    qualityHigh: "Maximum (95%)",
    qualityMedium: "High (85%)",
    qualityStandard: "Standard (75%)",
    resolutionLabel: "Resolution:",
    resOriginal: "Original (1:1 Source)",
    res1080p: "Full HD (1080p)",
    res720p: "HD (720p)",

    // Action Buttons
    convertBtn: "⚡ Create Motion Photo",
    processingTitle: "Processing...",
    stepExtractCover: "1. Extracting cover frame with rotation correction...",
    stepClipVideo: "2. Preparing video stream segment & audio synchronization...",
    stepInjectMetadata: "3. Injecting Google XMP & Samsung SEF metadata...",
    stepPackaging: "4. Compiling finalized output files...",

    // Result Card
    resultTitle: "Converted Photo is Ready to Download!",
    resultPreviewHint: "Hover your mouse or PRESS & HOLD the photo to experience the motion playback:",
    resultCoverSize: "Still Photo Size:",
    resultVideoSize: "Video Clip Size:",
    resultTotalSize: "Total File Size:",
    downloadBtn: "Download File",
    resetBtn: "Convert Another Video",

    // Guide section
    guideTitle: "How to Play on Your Smartphone",
    guideAndroidTitle: "On Android (Samsung / Pixel / Xiaomi / Others):",
    guideAndroidStep1: "Transfer the downloaded .jpg file to your phone (via Quick Share, WhatsApp Document, Google Drive, or USB cable).",
    guideAndroidStep2: "Open the file using Google Photos or the default Samsung / Xiaomi Gallery app.",
    guideAndroidStep3: "The 'Play Motion Photo' / 'View Motion Photo' button will appear automatically above the photo!",
    guideIphoneTitle: "On iPhone / iPad (iOS):",
    guideIphoneStep1: "Extract the .zip file and send both files (.jpg and .mov) together to iPhone via AirDrop or upload via icloud.com/photos on PC.",
    guideIphoneStep2: "iOS automatically stitches both files into a single Live Photo with the concentric icon in the top-left corner.",

    // Fun facts
    funFactTitle: "Did You Know?",
    funFactBadge: "Camera Technology Trivia",

    // Alerts & Errors
    errorNoFile: "Please select or drop a video file first.",
    errorInvalidVideo: "Video format could not be played in this browser. Try an MP4 or WebM video.",
    errorTrimRange: "End time must be greater than start time (minimum duration 0.5s).",
    copiedClipboard: "Copied to clipboard successfully!"
  }
};
