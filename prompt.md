Generează o aplicație web completă într-o singură pagină (Single Page Application - SPA), găzduită pe GitHub Pages (un singur fișier autoconținut `index.html`), cu design mobil iOS Glassmorphism inspirat din ecranul de calendar Stitch din imagine.

### 🎨 Sistemul Cromatic Strict (coduri HEX exacte):
1. **Faza Menstruală:** `#EE9DCB` (Roz trandafiriu)
2. **Faza Foliculară:** `#FCEF9F` (Galben cald / unt)
3. **Fereastra Fertilă:** `#B6F5A7` (Verde pastel)
4. **Ziua Ovulației:** `#909CFC` (Albastru-liliac / periwinkle)
5. **Faza Luteală:** `#ACEDF3` (Bleu ciel / acvamarin)

Fundalul general: alb-crem cald cu degradeuri difuze (`backdrop-blur-3xl`) și carduri translucide stil iOS cu margini `border-white/40` și `rounded-3xl`.

---

### 🧮 Logica Biologică a Metodei Calendarului (Ciclul implicit de 28 de zile, sângerare 5 zile):
La declanșarea Zilei 1 (data start):
- **Zilele 1 – 5:** Faza Menstruală (`#EE9DCB`) — Durată: 5 zile.
- **Zilele 6 – 10:** Faza Foliculară (`#FCEF9F`) — Durată: 5 zile.
- **Zilele 11 – 13:** Fereastră Fertilă debut (`#B6F5A7`) — Durată: 3 zile.
- **Ziua 14:** Ziua Ovulației (`#909CFC`) — Vârf fertil, 1 zi.
- **Zilele 15 – 16:** Fereastră Fertilă final (`#B6F5A7`) — Durată: 2 zile (total fereastră fertilă: 5-6 zile).
- **Zilele 17 – 28:** Faza Luteală (`#ACEDF3`) — Durată: 12 zile (fertilitate minimă).

---

### 📱 Structura Pagină Unică (Single Screen Layout):

#### 1. Header & Buton Principal de Declanșare
- Titlu curat („Calendar Menstrual”) și indicator oră/semnal stil status-bar iOS.
- Selector de lună și an cu săgeți de navigare (`<` `Iunie 2026` `>`).
- **Butonul de pornire rapidă:** Un buton mare, vizibil, stil pastilă translucidă:
  - Text: `+ A început menstruația astăzi`
  - La apăsarea acestui buton (SAU prin click direct pe o zi din grila calendarului), acea dată devine Ziua 1. Tot ciclul se recalculează instantaneu, iar datele se salvează în `localStorage`.

#### 2. Grila Calendarului Lunar
- Afișează zilele lunii selectate.
- Oricare zi poate fi apăsată pentru a fi setată ca început de menstruație.
- Zilele calculate din ciclu se încercuiesc/colorează direct în calendar cu nuanța specifică etapei:
  - Zilele 1–5: fundal cerc/pastilă `#EE9DCB`
  - Zilele 6–10: fundal cerc/pastilă `#FCEF9F`
  - Zilele 11–13 și 15–16: fundal cerc/pastilă `#B6F5A7`
  - Ziua 14: cerc accent `#909CFC` cu simbol distinctiv de ovulație
  - Zilele 17–28: fundal cerc/pastilă `#ACEDF3`

#### 3. Secțiunea Pilulelor Verticale Proporționale (Durată Etape)
- O bară orizontală care conține **5 pilule verticale** alăturate, fiecare corespunzând unei etape:
  1. *Menstruație* (`#EE9DCB`, 5 zile)
  2. *Foliculară* (`#FCEF9F`, 5 zile)
  3. *Fertilă* (`#B6F5A7`, 5 zile)
  4. *Ovulație* (`#909CFC`, 1 zi)
  5. *Luteală* (`#ACEDF3`, 12 zile)
- **Cerință vizuală cheie:** Înălțimea fiecărei pilule pe verticală este calculată proporțional cu numărul de zile ale etapei respective (pilula etapei Luteale de 12 zile este mult mai înaltă decât pilula Ovulației de 1 zi).
- În interiorul fiecărei pilule: numele etapei și numărul de zile (ex: „12z”, „5z”, „1z”).

#### 4. Secțiunea de Carduri ale Fazelor (înlocuiesc vechile Log/Symptom/Face/Energy)
- Rând de **5 carduri de stare** (câte unul pentru fiecare etapă a ciclului):
  - Card 1: Fundal/accent `#EE9DCB` — Titlu: **Menstruație** (Zilele 1–5)
  - Card 2: Fundal/accent `#FCEF9F` — Titlu: **Foliculară** (Zilele 6–10)
  - Card 3: Fundal/accent `#B6F5A7` — Titlu: **Fereastră Fertilă** (Zilele 11–16)
  - Card 4: Fundal/accent `#909CFC` — Titlu: **Ovulație** (Ziua 14)
  - Card 5: Fundal/accent `#ACEDF3` — Titlu: **Faza Luteală** (Zilele 17–28)
- Cardul fazei în care se află utilizatoarea în ziua curentă primește un contur evidențiat (glow / ring).

#### 5. Grila Celor 4 Carduri Informative (din partea de jos a calendarului Stitch)
- Păstrează exact cele 4 carduri din designul Stitch:
  1. **Next Period** (arată data estimată a următoarei menstruații, iconiță roz).
  2. **Fertile Window** (arată intervalul exact de zile fertile, ex: „3 - 8 Iulie”, iconiță verde).
  3. **Ovulation** (arată data exactă calculată pentru ovulație, iconiță galben/violet).
  4. **Cycle Day** (arată ziua curentă din ciclu, ex: „Day 12 / 28”, iconiță liliac).

---

### ⚙️ Cerințe Tehnice:
- Scrie codul complet într-un singur fișier `index.html`.
- Folosește Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com"></script>`).
- Folosește exclusiv Vanilla JavaScript, curat și bine structurat.
- Toate selecțiile se salvează în `localStorage` pentru persistență la reîncărcarea paginii.