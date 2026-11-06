# AuraCycle — Calendar Menstrual & Metoda Calendarului

Aplicație web progresivă (PWA / Single Page Application), găzduită pe GitHub Pages, creată cu design mobil **iOS Glassmorphism** pentru calculul etapelor ciclului menstrual conform metodei calendarului.

🔗 **Demo Live GitHub Pages:** [https://scaevola1981.github.io/Calculator-Metoda-calendarului/](https://scaevola1981.github.io/Calculator-Metoda-calendarului/)

---

## 🎨 Etapele Ciclului de 28 de Zile & Codul Culorilor

Calculul pornește din **Ziua 1** (prima zi de menstruație selectată) și parcurge 28 de zile împărțite în 4 etape distincte (`5 + 3 + 12 + 8 = 28 zile`):

1. **Menstruație (Zilele 1 – 5 • 5 zile):**
   - **Culoare:** Galben (`#FCEF9F`) cu simbolul `🩸` și pulsație complementară intensă pe Ziua 1.
   - **Fertilitate:** Șanse minime de concepție.
2. **Faza Foliculară / Post-Menstruală (Zilele 6 – 8 • 3 zile):**
   - **Culoare:** Galben (`#FCEF9F`).
   - **Fertilitate:** Perioadă post-menstruală cu fertilitate scăzută.
3. **Perioadă Fertilă & Ovulație (Zilele 9 – 20 • 12 zile):**
   - **Culoare:** Roșu (`#EF4444`) marcat cu iconița bebeluș `👶` pe fiecare dintre cele 12 zile.
   - **Fertilitate:** Șanse ridicate de concepție (include **Ziua Ovulației în Ziua 14**).
4. **Faza Luteală / Post-Fertilă (Zilele 21 – 28 • 8 zile):**
   - **Culoare:** Galben (`#FCEF9F`).
   - **Fertilitate:** Șanse minime de concepție până la următoarea menstruație.

### 🌈 Paleta Cromatică Oficială (5 Culori Principale + 5 Culori Complementare)

| Culoare Principală | Cod HEX | Culoare Complementară | Cod HEX Complementar | Utilizare în Aplicație |
| :--- | :---: | :--- | :---: | :--- |
| **Albastru-Liliac (Ovulație)** | `#909CFC` | **Galben Solar** | `#FCF090` | Selector lună, buton „Azi”, card Ziua Ovulației |
| **Roz Trandafiriu (Menstruație)** | `#EE9DCB` | **Verde Mentă** | `#9DEEBF` | Buton principal, Refresh Header, card Următoarea Menstruație |
| **Galben Cald (Foliculară / Zile sigure)** | `#FCEF9F` | **Indigo-Lavandă** | `#9FA7FC` | Zile sigure în calendar, pulsație Ziua 1, card Ziua din Ciclu |
| **Bleu Ciel / Acvamarin (Luteală)** | `#ACEDF3` | **Coral-Piersică** | `#F3B2AC` | Card Recomandare Zilnică, halo pulsație complementară |
| **Verde Pastel (Fereastră Fertilă)** | `#B6F5A7` | **Orhidee / Liliac** | `#E6A7F5` | Card Fereastră Fertilă, inel exterior pulsație Ziua 1 |

---

## 📱 Funcționalități Principale

### Pagina 1 — Calendar Menstrual (`#viewCalendar`)
- **Buton Principal de Pornire Rapidă:** `+ A început menstruația astăzi` setează instant data curentă ca Ziua 1.
- **Grilă Calendar Lunar Interactivă:**
  - Continuă automat cele 28 de zile ale ciclului activ și în luna următoare dacă menstruația a început spre finalul lunii (ex. `30 Octombrie → 26 Noiembrie`), după care afișează starea **„În așteptare”** pentru lunile viitoare.
  - **Suport pentru ciclu neregulat:** Clienta poate selecta oricând orice zi din calendar (chiar și în interiorul celor 28 de zile, ex. `22 Noiembrie`), iar calculul celor 28 de zile reîncepe imediat din acea dată.
- **Durata Proporțională a Etapelor:** 4 pilule verticale proporționale (`5z`, `3z`, `12z 👶`, `8z`) cu evidențierea etapei active.
- **4 Carduri Informative (Indicatori Cheie):** *Următoarea Menstruație*, *Fereastră Fertilă (Z9–20)*, *Ziua Ovulației (Z14)* și *Ziua din Ciclu*.
- **Recomandare Zilnică:** Sfaturi adaptate fazei fiziologice curente.

### Pagina 2 — Starea Ciclului Tău (`#viewDashboard`)
- **Cardurile Etapelor Ciclului Menstrual:** Prezentare detaliată a celor 4 etape biologice, cu evidențierea automată a fazei active.
- **📈 Grafic Regularitatea Menstruației (La câte zile vine următoarea menstruație):**
  - Calculează automat numărul exact de zile dintre menstruații consecutive (ex. `30 Oct → 22 Noi = 23 zile`).
  - Afișează **Ultimul Ciclu**, **Media Ta** și **Ritmicitatea**:
    - 🟢 **Regulat** (`26–30 zile`)
    - 🟡 **Mai scurt** (`< 26 zile`)
    - 🔴 **Mai lung** (`> 30 zile`)
  - Include grafic cu bare verticale, linie de referință la `28 zile` și lista cronologică a menstruațiilor înregistrate (cu opțiune de ștergere individuală `✕`).

### Navigare & Utilitare
- **Bară de Navigare Inferioară (Sticky Bottom NavBar):**
  1. **Acasă (Pagina 1):** Calendar Menstrual.
  2. **Starea Ciclului (Pagina 2):** Etapele Ciclului & Graficul de Regularitate.
  3. **Selector Manual de Dată:** Modal modern pentru alegerea primei zile de menstruație.
  4. **Buton Refresh (`🔄`):** Reîmprospătează aplicația ocolind cache-ul browserului (disponibil și în antetul ambelor pagini), păstrând intacte datele salvate.
  5. **Resetare Date (`🗑️`):** Modal de confirmare pentru ștergerea datelor și resetarea aplicației.
- **Persistență Locală (`localStorage`):** Data de start, istoricul ciclurilor și pagina activă sunt salvate automat pe dispozitiv.

---

## 📂 Structura Proiectului

```text
Aplicatie-menstruatie/
├── index.html               # Structura HTML și stilurile iOS Glassmorphism
├── app.js                   # Logica JavaScript (calcul ciclu, calendar, grafic regularitate, localStorage)
├── manifest.json            # Configurare Progressive Web App (PWA)
├── README.md                # Documentația proiectului
└── public/                  # Toate resursele grafice (.jpg, .png, .ico)
    ├── background.jpg       # Imaginea ambientală de fundal
    ├── logo.png             # Logo-ul aplicației (transparent)
    ├── logo.jpg             # Logo-ul aplicației (format JPG)
    ├── logo-square.png      # Logo pătrat
    ├── app-icon.png         # Iconiță aplicație
    ├── apple-touch-icon.png # Iconiță iOS Home Screen (180x180)
    ├── icon-192.png         # Iconiță PWA (192x192)
    ├── icon-512.png         # Iconiță PWA (512x512)
    ├── favicon.ico          # Favicon standard
    ├── favicon.png          # Favicon PNG
    ├── favicon-16x16.png    # Favicon 16x16
    └── favicon-32x32.png    # Favicon 32x32
```

---

> **Notă medicală:** Această aplicație are scop informativ și educativ. Metoda calendarului nu oferă protecție contraceptivă 100% sigură și nu înlocuiește consultul medical de specialitate.
