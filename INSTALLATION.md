# 📘 Photobooth Kiosk — Installation Guide

Panduan lengkap instalasi **Photobooth Kiosk (Electron + Vue 3 + TypeScript + gphoto2)**.

> **Fokus utama:** Windows via **MSYS2 + libgphoto2** (wajib kalau memakai `gphoto2` native binding).
>
> macOS dan Linux tetap disertakan sebagai referensi.

---

## 📋 Persyaratan Sistem

| Komponen | Versi Minimal | Catatan |
|---|---|---|
| **Node.js** | v18 LTS atau v20 LTS | Rekomendasi v20 |
| **pnpm** | v8+ | Package manager |
| **Git** | Latest | Clone repository |
| **MSYS2** | Latest | Windows only |
| **Camera DSLR** | Canon / Nikon / Sony | Support via libgphoto2 |
| **Kabel USB** | USB 2.0+ (data, bukan charge-only) | Penting! |

---

## 🚀 Quick Start

### Windows — MSYS2

> **Penting:** Setup MSYS2 + libgphoto2 adalah bagian wajib untuk Windows apabila menggunakan `gphoto2` native binding.

```bash
# 1. Setup MSYS2 + libgphoto2
#    Lihat detail pada bagian Windows di bawah.

# 2. Clone repository
git clone <repo-url> photobooth-kiosk
cd photobooth-kiosk

# 3. Install dependencies
pnpm install

# 4. Rebuild native binding gphoto2
pnpm exec electron-rebuild -f -w gphoto2

# 5. Setup environment
cp .env.example .env

# 6. Jalankan development
pnpm dev
```

---

# 🪟 Windows — Setup Lengkap via MSYS2

## Overview

Windows tidak memiliki `libgphoto2` native. Kita menggunakan **MSYS2** (Linux-like environment untuk Windows) untuk:

- Compile native binding `gphoto2.node` yang dipakai Electron.
- Menyediakan `libgphoto2` runtime DLL.

Hasil akhirnya: Electron dapat memanggil **gphoto2 API secara langsung**, bukan melakukan spawn CLI.

---

## Step 1 — Install MSYS2

### 1.1 Download installer

Download dari:

<https://www.msys2.org/>

Pilih:

```text
msys2-x86_64-xxxx.exe
```

(64-bit)

### 1.2 Install

1. Jalankan installer.
2. Install path: `C:\msys64` (default — jangan diubah).
3. Klik **Next** sampai selesai.
4. Jangan centang **"Run MSYS2 now"**. Kita akan membuka shell secara manual.

### 1.3 Buka MSYS2 MINGW64 shell

> ⚠️ **PENTING:** Yang dibuka harus **MSYS2 MINGW64**, bukan `MSYS2 MSYS` atau `MSYS2 UCRT64`.

Cara buka:

- Start Menu → cari **MSYS2 MINGW64**
- Atau buka:
  `C:\msys64\mingw64.exe`

Prompt akan terlihat seperti:

```text
user@DESKTOP-XXX MINGW64 ~
$
```

Kalau prompt-nya tidak ada `MINGW64`, berarti shell yang dibuka salah. Ulangi dari atas.

---

## Step 2 — Update MSYS2

Di **MSYS2 MINGW64 shell**:

```bash
pacman -Syu
```

Kalau diminta menutup terminal, tutup window **MSYS2 MINGW64**, lalu buka kembali.

Setelah membuka ulang, jalankan:

```bash
pacman -Su
```

Ulangi sampai tidak ada update lagi.

---

## Step 3 — Install Build Tools + libgphoto2

Masih di **MSYS2 MINGW64 shell**:

```bash
pacman -S --needed \
    mingw-w64-ucrt-x86_64-gcc \
    mingw-w64-ucrt-x86_64-gcc-libs \
    mingw-w64-ucrt-x86_64-pkgconf \
    mingw-w64-ucrt-x86_64-libgphoto2 \
    mingw-w64-ucrt-x86_64-libltdl \
    mingw-w64-ucrt-x86_64-libusb \
    mingw-w64-ucrt-x86_64-libtool \
    mingw-w64-ucrt-x86_64-make \
    mingw-w64-ucrt-x86_64-autotools \
    make \
    git
```

Tekan `Y` kalau diminta konfirmasi.

**Estimasi download:** ~200–400 MB, bisa 5–15 menit tergantung koneksi.

### Verify

```bash
pkg-config --modversion libgphoto2
```

Output yang diharapkan:

```text
2.5.x atau lebih
```

Cek GCC:

```bash
gcc --version
```

Output yang diharapkan:

```text
gcc (GCC) 13.x.x atau lebih
```

Cek gphoto2:

```bash
which gphoto2
```

Output yang diharapkan:

```text
/mingw64/bin/gphoto2
```

---

## Step 4 — Install Node.js

> ⚠️ **Node.js harus versi Windows native, bukan dari MSYS2 pacman.**

### 4.1 Download Node.js

Download LTS dari:

<https://nodejs.org/en/download>

Pilih:

**Windows Installer (.msi) 64-bit**

### 4.2 Install

1. Jalankan installer.
2. Centang **"Add to PATH"**.
3. Klik **Next** sampai selesai.
4. Restart **MSYS2 MINGW64 shell**.

### 4.3 Verify

Di MSYS2 MINGW64:

```bash
node -v
```

Output yang diharapkan:

```text
v20.x.x
```

Cek npm:

```bash
npm -v
```

Output yang diharapkan:

```text
10.x.x
```

Cek lokasi Node:

```bash
which node
```

Output yang diharapkan:

```text
/c/Program Files/nodejs/node
```

Kalau `which node` menunjukkan:

```text
/mingw64/bin/node
```

berarti ada Node.js versi MSYS2. Hapus terlebih dahulu:

```bash
pacman -R mingw-w64-x86_64-nodejs
```

---

## Step 5 — Install pnpm

Di MSYS2 MINGW64:

```bash
npm install -g pnpm
```

Verify:

```bash
pnpm -v
```

Output yang diharapkan:

```text
8.x atau lebih
```

---

## Step 6 — Set Environment Variables

Di MSYS2 MINGW64, set environment agar `node-gyp` (compiler binding) dapat menemukan `libgphoto2`:

```bash
export PKG_CONFIG_PATH="/mingw64/lib/pkgconfig:$PKG_CONFIG_PATH"
export PATH="/mingw64/bin:$PATH"
export CXXFLAGS="-std=c++20"
export CFLAGS="-std=c++20"
```

### Membuat Environment Variables Permanen

Tambahkan ke `~/.bashrc`:

```bash
cat >> ~/.bashrc << 'EOF'

# gphoto2 + build tools
export PKG_CONFIG_PATH="/mingw64/lib/pkgconfig:$PKG_CONFIG_PATH"
export PATH="/mingw64/bin:$PATH"
export CXXFLAGS="-std=c++20"
export CFLAGS="-std=c++20"
EOF
```

Reload:

```bash
source ~/.bashrc
```

### Verify

```bash
echo $PKG_CONFIG_PATH
```

Output harus mencakup:

```text
/mingw64/lib/pkgconfig
```

Cek library:

```bash
pkg-config --libs libgphoto2
```

Output yang diharapkan:

```text
-L/mingw64/lib -lgphoto2 -lgphoto2_port ...
```

---

## Step 7 — Test gphoto2 dengan Kamera

### 7.1 Set Camera ke Mode PTP/MTP

> **Wajib:** Kamera harus menggunakan mode PTP/MTP. Jika kamera menggunakan mode **Mass Storage**, `gphoto2` tidak akan mendeteksinya.

#### Canon EOS

```text
Menu → Setup (icon kunci) → Communication Settings
→ USB Connection → Pilih "PTP" atau "PC Remote"
```

#### Nikon DSLR

```text
Menu → Setup → USB → Pilih "MTP/PTP"
```

#### Sony Alpha

```text
Menu → Setup → USB → Connection → Pilih "PC Remote"
```

#### Fujifilm

```text
Menu → Setup → Connection → PC Connection Mode
→ "USB RAW Conv./Backup Restore"
```

### 7.2 Colok Kamera

1. Colok USB langsung ke port USB di PC.
2. Hindari USB hub kalau memungkinkan.
3. Nyalakan kamera dalam mode PTP.

### 7.3 Detect

```bash
gphoto2 --auto-detect
```

Output yang diharapkan:

```text
Model                          Port
----------------------------------------------------------
Canon EOS 5D Mark IV           usb:001,005
```

Kalau kosong (`Model Port` tanpa baris di bawahnya):

- Cek mode PTP dan ulangi Step 7.1.
- Ganti kabel USB.
- Coba port USB lain.
- Restart kamera.
- Cek **Device Manager** — apakah kamera muncul sebagai **Portable Device**?

---

## Step 8 — Clone & Install Project

> Keluar dari MSYS2 MINGW64? **Jangan.** Tetap di shell yang sama.

Pindah ke direktori kerja:

```bash
cd /c/Users/<username>/project/electron
```

Sesuaikan dengan lokasi project Anda.

Clone repository:

```bash
git clone <repo-url> photobooth-kiosk
cd photobooth-kiosk
```

### Install Dependencies

```bash
pnpm install
```

Kalau error saat build `gphoto2`:

```bash
pnpm exec electron-rebuild -f -w gphoto2
```

Kalau tetap error, cek log lengkap:

```bash
pnpm exec electron-rebuild -f -w gphoto2 --verbose
```

### Error Umum

| Error | Penyebab / Solusi |
|---|---|
| `Package libgphoto2 was not found` | Step 3 belum selesai, ulangi instalasi package |
| `pkg-config not found` | Step 3 belum selesai |
| `C++20 or later required` | Pastikan `CXXFLAGS=-std=c++20` sudah di-export |

---

## Step 9 — Verify Native Binding

Setelah `pnpm install` dan rebuild berhasil, cek:

```bash
ls -la node_modules/gphoto2/build/Release/
```

Harus ada:

```text
gphoto2.node
```

Kalau tidak ada:

1. Rebuild gagal secara silent.
2. Jalankan:

```bash
pnpm exec electron-rebuild -f -w gphoto2 --verbose
```

untuk melihat error lengkap.

---

## Step 10 — Setup `.env`

Buat file `.env` di root project:

```bash
cat > .env << 'EOF'
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=HeloraBooth Photobooth
EOF
```

---

## Step 11 — Jalankan Development

Masih di MSYS2 MINGW64:

```bash
pnpm dev
```

Electron window akan terbuka.

### Test

1. Klik **Settings** (icon gear kanan atas).
2. Buka tab **Kamera**.
3. Klik **Hubungkan Kamera**.
4. Kamera harus terdeteksi dan live preview muncul.

---

## Step 12 — Packaging untuk Production

Build dan package:

```bash
pnpm build:win
```

Output berada di:

```text
./dist/
```

> **Penting:** Untuk production, bundle `libgphoto2` DLL.

### 12.1 Copy DLL dari MSYS2

Buat directory:

```bash
mkdir -p resources/gphoto2/win32
```

Copy gphoto2 binary dan dependencies:

```bash
cp /mingw64/bin/gphoto2.exe resources/gphoto2/win32/
cp /mingw64/bin/libgphoto2-*.dll resources/gphoto2/win32/
cp /mingw64/bin/libgphoto2_port-*.dll resources/gphoto2/win32/
cp /mingw64/bin/libgcc_s_seh-1.dll resources/gphoto2/win32/
cp /mingw64/bin/libstdc++-6.dll resources/gphoto2/win32/
cp /mingw64/bin/libwinpthread-1.dll resources/gphoto2/win32/
cp /mingw64/bin/libusb-1.0.dll resources/gphoto2/win32/
cp /mingw64/bin/libintl-8.dll resources/gphoto2/win32/
cp /mingw64/bin/libiconv-2.dll resources/gphoto2/win32/
```

### Cek Dependency DLL yang Dibutuhkan

```bash
ldd /mingw64/bin/gphoto2.exe | grep mingw64
```

Copy semua dependency yang muncul dan dibutuhkan ke:

```text
resources/gphoto2/win32/
```

### 12.2 Update `electron-builder.yml`

Tambahkan:

```yaml
extraResources:
  - from: resources/gphoto2
    to: gphoto2
    filter:
      - '**/*'
```

### 12.3 Build

```bash
pnpm build:win
```

Installer `.exe` akan otomatis melakukan bundle:

```text
resources/gphoto2/
```

---

# 🍎 macOS — Setup (Referensi)

## Step 1 — Install Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## Step 2 — Install Dependencies

```bash
brew install libgphoto2 pkg-config gphoto2
```

## Step 3 — Set Environment

Tambahkan ke `~/.zshrc`:

```bash
export PKG_CONFIG_PATH="$(brew --prefix)/lib/pkgconfig:$PKG_CONFIG_PATH"
export CXXFLAGS="-std=c++20"
export CFLAGS="-std=c++20"
```

Reload:

```bash
source ~/.zshrc
```

## Step 4 — Install Node.js + pnpm

```bash
brew install node
npm install -g pnpm
```

## Step 5 — Update Xcode CLT

```bash
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

## Step 6 — Clone & Install

```bash
git clone <repo-url> photobooth-kiosk
cd photobooth-kiosk
pnpm install
pnpm exec electron-rebuild -f -w gphoto2
```

## Step 7 — Jalankan

```bash
pnpm dev
```

---

# 🐧 Linux (Ubuntu/Debian) — Setup (Referensi)

## Step 1 — Install Dependencies

```bash
sudo apt update
sudo apt install -y \
    build-essential \
    pkg-config \
    libgphoto2-dev \
    libgphoto2-port12 \
    gphoto2 \
    libtool \
    autoconf \
    automake
```

## Step 2 — Setup udev Rules

Buat file `/etc/udev/rules.d/90-gphoto.rules`:

```bash
sudo tee /etc/udev/rules.d/90-gphoto.rules << 'EOF'
# Canon
SUBSYSTEM=="usb", ATTR{idVendor}=="04a9", MODE="0666", GROUP="plugdev"

# Nikon
SUBSYSTEM=="usb", ATTR{idVendor}=="04b0", MODE="0666", GROUP="plugdev"

# Sony
SUBSYSTEM=="usb", ATTR{idVendor}=="054c", MODE="0666", GROUP="plugdev"

# Fujifilm
SUBSYSTEM=="usb", ATTR{idVendor}=="04cb", MODE="0666", GROUP="plugdev"
EOF
```

Reload rules:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Tambahkan user ke group `plugdev`:

```bash
sudo usermod -a -G plugdev $USER
```

Logout dan login kembali.

## Step 3 — Install Node.js + pnpm

Node.js melalui `nvm` (recommended):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

npm install -g pnpm
```

## Step 4 — Clone & Install

```bash
git clone <repo-url> photobooth-kiosk
cd photobooth-kiosk

pnpm install
pnpm exec electron-rebuild -f -w gphoto2
pnpm dev
```

---

# 📸 Camera Setup (Semua Platform)

## Mode PTP/MTP Wajib

| Brand | Path Menu |
|---|---|
| Canon | Menu → Setup → Communication → USB → PTP / PC Remote |
| Nikon | Menu → Setup → USB → MTP/PTP |
| Sony | Menu → Setup → USB → Connection → PC Remote |
| Fujifilm | Menu → Setup → Connection → PC Connection Mode → USB RAW |
| Panasonic | Menu → Setup → USB Mode → PC (PTP) |
| Olympus | Menu → Setup → USB → Storage |

## Verify Detect

### Windows (MSYS2)

```bash
gphoto2 --auto-detect
```

### macOS / Linux

```bash
gphoto2 --auto-detect
```

Output sukses:

```text
Model                          Port
----------------------------------------------------------
Canon EOS 5D Mark IV           usb:001,005
```

---

# 🔧 Troubleshooting

## ❌ C++20 or later required

**Penyebab:** Compiler default menggunakan C++17 atau lebih lama.

### Windows / MSYS2

```bash
export CXXFLAGS="-std=c++20"
export CFLAGS="-std=c++20"

pnpm exec electron-rebuild -f -w gphoto2
```

### macOS

Update Xcode Command Line Tools:

```bash
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

---

## ❌ Package `libgphoto2` was not found

### Windows / MSYS2

```bash
pacman -S mingw-w64-x86_64-libgphoto2

export PKG_CONFIG_PATH="/mingw64/lib/pkgconfig:$PKG_CONFIG_PATH"

pkg-config --modversion libgphoto2
```

### Linux

```bash
sudo apt install libgphoto2-dev
```

### macOS

```bash
brew install libgphoto2 pkg-config
```

---

## ❌ Cannot find module `gphoto2.node`

**Penyebab:** Native binding belum dibuild.

Fix:

```bash
pnpm exec electron-rebuild -f -w gphoto2
ls -la node_modules/gphoto2/build/Release/gphoto2.node
```

---

## ❌ `NODE_MODULE_VERSION` mismatch

**Penyebab:** Binding dibuild untuk versi Node.js yang berbeda dengan Electron.

Fix:

```bash
pnpm exec electron-rebuild -f -w gphoto2
```

---

## ❌ `gphoto2 --auto-detect` kosong

Checklist:

- [ ] Kamera berada di mode PTP/MTP, bukan Mass Storage.
- [ ] Kabel USB support data, bukan charge-only.
- [ ] Kamera terhubung langsung ke PC, bukan USB hub.
- [ ] Kamera dinyalakan sebelum USB dicolok.
- [ ] Windows: cek Device Manager apakah kamera muncul.
- [ ] Linux: jalankan `lsusb` dan pastikan ada device baru.

---

## ❌ Kamera terdeteksi tetapi tidak bisa capture

Penyebab umum:

- Kamera berada di mode PTP tetapi tidak bisa `PC Remote`.
- Memory card penuh.
- Battery lemah. Beberapa kamera tidak mau capture jika battery < 20%.

Fix:

1. Charge kamera.
2. Clear memory card.
3. Cek setting PTP.
4. Pastikan kamera mendukung remote capture pada mode yang digunakan.

---

## ❌ `window.electron is undefined` di DevTools

**Penyebab:** Preload tidak ter-load.

Cek:

```text
out/preload/index.js
```

Cek `electron/main.ts`:

```text
sandbox: false
path preload benar
```

Cek `electron.vite.config.ts`:

```text
preload output format: 'cjs'
entryFileNames: 'index.js'
```

---

## ❌ MSYS2 prompt tidak ada `MINGW64`

Berarti shell yang dibuka salah.

Buka:

**Start Menu → MSYS2 MINGW64**

atau:

```text
C:\msys64\mingw64.exe
```

---

## ❌ `pnpm install` lambat / stuck

Set registry yang lebih cepat:

```bash
pnpm config set registry https://registry.npmmirror.com
pnpm install
```

---

# 📋 Checklist Instalasi Windows

- [ ] MSYS2 terinstall di `C:\msys64`
- [ ] Bisa buka MSYS2 MINGW64 shell (prompt ada `MINGW64`)
- [ ] `pacman -Syu` selesai tanpa error
- [ ] `mingw-w64-x86_64-libgphoto2` terinstall
- [ ] `pkg-config --modversion libgphoto2` mengembalikan versi
- [ ] Node.js Windows native terinstall
- [ ] `pnpm -v` berjalan
- [ ] Environment variables (`PKG_CONFIG_PATH`, `CXXFLAGS`) sudah di-export
- [ ] `~/.bashrc` sudah di-update untuk persist
- [ ] `gphoto2 --auto-detect` mendeteksi kamera
- [ ] `pnpm install` sukses
- [ ] `pnpm exec electron-rebuild -f -w gphoto2` sukses
- [ ] `node_modules/gphoto2/build/Release/gphoto2.node` ada
- [ ] `.env` sudah dibuat
- [ ] `pnpm dev` membuka Electron window
- [ ] Settings → Kamera → Connect berhasil

---

# 📦 Struktur Folder Setelah Setup

```text
photobooth-kiosk/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   │   ├── index.ts
│   │   ├── camera.ts
│   │   ├── print.ts
│   │   └── storage.ts
│   └── services/
│       └── CameraService.ts
├── src/
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── components/
│           ├── composables/
│           ├── pages/
│           └── lib/
├── resources/
│   └── gphoto2/
│       └── win32/              # DLL bundle (production)
├── node_modules/
│   └── gphoto2/
│       └── build/Release/
│           └── gphoto2.node    # Native binding
├── .env
├── package.json
├── electron.vite.config.ts
└── electron-builder.yml
```

---

# 🆘 Bantuan

Kalau stuck di salah satu step:

1. Cek bagian **Troubleshooting** di atas.
2. Cek log — pesan error biasanya menjelaskan apa yang kurang.
3. Verify setiap step dengan command yang disediakan.
4. Kalau kamera tidak terdeteksi, cek mode **PTP** terlebih dahulu — ini disebut sebagai penyebab yang sangat umum dalam panduan ini.

---

# 🔗 Referensi Eksternal

- **MSYS2:** <https://www.msys2.org/docs/faq/>
- **gphoto2:** <http://gphoto.org/doc/>
- **libgphoto2 camera list:** <http://gphoto.org/proj/libgphoto2/support.php>
- **Electron:** <https://www.electronjs.org/docs/latest>
- **electron-vite:** <https://electron-vite.org/>

---

## 📌 Document Information

| Item | Value |
|---|---|
| **Version** | 1.0 |
| **Last updated** | 2026-10-07 |
