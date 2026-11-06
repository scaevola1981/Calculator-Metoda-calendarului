// Configurare Tailwind CSS
if (typeof tailwind !== 'undefined') {
  tailwind.config = {
    theme: {
      extend: {
        fontFamily: {
          sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        },
        colors: {
          phase: {
            menstrual: '#EE9DCB',
            follicular: '#FCEF9F',
            fertile: '#B6F5A7',
            ovulation: '#909CFC',
            luteal: '#ACEDF3',
          },
          complement: {
            ovulation: '#FCF090',   // Complementară pentru #909CFC
            menstrual: '#9DEEBF',   // Complementară pentru #EE9DCB
            follicular: '#9FA7FC',  // Complementară pentru #FCEF9F
            luteal: '#F3B2AC',      // Complementară pentru #ACEDF3
            fertile: '#E6A7F5',     // Complementară pentru #B6F5A7
          }
        },
        boxShadow: {
          'glass': '0 8px 32px 0 rgba(144, 156, 252, 0.12)',
          'glass-hover': '0 12px 40px 0 rgba(238, 157, 203, 0.22)',
          'glow-pink': '0 0 25px rgba(238, 157, 203, 0.5)',
          'glow-purple': '0 0 25px rgba(144, 156, 252, 0.5)',
        }
      }
    }
  };
}

// Logică Aplicație Calendar Menstrual & Persistență LocalStorage
(function () {
  'use strict';

  // Constante Ciclul Biologic (28 zile conform prompt.md)
  const CYCLE_LENGTH = 28;
  const PERIOD_DURATION = 5;
  const OVULATION_DAY = 14;

  // Numele Lunilor în Limba Română
  const MONTH_NAMES_RO = [
    "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
    "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"
  ];

  // Stare aplicație
  let state = {
    cycleStartDate: null, // format 'YYYY-MM-DD' (ultima menstruație înregistrată)
    recordedCycles: {},   // Evidență per lună: { 'YYYY-MM': 'YYYY-MM-DD' }
    cycleHistory: [],     // Istoric cronologic al datelor de început (ex: ['2026-10-30', '2026-11-22'])
    chartMode: 'horizontal', // 'horizontal' | 'line' | 'gauge'
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(), // 0-11
    activeView: 'calendar' // 'calendar' (Pagina 1) sau 'dashboard' (Pagina 2)
  };

  // Helper Formatare Dată 'YYYY-MM-DD'
  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseDateISO(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Formatare prietenoasă în limba română (ex: "14 Noiembrie")
  function formatRomanianDate(date) {
    if (!date) return '--';
    return `${date.getDate()} ${MONTH_NAMES_RO[date.getMonth()]}`;
  }

  // Încărcare stare din localStorage
  function loadState() {
    const saved = localStorage.getItem('auracycle_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.cycleStartDate) {
          state.cycleStartDate = parsed.cycleStartDate;
          state.recordedCycles = { [parsed.cycleStartDate]: parsed.cycleStartDate };
          const d = parseDateISO(parsed.cycleStartDate);
          if (d) {
            state.calendarYear = d.getFullYear();
            state.calendarMonth = d.getMonth();
          }
        }
        if (Array.isArray(parsed.cycleHistory) && parsed.cycleHistory.length > 0) {
          state.cycleHistory = parsed.cycleHistory
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        } else if (state.cycleStartDate) {
          state.cycleHistory = [state.cycleStartDate];
        }
        if (parsed.chartMode === 'horizontal' || parsed.chartMode === 'line' || parsed.chartMode === 'gauge') {
          state.chartMode = parsed.chartMode;
        }
      } catch (e) {
        console.warn('Nu s-au putut parsa datele salvate:', e);
      }
    }

    const savedView = localStorage.getItem('auracycle_active_view');
    if (savedView === 'dashboard' || savedView === 'calendar') {
      state.activeView = savedView;
    }
  }

  // Salvare stare în localStorage
  function saveState() {
    localStorage.setItem('auracycle_state', JSON.stringify({
      cycleStartDate: state.cycleStartDate,
      recordedCycles: state.recordedCycles,
      cycleHistory: state.cycleHistory,
      chartMode: state.chartMode
    }));
  }

  // Înregistrarea datei de început a menstruației (orice dată selectată devine noua Ziua 1 și resetează calculul de 28 de zile)
  function setCycleStartDate(dateISO) {
    state.cycleStartDate = dateISO;
    state.recordedCycles = dateISO ? { [dateISO]: dateISO } : {};

    if (dateISO) {
      const newDate = parseDateISO(dateISO);
      if (newDate) {
        // Dacă există deja o dată în istoric la mai puțin de 10 zile distanță, o înlocuim (corecție a aceluiași ciclu).
        // Dacă este la >= 10 zile distanță (ex: 30 Oct -> 22 Noi = 23 zile), o păstrăm ca menstruație nouă pentru calculul regularității.
        const filtered = (state.cycleHistory || []).filter(existingISO => {
          const exDate = parseDateISO(existingISO);
          if (!exDate) return false;
          const diff = Math.abs(Math.round((newDate.getTime() - exDate.getTime()) / (1000 * 60 * 60 * 24)));
          return diff >= 10;
        });
        filtered.push(dateISO);
        filtered.sort((a, b) => a.localeCompare(b));
        state.cycleHistory = filtered.slice(-8); // păstrăm ultimele 8 menstruații
      }
    }

    saveState();
  }

  // Returnează data de start (ISO) a ciclului de 28 de zile care acoperă targetDate.
  // Dacă prima zi a venit pe 30 Octombrie, ciclul continuă toate cele 28 de zile și în luna următoare
  // (până pe 26 Noiembrie), după care intră în așteptare pentru următoarea menstruație.
  function getActiveCycleStartForDate(targetDate) {
    if (!targetDate || !state.cycleStartDate) return null;
    const start = parseDateISO(state.cycleStartDate);
    if (!start) return null;

    const diffDays = Math.round((targetDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < CYCLE_LENGTH) {
      return state.cycleStartDate;
    }
    return null;
  }

  // Returnează ciclul activ care acoperă zile din luna (year, month)
  function getActiveCycleStartForMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const sISO = getActiveCycleStartForDate(new Date(year, month, d));
      if (sISO) return sISO;
    }
    return null;
  }

  // Obținerea Zilei Curente a Ciclului (1-28) pentru o anumită dată
  function getCycleDayForDate(targetDate) {
    const startISO = getActiveCycleStartForDate(targetDate);
    if (!startISO) return null;

    const start = parseDateISO(startISO);
    const diffDays = Math.round((targetDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays + 1; // 1 la 28
  }

  // Identificarea Fazei pentru o anumită Zi a Ciclului (1-28)
  // 1. Menstruație: Zilele 1–5 (Galben #FCEF9F)
  // 2. Post-menstrual / Foliculară: Zilele 6–8 (Galben #FCEF9F)
  // 3. Fereastră Fertilă: Zilele 9–20 (Roșu #EF4444 cu 👶)
  // 4. Luteală: Zilele 21–28 (Galben #FCEF9F)
  function getPhaseInfo(cycleDay) {
    if (!cycleDay || cycleDay < 1 || cycleDay > CYCLE_LENGTH) {
      return {
        id: 'none',
        name: 'Nedefinit',
        colorHex: '#CBD5E1',
        badgeBg: '#F1F5F9',
        badgeText: '#475569',
        chanceText: 'Apasă butonul de pornire',
        advice: 'Setează începutul menstruației pentru a primi sfaturi personalizate.'
      };
    }

    if (cycleDay >= 1 && cycleDay <= 5) {
      return {
        id: 'menstrual',
        name: 'Menstruație',
        colorHex: '#FCEF9F',
        badgeBg: '#FCEF9F60',
        badgeText: '#78350F',
        chanceText: 'Șanse minime de concepție',
        advice: 'Nivelul de energie este scăzut natural. Oferă-ți căldură, hidratare și o pauză binemeritată.'
      };
    } else if (cycleDay >= 6 && cycleDay <= 8) {
      return {
        id: 'follicular',
        name: 'Faza Foliculară',
        colorHex: '#FCEF9F',
        badgeBg: '#FCEF9F60',
        badgeText: '#78350F',
        chanceText: 'Fertilitate scăzută (Z6–8)',
        advice: 'Estrogenul crește treptat, oferindu-ți vitalitate și claritate mentală după menstruație.'
      };
    } else if (cycleDay >= 9 && cycleDay <= 20) {
      return {
        id: 'fertile',
        name: cycleDay === 14 ? 'Ziua Ovulației 👶' : 'Perioadă Fertilă 👶',
        colorHex: '#EF4444',
        badgeBg: '#FEE2E2',
        badgeText: '#991B1B',
        chanceText: cycleDay === 14 ? 'Vârf maxim de fertilitate (Ovulație 👶)' : 'Șanse ridicate de concepție 👶',
        advice: 'Perioadă fertilă activă (Zilele 9–20). Șanse ridicate de concepție conform metodei calendarului.'
      };
    } else {
      return {
        id: 'luteal',
        name: 'Faza Luteală',
        colorHex: '#FCEF9F',
        badgeBg: '#FCEF9F60',
        badgeText: '#78350F',
        chanceText: 'Șanse minime de concepție',
        advice: 'Progesteronul sporește nevoia de tihnă. Hidratează-te corespunzător și redu cafeina.'
      };
    }
  }

  // Actualizare ceas status bar iOS
  function updateClock() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');

    document.querySelectorAll('.statusBarTime').forEach(el => {
      el.textContent = `${hrs}:${mins}`;
    });

    const todayStr = `${now.getDate()} ${MONTH_NAMES_RO[now.getMonth()]} ${now.getFullYear()}`;
    document.querySelectorAll('.todayDateSubtitle').forEach(el => {
      el.textContent = todayStr;
    });
  }

  // Comutare între Pagina 1 (Calendar) și Pagina 2 (Dashboard / Ceas) cu animație fluidă iOS (#1)
  function switchView(viewName) {
    state.activeView = viewName;
    localStorage.setItem('auracycle_active_view', viewName);

    const view1 = document.getElementById('viewCalendar');
    const view2 = document.getElementById('viewDashboard');
    const ind1 = document.getElementById('navTabCalendarIndicator');
    const ind2 = document.getElementById('navTabDashboardIndicator');

    if (viewName === 'calendar') {
      view1.classList.remove('hidden', 'animate-view-enter');
      void view1.offsetWidth; // Reflow pentru re-declanșarea animației
      view1.classList.add('animate-view-enter');
      view2.classList.add('hidden');
      view2.classList.remove('animate-view-enter');

      ind1.className = 'w-10 h-10 rounded-full bg-gradient-to-tr from-[#909CFC] to-[#EE9DCB] text-white flex items-center justify-center shadow-md transition-transform duration-300 scale-105';
      ind2.className = 'w-10 h-10 rounded-full flex items-center justify-center text-gray-500 transition-transform duration-300';
    } else {
      view1.classList.add('hidden');
      view1.classList.remove('animate-view-enter');
      view2.classList.remove('hidden', 'animate-view-enter');
      void view2.offsetWidth; // Reflow pentru re-declanșarea animației
      view2.classList.add('animate-view-enter');

      ind1.className = 'w-10 h-10 rounded-full flex items-center justify-center text-gray-500 transition-transform duration-300';
      ind2.className = 'w-10 h-10 rounded-full bg-gradient-to-tr from-[#909CFC] to-[#EE9DCB] text-white flex items-center justify-center shadow-md transition-transform duration-300 scale-105';
      renderRegularityChart();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Randare Generală
  function renderAll() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentCycleDay = getCycleDayForDate(today);
    const currentPhase = getPhaseInfo(currentCycleDay);

    // 1. Selector de Lună & Etichetă
    const monthLabel = document.getElementById('currentMonthYearLabel');
    if (monthLabel) {
      monthLabel.textContent = `${MONTH_NAMES_RO[state.calendarMonth]} ${state.calendarYear}`;
    }

    // 2. Buton Principal de Declanșare Pagina 1 & Recomandare
    const btnPeriodActionText = document.getElementById('btnPeriodActionText');
    const dailyAdviceText = document.getElementById('dailyAdviceText');

    const todayStartISO = getActiveCycleStartForDate(today);
    const viewingMonthStartISO = getActiveCycleStartForMonth(state.calendarYear, state.calendarMonth);
    const activeStartISO = todayStartISO || viewingMonthStartISO;

    if (currentCycleDay) {
      btnPeriodActionText.textContent = `Menstruație înregistrată (Ziua ${currentCycleDay})`;
      dailyAdviceText.textContent = currentPhase.advice;
    } else if (viewingMonthStartISO) {
      const vStart = parseDateISO(viewingMonthStartISO);
      btnPeriodActionText.textContent = `Menstruație înregistrată (${formatRomanianDate(vStart)})`;
      dailyAdviceText.textContent = `Ciclul început pe ${formatRomanianDate(vStart)} parcurge toate cele 28 de zile de etape, apoi rămâne în așteptarea următoarei menstruații.`;
    } else if (state.cycleStartDate) {
      btnPeriodActionText.textContent = `+ A început menstruația astăzi`;
      dailyAdviceText.textContent = `Ciclul de 28 de zile s-a încheiat. Pentru următoarea menstruație, apasă pe buton sau selectează ziua de debut în calendar.`;
    } else {
      btnPeriodActionText.textContent = `+ A început menstruația astăzi`;
      dailyAdviceText.textContent = `Apasă pe butonul de mai sus sau pe orice zi din calendar pentru a genera instantaneu prognoza biologică.`;
    }

    // 3. Randare Grilă Calendar (Pagina 1)
    renderCalendar();

    // 4. Pilule Verticale Proporționale (Evidențiere activă + Soft Glow #3)
    ['Menstrual', 'Follicular', 'Fertile', 'Luteal'].forEach(pName => {
      const pill = document.getElementById(`pill${pName}`);
      if (pill) {
        const inner = pill.firstElementChild;
        if (currentCycleDay && currentPhase.id === pName.toLowerCase()) {
          inner.classList.add('ring-4', 'ring-[#909CFC]', 'ring-offset-2', 'shadow-md', '-translate-y-1', 'animate-soft-glow');
        } else {
          inner.classList.remove('ring-4', 'ring-[#909CFC]', 'ring-offset-2', 'shadow-md', '-translate-y-1', 'animate-soft-glow');
        }
      }
    });

    // 5. Carduri de Faze (Evidențiere activă + Soft Glow #3)
    const phaseCards = {
      menstrual: document.getElementById('cardPhaseMenstrual'),
      follicular: document.getElementById('cardPhaseFollicular'),
      fertile: document.getElementById('cardPhaseFertile'),
      luteal: document.getElementById('cardPhaseLuteal')
    };

    Object.keys(phaseCards).forEach(key => {
      const card = phaseCards[key];
      if (card) {
        if (currentCycleDay && currentPhase.id === key) {
          card.classList.add('ring-2', 'ring-[#909CFC]', 'ring-offset-2', 'shadow-md', 'scale-[1.01]', 'animate-soft-glow');
        } else {
          card.classList.remove('ring-2', 'ring-[#909CFC]', 'ring-offset-2', 'shadow-md', 'scale-[1.01]', 'animate-soft-glow');
        }
      }
    });

    // 6. Cele 4 Carduri Informative (Stitch - Pagina 1 & Pagina 2)
    const stitchNextPeriodDate = document.getElementById('stitchNextPeriodDate');
    const stitchNextPeriodCountdown = document.getElementById('stitchNextPeriodCountdown');
    const stitchFertileWindowRange = document.getElementById('stitchFertileWindowRange');
    const stitchOvulationDate = document.getElementById('stitchOvulationDate');
    const stitchCycleDayRatio = document.getElementById('stitchCycleDayRatio');
    const stitchCurrentPhaseName = document.getElementById('stitchCurrentPhaseName');

    if (activeStartISO) {
      const startDate = parseDateISO(activeStartISO);
      const nextPeriod = new Date(startDate);
      nextPeriod.setDate(startDate.getDate() + CYCLE_LENGTH);
      stitchNextPeriodDate.textContent = formatRomanianDate(nextPeriod);

      const daysLeft = Math.ceil((nextPeriod.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      stitchNextPeriodCountdown.textContent = daysLeft > 0 ? `În aproximativ ${daysLeft} zile` : (daysLeft === 0 ? `Astăzi` : `În așteptare`);

      const fertileStart = new Date(startDate);
      fertileStart.setDate(startDate.getDate() + 8); // Ziua 9 (index 8)

      const fertileEnd = new Date(startDate);
      fertileEnd.setDate(startDate.getDate() + 19); // Ziua 20 (index 19)

      if (fertileStart.getMonth() === fertileEnd.getMonth()) {
        stitchFertileWindowRange.textContent = `${fertileStart.getDate()} - ${fertileEnd.getDate()} ${MONTH_NAMES_RO[fertileEnd.getMonth()].substring(0, 3)}`;
      } else {
        stitchFertileWindowRange.textContent = `${fertileStart.getDate()} ${MONTH_NAMES_RO[fertileStart.getMonth()].substring(0, 3)} - ${fertileEnd.getDate()} ${MONTH_NAMES_RO[fertileEnd.getMonth()].substring(0, 3)}`;
      }

      const ovulDate = new Date(startDate);
      ovulDate.setDate(startDate.getDate() + 13); // Ziua 14 (index 13)
      stitchOvulationDate.textContent = formatRomanianDate(ovulDate);

      if (currentCycleDay) {
        stitchCycleDayRatio.textContent = `Ziua ${currentCycleDay} / ${CYCLE_LENGTH}`;
        stitchCurrentPhaseName.textContent = currentPhase.name;
      } else {
        stitchCycleDayRatio.textContent = `Ciclu de ${CYCLE_LENGTH} zile`;
        stitchCurrentPhaseName.textContent = `Z1 pe ${formatRomanianDate(startDate)}`;
      }
    } else if (state.cycleStartDate) {
      // Există un ciclu anterior înregistrat, dar luna vizualizată este în așteptare
      const lastStartDate = parseDateISO(state.cycleStartDate);
      const estimatedNext = new Date(lastStartDate);
      estimatedNext.setDate(lastStartDate.getDate() + CYCLE_LENGTH);
      stitchNextPeriodDate.textContent = formatRomanianDate(estimatedNext);
      stitchNextPeriodCountdown.textContent = 'În așteptare (confirmă Ziua 1)';
      stitchFertileWindowRange.textContent = '--';
      stitchOvulationDate.textContent = '--';
      stitchCycleDayRatio.textContent = 'Ziua -- / 28';
      stitchCurrentPhaseName.textContent = 'În așteptare menstruație nouă';
    } else {
      stitchNextPeriodDate.textContent = '--';
      stitchNextPeriodCountdown.textContent = 'Alege data de start';
      stitchFertileWindowRange.textContent = '--';
      stitchOvulationDate.textContent = '--';
      stitchCycleDayRatio.textContent = 'Ziua -- / 28';
      stitchCurrentPhaseName.textContent = 'Ciclul nu este setat';
    }

    // 7. Cycle Ring Info (Pagina 2)
    const cycleDayText = document.getElementById('cycleDayText');
    const ringMainTitle = document.getElementById('ringMainTitle');
    const conceptionChanceBadge = document.getElementById('conceptionChanceBadge');
    const conceptionChanceText = document.getElementById('conceptionChanceText');

    if (cycleDayText && ringMainTitle && conceptionChanceBadge && conceptionChanceText) {
      if (currentCycleDay) {
        cycleDayText.textContent = `ZIUA ${currentCycleDay} DIN ${CYCLE_LENGTH}`;
        const daysUntilNext = CYCLE_LENGTH - currentCycleDay;
        if (daysUntilNext === 0) {
          ringMainTitle.textContent = 'Menstruație nouă estimată astăzi';
        } else if (daysUntilNext === 1) {
          ringMainTitle.textContent = 'Următoarea menstruație mâine';
        } else {
          ringMainTitle.textContent = `Următoarea menstruație în ${daysUntilNext} zile`;
        }
        conceptionChanceText.textContent = currentPhase.chanceText;
        conceptionChanceBadge.style.backgroundColor = currentPhase.badgeBg;
        conceptionChanceBadge.style.color = currentPhase.badgeText;
      } else if (state.cycleStartDate) {
        cycleDayText.textContent = `ÎN AȘTEPTARE`;
        ringMainTitle.textContent = `Așteptare menstruație nouă`;
        conceptionChanceText.textContent = `Înregistrează Ziua 1 când începe menstruația`;
        conceptionChanceBadge.style.backgroundColor = '#F1F5F9';
        conceptionChanceBadge.style.color = '#475569';
      } else {
        cycleDayText.textContent = `CICLU NESETAT`;
        ringMainTitle.textContent = `Alege o zi pentru a începe`;
        conceptionChanceText.textContent = `Nicio dată înregistrată`;
        conceptionChanceBadge.style.backgroundColor = '#F1F5F9';
        conceptionChanceBadge.style.color = '#475569';
      }
    }

    // 8. Grafic Regularitatea Începerii Menstruației (Pagina 2)
    renderRegularityChart();
  }

  // Randare Grafic Regularitatea Menstruației (La câte zile vine următoarea menstruație)
  function renderRegularityChart() {
    const barsContainer = document.getElementById('regularityBarsContainer');
    const historyList = document.getElementById('regularityHistoryList');
    const avgBadge = document.getElementById('regularityAvgBadge');
    const lastCycleEl = document.getElementById('regLastCycleDays');
    const avgCycleEl = document.getElementById('regAvgCycleDays');
    const statusLabelEl = document.getElementById('regStatusLabel');

    if (!barsContainer || !historyList) return;

    barsContainer.innerHTML = '';
    historyList.innerHTML = '';

    // Ordonăm istoricul cronologic
    const dates = (state.cycleHistory || [])
      .filter(Boolean)
      .slice()
      .sort((a, b) => a.localeCompare(b));

    // Calculăm intervalele în zile dintre menstruații consecutive
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      const d1 = parseDateISO(dates[i - 1]);
      const d2 = parseDateISO(dates[i]);
      if (d1 && d2) {
        const days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0) {
          intervals.push({
            fromISO: dates[i - 1],
            toISO: dates[i],
            fromLabel: `${d1.getDate()} ${MONTH_NAMES_RO[d1.getMonth()].substring(0, 3)}`,
            toLabel: `${d2.getDate()} ${MONTH_NAMES_RO[d2.getMonth()].substring(0, 3)}`,
            days: days,
            isEstimated: false
          });
        }
      }
    }

    // Calculăm media și statusul de regularitate
    let avgDays = CYCLE_LENGTH;
    if (intervals.length > 0) {
      const sum = intervals.reduce((acc, item) => acc + item.days, 0);
      avgDays = Math.round(sum / intervals.length);
      const lastDays = intervals[intervals.length - 1].days;

      if (lastCycleEl) lastCycleEl.textContent = `${lastDays} zile`;
      if (avgCycleEl) avgCycleEl.textContent = `${avgDays} zile`;
      if (avgBadge) avgBadge.textContent = `Medie: ${avgDays} zile`;

      if (statusLabelEl) {
        if (lastDays >= 26 && lastDays <= 30) {
          statusLabelEl.textContent = 'Regulat';
          statusLabelEl.className = 'text-xs font-extrabold text-emerald-600 mt-1 block';
        } else if (lastDays < 26) {
          statusLabelEl.textContent = `Mai scurt (${lastDays}z)`;
          statusLabelEl.className = 'text-xs font-extrabold text-amber-600 mt-1 block';
        } else {
          statusLabelEl.textContent = `Mai lung (${lastDays}z)`;
          statusLabelEl.className = 'text-xs font-extrabold text-rose-600 mt-1 block';
        }
      }
    } else {
      if (lastCycleEl) lastCycleEl.textContent = state.cycleStartDate ? '28z (est.)' : '-- zile';
      if (avgCycleEl) avgCycleEl.textContent = '28 zile';
      if (avgBadge) avgBadge.textContent = 'Standard: 28 zile';
      if (statusLabelEl) {
        statusLabelEl.textContent = state.cycleStartDate ? 'În monitorizare' : 'Nesetat';
        statusLabelEl.className = 'text-xs font-extrabold text-purple-600 mt-1 block';
      }
    }

    // Construim barele de afișat în grafic (intervalele înregistrate + următorul ciclu estimat la 28 zile)
    const chartItems = intervals.slice(-5);
    if (state.cycleStartDate) {
      const latestStart = parseDateISO(state.cycleStartDate);
      if (latestStart) {
        const estNext = new Date(latestStart);
        estNext.setDate(latestStart.getDate() + CYCLE_LENGTH);
        chartItems.push({
          fromISO: state.cycleStartDate,
          toISO: formatDateISO(estNext),
          fromLabel: `${latestStart.getDate()} ${MONTH_NAMES_RO[latestStart.getMonth()].substring(0, 3)}`,
          toLabel: `${estNext.getDate()} ${MONTH_NAMES_RO[estNext.getMonth()].substring(0, 3)}`,
          days: CYCLE_LENGTH,
          isEstimated: true
        });
      }
    }

    // Actualizăm starea vizuală a butoanelor de comutare a modului de grafic
    const mode = state.chartMode || 'horizontal';
    document.querySelectorAll('.regChartModeBtn').forEach(btn => {
      const btnMode = btn.getAttribute('data-chart-mode');
      if (btnMode === mode) {
        btn.className = 'regChartModeBtn flex-1 py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition flex items-center justify-center gap-1 bg-gradient-to-r from-[#909CFC] to-[#EE9DCB] text-white shadow-xs';
      } else {
        btn.className = 'regChartModeBtn flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold text-gray-600 hover:text-gray-900 transition flex items-center justify-center gap-1';
      }
    });

    if (chartItems.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'w-full py-10 flex items-center justify-center text-xs text-gray-400 font-medium text-center px-4';
      emptyMsg.textContent = 'Selectează data primei zile de menstruație în calendar pentru a vedea graficul regularității.';
      barsContainer.appendChild(emptyMsg);
      return;
    }

    const getStatusColorInfo = (item) => {
      if (item.isEstimated) {
        return {
          hex: '#909CFC',
          bgClass: 'bg-gradient-to-r from-[#909CFC]/70 to-[#EE9DCB]/70 border border-dashed border-purple-400',
          badgeClass: 'bg-purple-100 text-purple-800',
          tagText: `${item.days} zile (Estimat)`
        };
      }
      if (item.days >= 26 && item.days <= 30) {
        return {
          hex: '#10B981',
          bgClass: 'bg-gradient-to-r from-emerald-400 to-teal-400',
          badgeClass: 'bg-emerald-100 text-emerald-800',
          tagText: `${item.days} zile • Regulat`
        };
      }
      if (item.days < 26) {
        return {
          hex: '#F59E0B',
          bgClass: 'bg-gradient-to-r from-amber-400 to-yellow-400',
          badgeClass: 'bg-amber-100 text-amber-900',
          tagText: `${item.days} zile • Mai scurt`
        };
      }
      return {
        hex: '#F43F5E',
        bgClass: 'bg-gradient-to-r from-rose-400 to-red-400',
        badgeClass: 'bg-rose-100 text-rose-800',
        tagText: `${item.days} zile • Mai lung`
      };
    };

    if (mode === 'horizontal') {
      // VARIANTA 1: Bare Orizontale Progresive pe Cicluri (stil Clue)
      const listWrap = document.createElement('div');
      listWrap.className = 'space-y-2.5 py-1';
      const maxDaysHoriz = 36;
      const ref28Pct = Math.round((28 / maxDaysHoriz) * 100);

      chartItems.slice().reverse().forEach((item, idx) => {
        const info = getStatusColorInfo(item);
        const widthPct = Math.min(100, Math.max(25, Math.round((item.days / maxDaysHoriz) * 100)));
        const delayMs = idx * 80;

        const rowCard = document.createElement('div');
        rowCard.className = 'rounded-xl bg-gray-50/90 border border-gray-100 p-2.5 shadow-2xs';
        rowCard.innerHTML = `
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="font-extrabold text-gray-800 flex items-center gap-1">
              <span>${item.isEstimated ? '⏳' : '🩸'}</span>
              <span>${item.fromLabel} → ${item.toLabel}</span>
            </span>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${info.badgeClass}">
              ${info.tagText}
            </span>
          </div>
          <div class="relative h-4 w-full rounded-full bg-gray-200/75 overflow-hidden">
            <!-- Marcaj vertical la 28 zile -->
            <div class="absolute top-0 bottom-0 border-l-2 border-dashed border-purple-600/70 z-20" style="left: ${ref28Pct}%" title="Referință 28 zile"></div>
            <div class="h-full rounded-full animate-bar-grow ${info.bgClass}" style="width: ${widthPct}%; animation-delay: ${delayMs}ms;"></div>
          </div>
          <div class="flex items-center justify-between text-[9px] font-semibold text-gray-400 mt-1 px-0.5">
            <span>Ziua 1</span>
            <span class="text-purple-600 font-bold">Țintă: 28 zile</span>
            <span>36z</span>
          </div>
        `;
        listWrap.appendChild(rowCard);
      });
      barsContainer.appendChild(listWrap);
    } else if (mode === 'line') {
      // VARIANTA 2: Grafic cu Linie Curbată & Puncte Luminoase (stil Apple Health / Flo)
      const svgW = 310;
      const svgH = 148;
      const padLeft = 28;
      const padRight = 24;
      const padTop = 24;
      const padBottom = 28;
      const plotW = svgW - padLeft - padRight;
      const plotH = svgH - padTop - padBottom;
      const minYDays = 18;
      const maxYDays = 38;

      const dayToY = (d) => {
        const clamped = Math.min(maxYDays, Math.max(minYDays, d));
        const ratio = (clamped - minYDays) / (maxYDays - minYDays);
        return Math.round(padTop + plotH * (1 - ratio));
      };

      // Dacă există un singur punct, adăugăm un punct de referință inițial la 28z ca linia curbată să fie vizibilă și elegantă
      const pointsData = chartItems.length === 1
        ? [{ fromLabel: 'Ref.', toLabel: '28z', days: 28, isEstimated: true, isBaseline: true }, chartItems[0]]
        : chartItems;

      const coords = pointsData.map((pt, idx) => {
        const x = pointsData.length === 1
          ? padLeft + plotW / 2
          : Math.round(padLeft + (idx / (pointsData.length - 1)) * plotW);
        const y = dayToY(pt.days);
        return { x, y, pt };
      });

      // Construim curba Bezier netedă
      let pathD = `M ${coords[0].x} ${coords[0].y}`;
      for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1];
        const curr = coords[i];
        const cpx1 = Math.round(prev.x + (curr.x - prev.x) / 2);
        const cpx2 = Math.round(prev.x + (curr.x - prev.x) / 2);
        pathD += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
      }
      const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padTop + plotH} L ${coords[0].x} ${padTop + plotH} Z`;

      const y30 = dayToY(30);
      const y26 = dayToY(26);
      const y28 = dayToY(28);

      const nodesSvg = coords.map(({ x, y, pt }, idx) => {
        const info = getStatusColorInfo(pt);
        const labelTop = pt.isBaseline ? 'Standard 28z' : (pt.isEstimated ? `${pt.days}z (est.)` : `${pt.days}z`);
        const labelBottom = pt.isBaseline ? 'Referință' : `${pt.fromLabel}→${pt.toLabel}`;
        const delayMs = 180 + idx * 120;
        return `
          <g class="animate-node-pop" style="animation-delay: ${delayMs}ms;">
            <circle cx="${x}" cy="${y}" r="8" fill="${info.hex}" fill-opacity="0.22" />
            <circle cx="${x}" cy="${y}" r="4.5" fill="${info.hex}" stroke="#FFFFFF" stroke-width="2" />
            <text x="${x}" y="${y - 10}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#1F2937">${labelTop}</text>
            <text x="${x}" y="${svgH - 8}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#6B7280">${labelBottom}</text>
          </g>
        `;
      }).join('');

      barsContainer.innerHTML = `
        <svg viewBox="0 0 ${svgW} ${svgH}" class="w-full h-36 overflow-visible">
          <defs>
            <linearGradient id="regLineAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#909CFC" stop-opacity="0.38" />
              <stop offset="100%" stop-color="#EE9DCB" stop-opacity="0.03" />
            </linearGradient>
            <linearGradient id="regLineStrokeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#909CFC" />
              <stop offset="100%" stop-color="#EE9DCB" />
            </linearGradient>
          </defs>

          <!-- Bandă verde orizontală pentru zona regulată (26 - 30 zile) -->
          <rect x="${padLeft - 6}" y="${y30}" width="${plotW + 12}" height="${Math.max(8, y26 - y30)}" rx="6" fill="#10B981" fill-opacity="0.12" />

          <!-- Linie punctată de referință la 28 zile -->
          <line x1="${padLeft - 6}" y1="${y28}" x2="${svgW - padRight + 6}" y2="${y28}" stroke="#7C3AED" stroke-width="1.2" stroke-dasharray="4 3" stroke-opacity="0.65" />
          <text x="2" y="${y28 + 3}" font-size="8.5" font-weight="700" fill="#7C3AED">28z</text>

          <!-- Arie și curbă cu animație de desenare SVG (#4) -->
          <path d="${areaD}" fill="url(#regLineAreaGrad)" class="animate-svg-area" />
          <path d="${pathD}" fill="none" stroke="url(#regLineStrokeGrad)" stroke-width="3" stroke-linecap="round" class="animate-svg-draw" />

          <!-- Puncte pentru fiecare ciclu -->
          ${nodesSvg}
        </svg>
      `;
    } else {
      // VARIANTA 3: Cadran Semicircular (Gauge / Vitezometru de Regularitate 18z – 28z – 38z)
      const activeItem = intervals.length > 0
        ? intervals[intervals.length - 1]
        : chartItems[chartItems.length - 1];
      const daysVal = activeItem ? activeItem.days : 28;
      const info = getStatusColorInfo(activeItem);

      // Mapăm 18..38 zile pe unghiul -90 deg (stânga) .. +90 deg (dreapta)
      const clampedDays = Math.min(38, Math.max(18, daysVal));
      const ratio = (clampedDays - 18) / (38 - 18); // 0..1
      const angleRad = Math.PI * (1 - ratio); // PI (stânga) -> 0 (dreapta)
      const cx = 140;
      const cy = 106;
      const r = 76;
      const dotX = (cx + r * Math.cos(angleRad)).toFixed(1);
      const dotY = (cy - r * Math.sin(angleRad)).toFixed(1);

      barsContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-1">
          <svg viewBox="0 0 280 125" class="w-64 h-28 overflow-visible">
            <!-- Arc Fundal Gri -->
            <path d="M 64 106 A 76 76 0 0 1 216 106" fill="none" stroke="#F1F5F9" stroke-width="16" stroke-linecap="round" />

            <!-- Zonă Mai Scurt (<26z: stânga, Galben/Amber) -->
            <path d="M 64 106 A 76 76 0 0 1 108 37" fill="none" stroke="#FBBF24" stroke-width="14" stroke-linecap="round" stroke-opacity="0.85" class="animate-svg-draw" />

            <!-- Zonă Regulată (26z - 30z: centru-sus, Verde Smarald) -->
            <path d="M 114 35 A 76 76 0 0 1 166 35" fill="none" stroke="#10B981" stroke-width="16" stroke-linecap="round" class="animate-svg-draw" />

            <!-- Zonă Mai Lung (>30z: dreapta, Roz/Roșu) -->
            <path d="M 172 37 A 76 76 0 0 1 216 106" fill="none" stroke="#FB7185" stroke-width="14" stroke-linecap="round" stroke-opacity="0.85" class="animate-svg-draw" />

            <!-- Indicator Punct pe Arc -->
            <g class="animate-node-pop" style="animation-delay: 260ms;">
              <circle cx="${dotX}" cy="${dotY}" r="11" fill="${info.hex}" fill-opacity="0.25" />
              <circle cx="${dotX}" cy="${dotY}" r="7" fill="${info.hex}" stroke="#FFFFFF" stroke-width="2.5" />
            </g>

            <!-- Etichete repere -->
            <text x="48" y="120" text-anchor="middle" font-size="9" font-weight="700" fill="#D97706">18z</text>
            <text x="140" y="18" text-anchor="middle" font-size="9.5" font-weight="800" fill="#059669">Ideal: 28z</text>
            <text x="232" y="120" text-anchor="middle" font-size="9" font-weight="700" fill="#E11D48">38z</text>

            <!-- Valoare Centrală -->
            <text x="140" y="88" text-anchor="middle" font-size="22" font-weight="800" fill="#1F2937">${daysVal} zile</text>
            <text x="140" y="105" text-anchor="middle" font-size="10" font-weight="700" fill="#6B7280">${activeItem.fromLabel} → ${activeItem.toLabel}</text>
          </svg>
          <span class="text-[11px] font-extrabold px-3 py-1 rounded-full ${info.badgeClass} mt-0.5">
            ${info.tagText}
          </span>
        </div>
      `;
    }

    // Listă istoric menstruații înregistrate (cu opțiune de ștergere individuală)
    if (dates.length > 0) {
      const titleEl = document.createElement('div');
      titleEl.className = 'text-[10px] font-bold text-gray-500 uppercase tracking-wider pt-1 flex items-center justify-between';
      titleEl.innerHTML = `<span>Menstruații înregistrate (${dates.length})</span><span>Interval</span>`;
      historyList.appendChild(titleEl);

      dates.slice().reverse().forEach((iso, revIdx) => {
        const origIdx = dates.length - 1 - revIdx;
        const dObj = parseDateISO(iso);
        const prevISO = origIdx > 0 ? dates[origIdx - 1] : null;
        let diffBadgeHtml = '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Primul ciclu înregistrat</span>';

        if (prevISO) {
          const prevObj = parseDateISO(prevISO);
          const diffDays = Math.round((dObj.getTime() - prevObj.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 26 && diffDays <= 30) {
            diffBadgeHtml = `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">La ${diffDays} zile (Regulat)</span>`;
          } else if (diffDays < 26) {
            diffBadgeHtml = `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">La ${diffDays} zile (Mai devreme)</span>`;
          } else {
            diffBadgeHtml = `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">La ${diffDays} zile (Mai târziu)</span>`;
          }
        }

        const row = document.createElement('div');
        row.className = 'flex items-center justify-between rounded-xl bg-white/80 border border-purple-100/80 px-3 py-2 text-xs';
        row.innerHTML = `
          <div class="flex items-center gap-2">
            <span>🩸</span>
            <span class="font-bold text-gray-800">${dObj.getDate()} ${MONTH_NAMES_RO[dObj.getMonth()]} ${dObj.getFullYear()}</span>
          </div>
          <div class="flex items-center gap-2">
            ${diffBadgeHtml}
            <button type="button" data-del-iso="${iso}" class="text-gray-400 hover:text-red-500 font-bold text-xs px-1" title="Șterge această dată">✕</button>
          </div>
        `;
        const delBtn = row.querySelector('[data-del-iso]');
        if (delBtn) {
          delBtn.addEventListener('click', () => {
            state.cycleHistory = (state.cycleHistory || []).filter(x => x !== iso);
            if (state.cycleStartDate === iso) {
              state.cycleStartDate = state.cycleHistory.length > 0 ? state.cycleHistory[state.cycleHistory.length - 1] : null;
              state.recordedCycles = state.cycleStartDate ? { [state.cycleStartDate]: state.cycleStartDate } : {};
            }
            saveState();
            renderAll();
          });
        }
        historyList.appendChild(row);
      });
    }
  }

  // Randare Grilă Calendar
  function renderCalendar() {
    const grid = document.getElementById('calendarDaysGrid');
    if (!grid) return;

    grid.innerHTML = '';

    const viewingMonthStartISO = getActiveCycleStartForMonth(state.calendarYear, state.calendarMonth);
    const calendarMonthStatusBadge = document.getElementById('calendarMonthStatusBadge');

    if (calendarMonthStatusBadge) {
      if (viewingMonthStartISO) {
        const sDate = parseDateISO(viewingMonthStartISO);
        const endDate = new Date(sDate);
        endDate.setDate(sDate.getDate() + CYCLE_LENGTH - 1);
        if (sDate.getMonth() === state.calendarMonth && sDate.getFullYear() === state.calendarYear) {
          calendarMonthStatusBadge.textContent = `Ciclu activ: Z1 pe ${sDate.getDate()} ${MONTH_NAMES_RO[sDate.getMonth()]}`;
        } else {
          calendarMonthStatusBadge.textContent = `Continuare ciclu (Z1: ${sDate.getDate()} ${MONTH_NAMES_RO[sDate.getMonth()].substring(0, 3)} → Z28: ${endDate.getDate()} ${MONTH_NAMES_RO[endDate.getMonth()].substring(0, 3)})`;
        }
        calendarMonthStatusBadge.style.color = '#A0356C';
      } else {
        calendarMonthStatusBadge.textContent = 'În așteptare: Click pe o zi = Ziua 1';
        calendarMonthStatusBadge.style.color = '#404CB0';
      }
    }

    const firstDayOfMonth = new Date(state.calendarYear, state.calendarMonth, 1);
    const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();

    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek < 0) startingDayOfWeek = 6;

    for (let i = 0; i < startingDayOfWeek; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'h-10';
      grid.appendChild(emptyCell);
    }

    const today = new Date();
    const todayISO = formatDateISO(today);

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const cellDate = new Date(state.calendarYear, state.calendarMonth, dayNum);
      const cellDateISO = formatDateISO(cellDate);
      const isToday = (cellDateISO === todayISO);

      const cycleDay = getCycleDayForDate(cellDate);
      const phase = getPhaseInfo(cycleDay);

      const dayBtn = document.createElement('button');
      dayBtn.type = 'button';
      dayBtn.className = 'h-10 w-full rounded-2xl flex flex-col items-center justify-center relative font-semibold text-xs transition transform active:scale-95';
      dayBtn.setAttribute('data-date', cellDateISO);
      dayBtn.setAttribute('title', `${dayNum} ${MONTH_NAMES_RO[state.calendarMonth]}: ${phase.name}`);

      const daySpan = document.createElement('span');
      daySpan.textContent = dayNum;
      dayBtn.appendChild(daySpan);

      if (cycleDay) {
        // Efect de cascadă / val pentru cele 28 de zile ale ciclului (#2)
        dayBtn.classList.add('animate-day-cascade');
        dayBtn.style.animationDelay = `${(cycleDay - 1) * 14}ms`;

        if (cycleDay >= 1 && cycleDay <= 5) {
          // Zilele 1–5: Menstruație (Galben #FCEF9F)
          dayBtn.style.backgroundColor = '#FCEF9F';
          dayBtn.style.color = '#78350F';
          dayBtn.classList.add('shadow-xs');

          if (cycleDay === 1) {
            dayBtn.classList.add('font-extrabold', 'animate-day1-pulse', 'z-10');
            const dropDot = document.createElement('span');
            dropDot.className = 'absolute top-0.5 right-1 text-[9px] pointer-events-none select-none animate-icon-float';
            dropDot.textContent = '🩸';
            dayBtn.appendChild(dropDot);
          }
        } else if (cycleDay >= 6 && cycleDay <= 8) {
          // Zilele 6–8: Următoarele 3 zile (Galben #FCEF9F)
          dayBtn.style.backgroundColor = '#FCEF9F';
          dayBtn.style.color = '#78350F';
        } else if (cycleDay >= 9 && cycleDay <= 20) {
          // Zilele 9–20: Cele 12 zile fertile (Roșu #EF4444 + bebeluș 👶 pe fiecare zi)
          dayBtn.style.backgroundColor = '#EF4444';
          dayBtn.style.color = '#FFFFFF';
          dayBtn.classList.add('shadow-xs', 'font-bold');

          const babyDot = document.createElement('span');
          babyDot.className = 'absolute top-0 right-0.5 text-[9px] leading-none pointer-events-none select-none animate-icon-float';
          babyDot.style.animationDelay = `${(cycleDay - 9) * 120}ms`;
          babyDot.textContent = '👶';
          dayBtn.appendChild(babyDot);
        } else {
          // Zilele 21–28: Ultimele 8 zile (Galben #FCEF9F)
          dayBtn.style.backgroundColor = '#FCEF9F';
          dayBtn.style.color = '#78350F';
        }
      } else {
        dayBtn.classList.add('hover:bg-purple-50', 'text-gray-700');
      }

      if (isToday) {
        const todayDot = document.createElement('span');
        todayDot.className = 'w-1 h-1 rounded-full bg-purple-600 absolute bottom-1';
        dayBtn.appendChild(todayDot);
      }

      dayBtn.addEventListener('click', () => {
        setCycleStartDate(cellDateISO);
        renderAll();
      });

      grid.appendChild(dayBtn);
    }
  }

  // Inițializare & Evenimente
  function init() {
    loadState();
    updateClock();
    setInterval(updateClock, 30000);

    // Activare vizualizare inițială
    switchView(state.activeView);

    // Tab Switching din Bottom Navigation Bar
    const navBtnTabCalendar = document.getElementById('navBtnTabCalendar');
    const navBtnTabDashboard = document.getElementById('navBtnTabDashboard');

    if (navBtnTabCalendar) {
      navBtnTabCalendar.addEventListener('click', () => switchView('calendar'));
    }
    if (navBtnTabDashboard) {
      navBtnTabDashboard.addEventListener('click', () => switchView('dashboard'));
    }

    // Comutator Stil Grafic Regularitate (Orizontal | Curbă | Cadran)
    document.querySelectorAll('.regChartModeBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosenMode = btn.getAttribute('data-chart-mode');
        if (chosenMode) {
          state.chartMode = chosenMode;
          saveState();
          renderRegularityChart();
        }
      });
    });

    // Butonul Principal de Declanșare Pagina 1
    const btnMainPeriodAction = document.getElementById('btnMainPeriodAction');
    if (btnMainPeriodAction) {
      btnMainPeriodAction.addEventListener('click', () => {
        const today = new Date();
        setCycleStartDate(formatDateISO(today));
        state.calendarYear = today.getFullYear();
        state.calendarMonth = today.getMonth();
        renderAll();
      });
    }

    // Navigare Luni
    const btnPrevMonth = document.getElementById('btnPrevMonth');
    const btnNextMonth = document.getElementById('btnNextMonth');
    const btnCurrentMonth = document.getElementById('btnCurrentMonth');

    if (btnPrevMonth) {
      btnPrevMonth.addEventListener('click', () => {
        state.calendarMonth--;
        if (state.calendarMonth < 0) {
          state.calendarMonth = 11;
          state.calendarYear--;
        }
        renderAll();
      });
    }

    if (btnNextMonth) {
      btnNextMonth.addEventListener('click', () => {
        state.calendarMonth++;
        if (state.calendarMonth > 11) {
          state.calendarMonth = 0;
          state.calendarYear++;
        }
        renderAll();
      });
    }

    if (btnCurrentMonth) {
      btnCurrentMonth.addEventListener('click', () => {
        const now = new Date();
        state.calendarYear = now.getFullYear();
        state.calendarMonth = now.getMonth();
        renderAll();
      });
    }

    // Modal Resetare Date (Modern Modal)
    const resetConfirmModal = document.getElementById('resetConfirmModal');
    const btnCancelReset = document.getElementById('btnCancelReset');
    const btnConfirmResetAction = document.getElementById('btnConfirmResetAction');

    const openResetModal = () => {
      if (resetConfirmModal && resetConfirmModal.showModal) {
        resetConfirmModal.showModal();
      }
    };

    document.querySelectorAll('.btnResetTrigger').forEach(btn => {
      btn.addEventListener('click', openResetModal);
    });

    const navBtnReset = document.getElementById('navBtnReset');
    if (navBtnReset) navBtnReset.addEventListener('click', openResetModal);

    if (btnCancelReset) {
      btnCancelReset.addEventListener('click', () => {
        if (resetConfirmModal) resetConfirmModal.close();
      });
    }

    if (btnConfirmResetAction) {
      btnConfirmResetAction.addEventListener('click', () => {
        state.cycleStartDate = null;
        state.recordedCycles = {};
        state.cycleHistory = [];
        localStorage.removeItem('auracycle_state');
        renderAll();
        if (resetConfirmModal) resetConfirmModal.close();
      });
    }

    // Modal Date Picker (Nav bar Tab 3: Alege data manual - Calendar Modern)
    const datePickerModal = document.getElementById('datePickerModal');
    const navBtnDateSelect = document.getElementById('navBtnDateSelect');
    const btnCloseDatePicker = document.getElementById('btnCloseDatePicker');
    const btnHeaderCloseDatePicker = document.getElementById('btnHeaderCloseDatePicker');
    const btnApplyCustomDate = document.getElementById('btnApplyCustomDate');
    const modalPickerPrevMonth = document.getElementById('modalPickerPrevMonth');
    const modalPickerNextMonth = document.getElementById('modalPickerNextMonth');
    const modalPickerTodayBtn = document.getElementById('modalPickerTodayBtn');

    let modalPickerYear = new Date().getFullYear();
    let modalPickerMonth = new Date().getMonth();
    let modalSelectedDateISO = null;

    function renderModalPicker() {
      const grid = document.getElementById('modalPickerGrid');
      const monthLabel = document.getElementById('modalPickerMonthLabel');
      const selectedLabel = document.getElementById('modalPickerSelectedLabel');
      if (!grid) return;

      monthLabel.textContent = `${MONTH_NAMES_RO[modalPickerMonth]} ${modalPickerYear}`;

      if (modalSelectedDateISO) {
        const sel = parseDateISO(modalSelectedDateISO);
        selectedLabel.textContent = `${sel.getDate()} ${MONTH_NAMES_RO[sel.getMonth()]} ${sel.getFullYear()}`;
      } else {
        selectedLabel.textContent = 'Alege o zi din grilă';
      }

      grid.innerHTML = '';

      const firstDay = new Date(modalPickerYear, modalPickerMonth, 1);
      const daysInMonth = new Date(modalPickerYear, modalPickerMonth + 1, 0).getDate();

      let startingDayOfWeek = firstDay.getDay() - 1;
      if (startingDayOfWeek < 0) startingDayOfWeek = 6;

      for (let i = 0; i < startingDayOfWeek; i++) {
        const empty = document.createElement('div');
        empty.className = 'h-9';
        grid.appendChild(empty);
      }

      const todayISO = formatDateISO(new Date());

      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(modalPickerYear, modalPickerMonth, day);
        const cellDateISO = formatDateISO(cellDate);
        const isSelected = (cellDateISO === modalSelectedDateISO);
        const isToday = (cellDateISO === todayISO);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'h-9 w-full rounded-xl flex flex-col items-center justify-center relative font-semibold text-xs transition transform active:scale-95';

        const span = document.createElement('span');
        span.textContent = day;
        btn.appendChild(span);

        if (isSelected) {
          btn.className += ' bg-gradient-to-tr from-[#EE9DCB] to-[#909CFC] text-white font-extrabold shadow-md scale-105 ring-2 ring-purple-300 ring-offset-1';
        } else {
          btn.className += ' text-gray-700 hover:bg-purple-100/60';
        }

        if (isToday && !isSelected) {
          const dot = document.createElement('span');
          dot.className = 'w-1.5 h-1.5 rounded-full bg-purple-600 absolute bottom-1';
          btn.appendChild(dot);
        }

        btn.addEventListener('click', () => {
          modalSelectedDateISO = cellDateISO;
          renderModalPicker();
        });

        grid.appendChild(btn);
      }
    }

    const openDatePicker = () => {
      const monthStartISO = getActiveCycleStartForMonth(state.calendarYear, state.calendarMonth);
      modalPickerYear = state.calendarYear;
      modalPickerMonth = state.calendarMonth;
      modalSelectedDateISO = monthStartISO || (state.cycleStartDate || formatDateISO(new Date()));
      renderModalPicker();
      if (datePickerModal.showModal) datePickerModal.showModal();
    };

    if (navBtnDateSelect) navBtnDateSelect.addEventListener('click', openDatePicker);

    if (modalPickerPrevMonth) {
      modalPickerPrevMonth.addEventListener('click', () => {
        modalPickerMonth--;
        if (modalPickerMonth < 0) {
          modalPickerMonth = 11;
          modalPickerYear--;
        }
        renderModalPicker();
      });
    }

    if (modalPickerNextMonth) {
      modalPickerNextMonth.addEventListener('click', () => {
        modalPickerMonth++;
        if (modalPickerMonth > 11) {
          modalPickerMonth = 0;
          modalPickerYear++;
        }
        renderModalPicker();
      });
    }

    if (modalPickerTodayBtn) {
      modalPickerTodayBtn.addEventListener('click', () => {
        const now = new Date();
        modalPickerYear = now.getFullYear();
        modalPickerMonth = now.getMonth();
        modalSelectedDateISO = formatDateISO(now);
        renderModalPicker();
      });
    }

    const closeDatePicker = () => {
      if (datePickerModal) datePickerModal.close();
    };

    if (btnCloseDatePicker) btnCloseDatePicker.addEventListener('click', closeDatePicker);
    if (btnHeaderCloseDatePicker) btnHeaderCloseDatePicker.addEventListener('click', closeDatePicker);

    if (btnApplyCustomDate) {
      btnApplyCustomDate.addEventListener('click', () => {
        if (modalSelectedDateISO) {
          setCycleStartDate(modalSelectedDateISO);
          const chosen = parseDateISO(modalSelectedDateISO);
          state.calendarYear = chosen.getFullYear();
          state.calendarMonth = chosen.getMonth();
          renderAll();
          closeDatePicker();
        }
      });
    }

    // Light dismiss fallback pentru dialog conform modern-web-guidance
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, dialog); });
        dialog.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e, dialog)) dialog.close(); });
      }
    }

    // Modal Informații
    const infoModal = document.getElementById('infoModal');
    const btnCloseInfoModal = document.getElementById('btnCloseInfoModal');
    const btnCloseInfoModalBottom = document.getElementById('btnCloseInfoModalBottom');

    document.querySelectorAll('.btnInfoTrigger').forEach(btn => {
      btn.addEventListener('click', () => {
        if (infoModal.showModal) infoModal.showModal();
      });
    });

    const closeInfo = () => infoModal.close();
    if (btnCloseInfoModal) btnCloseInfoModal.addEventListener('click', closeInfo);
    if (btnCloseInfoModalBottom) btnCloseInfoModalBottom.addEventListener('click', closeInfo);

    // Buton Refresh Aplicație (Header Pagina 1, Header Pagina 2 & NavBar)
    let pendingRemoteSignature = null;

    const performHardRefresh = async () => {
      if (pendingRemoteSignature) {
        localStorage.setItem('auracycle_accepted_signature', pendingRemoteSignature);
      }
      saveState();
      try {
        await Promise.allSettled([
          fetch('index.html', { cache: 'reload' }),
          fetch('app.js', { cache: 'reload' }),
          fetch('public/logo.png', { cache: 'reload' }),
          fetch('version.json', { cache: 'reload' })
        ]);
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        }
      } catch (_) {
        // continuăm cu reload-ul
      }
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.replace(url.toString());
    };

    document.querySelectorAll('.btnRefreshTrigger').forEach(btn => {
      btn.addEventListener('click', () => {
        const svg = btn.querySelector('svg');
        if (svg) {
          svg.classList.add('animate-spin');
        }
        setTimeout(performHardRefresh, 200);
      });
    });

    // Modal Notificare Update Aplicație (Verificare automată la deschidere, la revenirea în aplicație și periodic)
    const updateAvailableModal = document.getElementById('updateAvailableModal');
    const btnAcceptUpdateModal = document.getElementById('btnAcceptUpdateModal');
    const btnDismissUpdateModal = document.getElementById('btnDismissUpdateModal');
    const updateModalVersionBadge = document.getElementById('updateModalVersionBadge');
    const updateModalTitle = document.getElementById('updateModalTitle');
    const updateModalMessage = document.getElementById('updateModalMessage');
    const updateModalSpinner = document.getElementById('updateModalSpinner');

    let updateDismissedThisSession = false;

    if (btnDismissUpdateModal) {
      btnDismissUpdateModal.addEventListener('click', () => {
        updateDismissedThisSession = true;
        if (updateAvailableModal) updateAvailableModal.close();
      });
    }

    if (btnAcceptUpdateModal) {
      btnAcceptUpdateModal.addEventListener('click', () => {
        if (updateModalSpinner) {
          updateModalSpinner.classList.add('animate-spin');
        }
        setTimeout(performHardRefresh, 220);
      });
    }

    // Hash rapid (FNV-1a 32-bit) pentru a detecta automat orice modificare în index.html, app.js sau version.json
    function computeFastHash(str) {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0).toString(16);
    }

    async function checkForAppUpdate() {
      if (updateDismissedThisSession) return;
      try {
        const ts = Date.now();
        const [verRes, htmlRes, jsRes] = await Promise.all([
          fetch(`version.json?t=${ts}`, { cache: 'no-store' }),
          fetch(`index.html?t=${ts}`, { cache: 'no-store' }),
          fetch(`app.js?t=${ts}`, { cache: 'no-store' })
        ]);

        let verData = {
          version: '1.5.0',
          title: 'Actualizare Nouă Disponibilă ✨',
          message: 'Am adăugat îmbunătățiri noi în aplicație. Apasă pe butonul de mai jos pentru a actualiza aplicația fără a pierde datele tale salvate.'
        };

        if (verRes.ok) {
          try {
            verData = await verRes.json();
          } catch (_) {
            // păstrăm fallback-ul
          }
        }

        const htmlText = htmlRes.ok ? await htmlRes.text() : '';
        const jsText = jsRes.ok ? await jsRes.text() : '';
        const contentHash = computeFastHash(`${verData.version}|${htmlText}|${jsText}`);
        const remoteSignature = `${verData.version}-${contentHash}`;

        pendingRemoteSignature = remoteSignature;
        const acceptedSignature = localStorage.getItem('auracycle_accepted_signature');

        if (acceptedSignature !== remoteSignature) {
          if (updateModalVersionBadge && verData.version) {
            updateModalVersionBadge.textContent = `Versiunea ${verData.version}`;
          }
          if (updateModalTitle && verData.title) {
            updateModalTitle.textContent = verData.title;
          }
          if (updateModalMessage && verData.message) {
            updateModalMessage.textContent = verData.message;
          }
          if (updateAvailableModal && updateAvailableModal.showModal && !updateAvailableModal.open) {
            updateAvailableModal.showModal();
          }
        }
      } catch (err) {
        // Ignorăm erorile de rețea când dispozitivul este offline
      }
    }

    // Verificăm update-urile la pornire, când clienta revine în aplicație pe telefon și la fiecare 60 secunde
    setTimeout(checkForAppUpdate, 600);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForAppUpdate();
      }
    });
    setInterval(checkForAppUpdate, 60000);

    // Randare inițială
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

