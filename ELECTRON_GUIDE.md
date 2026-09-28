# GymPro - Electron Desktop & USB Portable Setup

Aapki Gym Management web app ab kamyabi ke sath **Electron Desktop Application** mein convert ho chuki hai. Is setup ka sabse bara faida yeh hai ke aap isay bina kisi internet, cloud deployment, Docker, ya Node.js ke kisi bhi Windows PC par **USB se direct chala sakte hain**.

---

## 🚀 1. Abhi Apne PC Par Electron Chalana (Quick Test)

Agar aap apne PC par desktop app chalana chahte hain (jahan local database chal rahi hai):

```bash
# Frontend aur Backend build karein
npm run build:all

# Desktop App start karein
npm run electron:start
```

Ya development mode mein (jahan code change hone par auto-reload hoga):

```bash
npm run electron:dev
```

---

## 💾 2. USB Ke Liye Single `.exe` (Portable App) Kaise Banayein?

Agar aap chahte hain ke app ko USB mein daal kar kisi **aise PC par chalayein jahan na PostgreSQL install ho na Node.js**:

### Step 1: Portable PostgreSQL Download Karein (Sirf Ek Baar)
Humne ek automated script banaya hai jo official Windows Portable PostgreSQL binaries download karke `resources/postgres/` mein set kar deta hai:

```bash
npm run download:pg
```

### Step 2: Portable Windows `.exe` Build Karein

```bash
npm run electron:dist:portable
```

Yeh command `release/` folder ke andar **`GymPro-Portable.exe`** create karegi.

### Step 3: USB Mein Copy Karein
- `release/GymPro-Portable.exe` file ko copy karke apni USB flash drive mein paste karein.
- Ab kisi bhi Windows PC par USB lagayein aur `GymPro-Portable.exe` par double click karein.
- App pehli dafa khud-ba-khud:
  1. Local storage mein database initialize karegi (`initdb`).
  2. Saare 36 Prisma tables aur migrations auto-deploy karegi.
  3. Express backend aur React frontend start karegi.
  4. Splash screen ke baad main desktop app window open kar degi!

---

## 📱 3. Mobile Par Chalana (PWA Link - Sabse Aasan)

Mobile par chalane ke liye kisi heavy software ya SDK ki zaroorat nahi hai:

1. **Step 1:** Apne terminal mein live link generate karein:
   ```bash
   npm run tunnel
   ```
   Yeh aapko ek link dega (maslan: `https://xxxx.trycloudflare.com`).
2. **Step 2:** Yeh link WhatsApp ya SMS par send karein.
3. **Step 3:** Mobile par user link open karega to usay **"Install GymPro"** ka button milega.
4. Button dabate hi app direct phone ki home screen par app icon ke sath install ho jayegi!

---

## 📁 Banaye Gaye Files Ka Overview

- [package.json](file:///d:/Gym%20App/package.json): Root configuration jisme Electron, build scripts aur portable settings hain.
- [electron/main.cjs](file:///d:/Gym%20App/electron/main.cjs): Electron main process jo backend lifecycle, security tokens, splash screen aur window management handle karta hai.
- [electron/db-manager.cjs](file:///d:/Gym%20App/electron/db-manager.cjs): Smart database manager jo check karta hai ke kya Postgres pehle se chal raha hai, ya embedded portable Postgres start karna hai.
- [electron/preload.cjs](file:///d:/Gym%20App/electron/preload.cjs): Secure native desktop bridge (printing, window controls, external links).
- [electron/splash.html](file:///d:/Gym%20App/electron/splash.html): Modern dark-themed splash screen jo database aur server start hone tak progress dikhata hai.
- [scripts/download-portable-pg.cjs](file:///d:/Gym%20App/scripts/download-portable-pg.cjs): Portable PostgreSQL download karne ka automated script.
