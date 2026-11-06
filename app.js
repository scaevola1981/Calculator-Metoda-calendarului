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
      cycleHistory: state.cycleHistory
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

  // Comutare între Pagina 1 (Calendar) și Pagina 2 (Dashboard / Ceas)
  function switchView(viewName) {
    state.activeView = viewName;
    localStorage.setItem('auracycle_active_view', viewName);

    const view1 = document.getElementById('viewCalendar');
    const view2 = document.getElementById('viewDashboard');
    const ind1 = document.getElementById('navTabCalendarIndicator');
    const ind2 = document.getElementById('navTabDashboardIndicator');

    if (viewName === 'calendar') {
      view1.classList.remove('hidden');
      view2.classList.add('hidden');

      ind1.className = 'w-10 h-10 rounded-full bg-gradient-to-tr from-[#909CFC] to-[#EE9DCB] text-white flex items-center justify-center shadow-md';
      ind2.className = 'w-10 h-10 rounded-full flex items-center justify-center text-gray-500';
    } else {
      view1.classList.add('hidden');
      view2.classList.remove('hidden');

      ind1.className = 'w-10 h-10 rounded-full flex items-center justify-center text-gray-500';
      ind2.className = 'w-10 h-10 rounded-full bg-gradient-to-tr from-[#909CFC] to-[#EE9DCB] text-white flex items-center justify-center shadow-md';
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

    // 4. Pilule Verticale Proporționale (Evidențiere activă)
    ['Menstrual', 'Follicular', 'Fertile', 'Luteal'].forEach(pName => {
      const pill = document.getElementById(`pill${pName}`);
      if (pill) {
        const inner = pill.firstElementChild;
        if (currentCycleDay && currentPhase.id === pName.toLowerCase()) {
          inner.classList.add('ring-4', 'ring-[#909CFC]', 'ring-offset-2', 'shadow-md', '-translate-y-1');
        } else {
          inner.classList.remove('ring-4', 'ring-[#909CFC]', 'ring-offset-2', 'shadow-md', '-translate-y-1');
        }
      }
    });

    // 5. Carduri de Faze (Evidențiere activă)
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
          card.classList.add('ring-2', 'ring-[#909CFC]', 'ring-offset-2', 'shadow-md', 'scale-[1.01]');
        } else {
          card.classList.remove('ring-2', 'ring-[#909CFC]', 'ring-offset-2', 'shadow-md', 'scale-[1.01]');
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

    // Linie punctată orizontală pentru referința de 28 zile (înălțime max scalată la 40 zile)
    const maxScale = 40;
    const refBottomPct = Math.min(92, Math.max(15, Math.round((28 / maxScale) * 100)));
    const refLine = document.createElement('div');
    refLine.className = 'absolute left-0 right-0 border-t border-dashed border-purple-400/70 pointer-events-none z-0';
    refLine.style.bottom = `${refBottomPct}%`;
    barsContainer.appendChild(refLine);

    if (chartItems.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'w-full h-full flex items-center justify-center text-xs text-gray-400 font-medium text-center px-4';
      emptyMsg.textContent = 'Selectează data primei zile de menstruație în calendar pentru a vedea graficul regularității.';
      barsContainer.appendChild(emptyMsg);
      return;
    }

    chartItems.forEach((item) => {
      const col = document.createElement('div');
      col.className = 'flex-1 flex flex-col items-center justify-end h-full z-10 max-w-[68px]';

      const heightPct = Math.min(95, Math.max(22, Math.round((item.days / maxScale) * 100)));

      let barColorClass = 'bg-emerald-400 text-emerald-950 border border-emerald-500/30';
      if (item.isEstimated) {
        barColorClass = 'bg-purple-200/80 text-purple-900 border border-dashed border-purple-400';
      } else if (item.days < 26) {
        barColorClass = 'bg-amber-400 text-amber-950 border border-amber-500/30';
      } else if (item.days > 30) {
        barColorClass = 'bg-rose-400 text-white border border-rose-500/30';
      }

      const topBadge = document.createElement('span');
      topBadge.className = 'text-[10px] font-extrabold text-gray-800 mb-1 whitespace-nowrap';
      topBadge.textContent = item.isEstimated ? `${item.days}z (est.)` : `${item.days} zile`;

      const bar = document.createElement('div');
      bar.className = `w-full rounded-t-xl transition-all duration-500 flex items-center justify-center shadow-xs ${barColorClass}`;
      bar.style.height = `${heightPct}%`;

      const lbl = document.createElement('span');
      lbl.className = 'text-[9px] font-bold text-gray-600 mt-1.5 text-center leading-tight whitespace-nowrap';
      lbl.textContent = `${item.fromLabel} → ${item.toLabel}`;

      col.appendChild(topBadge);
      col.appendChild(bar);
      col.appendChild(lbl);
      barsContainer.appendChild(col);
    });

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
        if (cycleDay >= 1 && cycleDay <= 5) {
          // Zilele 1–5: Menstruație (Galben #FCEF9F)
          dayBtn.style.backgroundColor = '#FCEF9F';
          dayBtn.style.color = '#78350F';
          dayBtn.classList.add('shadow-xs');

          if (cycleDay === 1) {
            dayBtn.classList.add('ring-2', 'ring-offset-1', 'ring-[#F59E0B]', 'font-bold');
            const dropDot = document.createElement('span');
            dropDot.className = 'absolute top-0.5 right-1 text-[9px] pointer-events-none select-none';
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
          babyDot.className = 'absolute top-0 right-0.5 text-[9px] leading-none pointer-events-none select-none';
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

    const performHardRefresh = () => {
      if (pendingRemoteSignature) {
        localStorage.setItem('auracycle_accepted_signature', pendingRemoteSignature);
      }
      saveState();
      const reloadWithCacheBuster = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('v', Date.now().toString());
        window.location.replace(url.toString());
      };
      if ('caches' in window) {
        caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))).finally(reloadWithCacheBuster);
      } else {
        reloadWithCacheBuster();
      }
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

