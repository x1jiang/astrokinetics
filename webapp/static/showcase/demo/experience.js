/* ASTRA guided demo — simulated iPhone + Apple Watch. No dependencies.
   Fictional astronaut, illustrative values and rules (drafted with AI assistance). Not clinical guidance. */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var xp = $('#xp'), phV = $('#phV'), xw = $('#xw'), xwS = $('#xwS'), xlink = $('#xlink');
  var cNext = $('#cNext'), cAuto = $('#cAuto'), coachEl = $('.coach');
  var S = { i: 0, act: null, pick: null, auto: false, flow: null, answers: {}, q: 0, prevMode: 'earth' };
  var timers = [], liveTimer = null;

  function T(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearAll() { timers.forEach(clearTimeout); timers = []; stopLive(); }
  function noise(i) { var x = Math.sin(i * 12.9898) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }

  /* ---------- Device + coach helpers ---------- */
  function phone(html, tab) {
    var old = $('.scr:not(.leave)', phV), n = document.createElement('div');
    n.className = 'scr enter'; n.innerHTML = html; phV.appendChild(n);
    void n.offsetWidth; n.classList.remove('enter');
    if (old) { old.classList.add('leave'); setTimeout(function () { old.remove(); }, 650); }
    $$('.ph-tabs span').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === tab); });
    return n;
  }
  function watch(html, buzz) {
    xwS.innerHTML = '<div class="xw-in">' + html + '</div>';
    if (buzz) { xw.classList.remove('buzz'); void xw.offsetWidth; xw.classList.add('buzz'); }
  }
  function coach(k, t, b) {
    $('#cK').textContent = k; $('#cT').textContent = t; $('#cB').textContent = b;
    coachEl.classList.remove('swap'); void coachEl.offsetWidth; coachEl.classList.add('swap');
  }
  function ready(label, fn) {
    S.act = fn; cNext.disabled = false; cNext.textContent = label + ' →';
    if (S.auto) { T(function () { if (S.auto && S.act === fn) trigger(); }, 1900); }
  }
  function busy(label) { S.act = null; cNext.disabled = true; cNext.textContent = label; }
  function trigger() { if (S.act) { var a = S.act; S.act = null; a(); } }
  function head(k, t, sub) { return '<span class="s-k">' + k + '</span><p class="s-t">' + t + '</p>' + (sub ? '<p class="s-sub">' + sub + '</p>' : ''); }
  function cta(label) { return '<button class="cta hot" data-go type="button">' + label + '</button>'; }
  function tile(label, value, unit, state, cls, live) {
    return '<div class="tile ' + (cls || '') + '"><span class="tl">' + label + '</span><span class="tv"><span' + (live ? ' data-live="hr"' : '') + '>' + value + '</span> <small>' + unit + '</small></span><span class="ts">' + state + '</span></div>';
  }

  /* ---------- Live heart rate: Watch first, phone a moment later ---------- */
  function startLive(base) {
    stopLive(); xlink.classList.add('on'); var n = 0;
    function tick() {
      var v = base + Math.round(noise(++n + base) * 2);
      $$('[data-live="hr"]', xwS).forEach(function (e) { e.textContent = v; });
      setTimeout(function () { $$('[data-live="hr"]', phV).forEach(function (e) { e.textContent = v; }); }, 380);
    }
    tick(); liveTimer = setInterval(tick, 900);
  }
  function stopLive() { clearInterval(liveTimer); liveTimer = null; xlink.classList.remove('on'); }
  var WAVE = '<svg class="wave" viewBox="0 0 150 30"><polyline points="0,18 22,18 28,18 32,8 36,26 40,3 45,22 50,18 80,18 86,18 90,8 94,26 98,3 103,22 108,18 150,18"/></svg>';
  function watchMeasuring(base) { watch('<span class="heart">♥</span><span class="xw-big" data-live="hr">' + base + '</span><span class="xw-k">BPM · measuring</span>' + WAVE); }

  /* ---------- Assessment content (illustrative rules) ---------- */
  var FLOWS = {
    face: {
      label: 'My face feels puffy',
      questions: [
        { id: 'since', text: 'When did you notice it?', options: [['today', 'Since waking today'], ['days', 'It has built up over several days']] },
        { id: 'vision', text: 'Any change in your vision?', auto: 1, options: [['no', 'No change'], ['yes', 'Yes, near vision is blurrier']] }
      ],
      exam: [
        { src: 'WATCH', name: 'Heart rate and blood oxygen', val: '64 bpm · 97%', q: 'Good signal' },
        { src: 'WATCH', name: 'Wrist temperature, last sleep', val: '+0.1 °C vs. your usual', q: 'Good signal' },
        { src: 'IPHONE', name: 'Guided face photo vs. your reference', val: 'Captured for side-by-side review', q: 'Retaken once: low light', warn: true, photo: true },
        { src: 'IPHONE', name: 'Near-vision reading check', val: 'Compared with pre-flight result', q: 'Completed' }
      ],
      causes: function (a) {
        return [
          { name: 'Headward fluid shift', score: a.vision === 'yes' ? 60 : 85, why: 'Body fluid moves toward the head in microgravity. Facial puffiness is commonly reported, most of all early in a mission.', src: 'NASA Human Research Program · fluid shifts' },
          { name: 'Eye changes that need review', score: a.vision === 'yes' ? 80 : 25, why: a.vision === 'yes' ? 'A near-vision change together with fluid shift is the pattern screened for in SANS.' : 'No vision change reported. Still tracked, because it can develop slowly.', src: 'NASA HRP · Risk of Spaceflight Associated Neuro-ocular Syndrome' },
          { name: 'Local or allergic reaction', score: a.since === 'today' ? 30 : 12, why: 'Less consistent: temperature and heart rate are in range and no skin change was reported.', src: 'ASTRA rule table v0.1' }
        ];
      },
      next: function (a) { return a.vision === 'yes' ? 'Flag this episode for flight surgeon review. Repeat the near-vision check and face photo in 24 hours.' : 'Repeat the guided face photo in 24 hours. The episode stays open until the follow-up is done.'; },
      ask: 'Why does my face feel puffy up here?',
      answer: function (a) {
        return 'Without gravity pulling fluid toward your legs, more of it stays in your upper body and head. Crews often describe a puffy face and a stuffy nose, mostly in the first weeks [1]. Your heart rate, oxygen and temperature are inside your orbit range, which fits that picture. ' +
          (a.vision === 'yes' ? 'Because you reported blurrier near vision, I have flagged this for review: vision changes are followed closely on long missions [2].' : 'You reported no change in vision. I will keep asking, because eye changes can develop slowly [2].');
      },
      cites: ['NASA Human Research Program · fluid shifts', 'NASA HRP · Risk of SANS']
    },
    head: {
      label: 'I have a headache',
      questions: [
        { id: 'sleep', text: 'How did you sleep?', auto: 1, options: [['ok', 'About as usual'], ['bad', 'Short or broken sleep']] },
        { id: 'nose', text: 'Is your nose congested?', options: [['no', 'No'], ['yes', 'Yes']] }
      ],
      exam: [
        { src: 'WATCH', name: 'Sleep duration and stages', val: 'Read from last night', q: 'Good signal' },
        { src: 'WATCH', name: 'Heart rate and blood oxygen', val: '66 bpm · 96%', q: 'Good signal' },
        { src: 'IPHONE', name: 'Reaction-time test, 3 minutes', val: 'Compared with your own average', q: 'Completed' },
        { src: 'CABIN', name: 'Cabin CO₂ level', val: 'Not available to ASTRA', q: 'Missing: ask crew to read it', warn: true }
      ],
      causes: function (a) {
        return [
          { name: 'Congestion from fluid shift', score: a.nose === 'yes' ? 80 : 35, why: 'Fluid moving toward the head often brings nasal congestion and a feeling of pressure.', src: 'NASA Human Research Program · fluid shifts' },
          { name: 'Sleep loss', score: a.sleep === 'bad' ? 78 : 25, why: a.sleep === 'bad' ? 'Reported poor sleep matches the Watch sleep record.' : 'Sleep looks close to this astronaut\'s usual pattern.', src: 'NASA DSO 484 circadian data' },
          { name: 'Raised cabin CO₂', score: 45, why: 'Cannot be ranked properly: the cabin reading is missing. ASTRA says so instead of assuming it is normal.', src: 'Station environment data, not yet connected' }
        ];
      },
      next: function () { return 'Read the cabin CO₂ value and enter it. Re-check symptoms in 2 hours; the task stays pending until then.'; },
      ask: 'Why would I get a headache up here?',
      answer: function (a) {
        return (a.nose === 'yes' ? 'You reported a blocked nose, which crews often get when fluid moves toward the head [1]. ' : 'You reported no congestion, so fluid shift is a weaker fit today [1]. ') +
          (a.sleep === 'bad' ? 'Your Watch shows a short night, and that matches what you told me [2]. ' : 'Your sleep looks close to your usual, so that is less likely [2]. ') +
          'I could not read the cabin CO₂ level, so I have neither ruled it in nor out. Please enter it when you can.';
      },
      cites: ['NASA Human Research Program · fluid shifts', 'NASA DSO 484 circadian data']
    },
    tired: {
      label: 'I am unusually tired',
      questions: [
        { id: 'days', text: 'For how long?', auto: 1, options: [['one', 'Just today'], ['many', 'Three days or more']] },
        { id: 'load', text: 'Was yesterday a heavy workload or exercise day?', options: [['yes', 'Yes'], ['no', 'No']] }
      ],
      exam: [
        { src: 'WATCH', name: 'Sleep over the last 7 nights', val: 'Shorter than your usual', q: 'Good signal' },
        { src: 'WATCH', name: 'Heart rate variability', val: '41 ms · below your orbit range', q: 'Good signal' },
        { src: 'IPHONE', name: 'Reaction-time test, 3 minutes', val: 'Slower than your own average', q: 'Completed' },
        { src: 'IPHONE', name: 'Voice sample, 20 seconds', val: 'Stored for comparison', q: 'Research signal: not ranked', warn: true }
      ],
      causes: function (a) {
        return [
          { name: 'Accumulated sleep debt', score: a.days === 'many' ? 85 : 50, why: 'Several short nights in the Watch record, with slower reaction time than this astronaut\'s own average.', src: 'NASA DSO 484 circadian data' },
          { name: 'Recovery after heavy workload', score: a.load === 'yes' ? 75 : 20, why: a.load === 'yes' ? 'Lower heart rate variability the day after hard work fits normal recovery.' : 'No heavy workload reported, so this fits less well.', src: 'ASTRA rule table v0.1' },
          { name: 'Early illness', score: a.days === 'many' ? 40 : 25, why: 'Wrist temperature is in range. Kept on the list because fatigue is non-specific.', src: 'ASTRA rule table v0.1' }
        ];
      },
      next: function (a) { return a.days === 'many' ? 'Send the 7-night sleep summary for review and repeat the reaction test tomorrow morning.' : 'Repeat the reaction test tomorrow morning. If it is still slow, the episode is escalated for review.'; },
      ask: 'Why am I this tired?',
      answer: function (a) {
        return 'Your last nights were shorter than your usual and your reaction test was slower than your own average, which points to sleep debt [1]. ' +
          (a.load === 'yes' ? 'Yesterday\'s workload fits too: lower heart rate variability the next day is a normal recovery sign [2]. ' : '') +
          'Your temperature is in range, so early illness is less likely, but I am keeping it on the list.';
      },
      cites: ['NASA DSO 484 circadian data', 'ASTRA rule table v0.1']
    }
  };

  /* ---------- The journey ---------- */
  var steps = [
    function welcome() {
      coach('1 · On the ground', 'Meet ASTRA.', 'The story starts months before launch. The astronaut installs the app and wears the Watch like any other day.');
      phone('<div class="splash"><span class="logo">ASTRA</span><p class="s-sub">Know your normal.</p></div>' + cta('Begin setup'), '');
      watch('<span class="xw-k">Mon 14</span><span class="xw-big">9:41</span><span class="xw-s">Ready to pair</span>');
      ready('Begin setup', next);
    },
    function pair() {
      coach('2 · Pairing', 'Two devices, one record.', 'The Watch brings ten of the sixteen measures in every daily check. The iPhone keeps the record, runs three short tests and asks three questions.');
      var perms = ['Resting heart rate', 'Heart rate variability', 'Blood oxygen', 'Breathing rate, asleep', 'Wrist temperature', 'Sleep', 'Deep sleep', 'Cardio recovery', 'Exercise', 'Ambient noise'];
      var n = phone(head('Setup · 1 of 2', 'Pair your Apple Watch', 'Keep it close to the phone.') + '<div class="card mlist" id="perms">' + perms.map(function (p) { return '<span class="perm">' + p + '</span>'; }).join('') + '</div>', 'profile');
      watch('<div class="spin"></div><span class="xw-s">Pairing…</span>'); busy('Pairing…');
      T(function () {
        watch('<span class="xw-pill">Connected</span><span class="xw-s">ASTRA can read<br><b>10 measures</b></span>'); xlink.classList.add('on');
        $$('.perm', n).forEach(function (p, i) { T(function () { p.classList.add('ok'); }, 250 + i * 230); });
        T(function () {
          xlink.classList.remove('on');
          n.insertAdjacentHTML('beforeend', '<div class="card fade mlist"><div class="row"><span>iPhone tests</span><b>Reaction time, near vision, hand tremor</b></div><div class="row"><span>Questions</span><b>Symptoms, sleep quality, mood</b></div></div>' + cta('Continue'));
          ready('Continue', next);
        }, 250 + perms.length * 230 + 300);
      }, 1700);
    },
    function profile() {
      coach('3 · Profile', 'Context comes first.', 'Age, sex and mission plan change what a normal reading looks like, so ASTRA asks before it measures anything.');
      phone(head('Setup · 2 of 2', 'About you', 'Mission profile.') +
        '<div class="card"><div class="row"><span>Name</span><b>Cmdr. Maya Ortiz</b></div><div class="row"><span>Age</span><b>38</b></div><div class="row"><span>Sex</span><b>Female</b></div><div class="row"><span>Mission</span><b>ISS · 180 days</b></div><div class="row"><span>Launch</span><b>In 21 days</b></div></div>' + cta('Looks right'), 'profile');
      watch('<span class="xw-k">Welcome</span><span class="xw-s"><b>Cmdr. Ortiz</b></span><span class="xw-s">Launch in 21 days</span>');
      ready('Looks right', next);
    },
    function checkIntro() {
      coach('4 · Daily check', 'Sixteen measures, two minutes.', 'A short check each morning is all the baseline needs. The Watch brings ten measures, the iPhone runs three short tests, and she answers three questions.');
      phone(head('Day 1 of 14', 'Daily check', 'Sit still and keep your wrist relaxed. It takes about two minutes.') +
        '<div class="card"><div class="row"><span>Apple Watch</span><b>10 measures</b></div><div class="row"><span>iPhone tests</span><b>3 measures</b></div><div class="row"><span>Questions</span><b>3 answers</b></div></div>' + cta('Start check'), 'check');
      watch('<span class="xw-k">Daily check</span><span class="xw-s">Ready when<br>you are</span>');
      ready('Start check', measure);
    },
    function baseline() {
      coach('5 · Fourteen days later', 'Now it knows her normal.', 'Each check becomes one snapshot of her that day: 16 measures folded into one point. Fourteen snapshots draw a baseline that belongs to this astronaut, not to an average person.');
      var C = [0.34, 0.22, -0.1, -0.17, 0.64, 0.1, -0.17, 0.24, 0.23, 0.31, 0.14, 0.35, 0.36, -0.19], dots = '', path = '';
      for (var i = 0; i < 14; i++) {
        var x = 16 + i * 17.6, y = (60 - C[i] * 34).toFixed(1);
        dots += '<circle class="md" r="4" cx="' + x + '" cy="' + y + '" style="animation-delay:' + (i * 190) + 'ms"/>'; path += (i ? ' L' : 'M') + x + ' ' + y;
      }
      var n = phone(head('Pre-flight', 'Your baseline', 'One snapshot per day, 16 measures each.') +
        '<div class="card"><svg class="mini" viewBox="0 0 280 120"><rect class="mb" x="6" y="22.6" width="268" height="74.8" rx="5"/><line x1="6" x2="274" y1="60" y2="60" stroke-dasharray="3 5"/><path class="mp" d="' + path + '"/>' + dots + '</svg></div>', 'history');
      watch('<div class="spin"></div><span class="xw-s">Learning…</span>'); busy('Building baseline…');
      T(function () {
        n.insertAdjacentHTML('beforeend', '<div class="card fade"><div class="row"><span>Resting heart rate</span><b>50–60 bpm</b></div><div class="row"><span>Heart rate variability</span><b>52–74 ms</b></div><div class="row"><span>Blood oxygen</span><b>96–99 %</b></div><div class="row"><span>13 more signals</span><b>Ranges set</b></div></div><div class="banner">Baseline ready · 224 readings</div>' + cta('Continue'));
        watch('<span class="xw-pill">Baseline ready</span><span class="xw-s">14 days<br><b>224 readings</b></span>');
        ready('Continue', next);
      }, 3600);
    },
    function launch() {
      coach('6 · Launch day', 'Flip to Orbit mode.', 'Her body is about to change, and ASTRA expects it. One switch moves the baseline and all 16 ranges to what ASTRA expects in flight.');
      phone(head('Launch day', 'You are leaving Earth', 'Tell ASTRA, so it can adjust what it expects from your body.') +
        '<div class="card"><div class="tog"><b>Orbit mode</b><span class="tog-sw" id="togSw"></span></div></div>' +
        '<div class="card"><div class="row"><span>Your normal</span><b id="r0">Earth baseline</b></div><div class="row"><span>Resting heart rate</span><b id="r1">50–60 bpm</b></div><div class="row"><span>Heart rate variability</span><b id="r2">52–74 ms</b></div><div class="row"><span>Blood oxygen</span><b id="r3">96–99 %</b></div><div class="row" id="rp" hidden><span>Steps and gait</span><b>Paused in orbit</b></div></div>' +
        '<button class="cta hot" data-go type="button" id="launchCta">Switch to Orbit mode</button>', 'profile');
      watch('<span class="xw-k">T-minus</span><span class="xw-big">0:10</span><span class="xw-s">Earth mode</span>');
      ready('Switch to Orbit mode', function () {
        $('#togSw').classList.add('on'); window.ASTRA.setMode('orbit'); $('#phMode').textContent = 'ORBIT';
        [['r0', 'Orbit baseline'], ['r1', '53–70 bpm'], ['r2', '44–74 ms'], ['r3', '95–99 %']].forEach(function (r, i) { T(function () { var e = $('#' + r[0]); e.textContent = r[1]; e.classList.add('flash'); }, 500 + i * 260); });
        T(function () { $('#rp').hidden = false; }, 1400);
        watch('<div class="orbit-ring"></div><span class="xw-k">Orbit mode</span><span class="xw-s">Ranges adjusted</span>', true);
        $('#launchCta').textContent = 'Continue'; busy('Adjusting…');
        T(function () { ready('Continue', next); }, 1700);
      });
    },
    function alertDay() {
      coach('7 · Mission day 12', 'Something drifts.', 'ASTRA has been quiet for eleven days. This morning the snapshot falls outside her orbit normal, so the Watch taps her wrist and the phone shows which measures moved it.');
      phone(head('Mission day 12', 'Today', '<span class="live-dot"></span>Live from Watch') +
        '<div class="flagcard"><b>Snapshot outside your normal</b>2 of 16 measures moved it. How are you feeling?</div>' +
        '<div class="card mlist">' + DAY12.map(function (m) { return '<div class="row' + (m[2] ? ' out' : '') + '"><span>' + m[0] + '</span><b>' + m[1] + '</b></div>'; }).join('') + '</div>' + cta('I feel unwell'), 'today');
      watch('<span class="xw-pill warn">Check in</span><span class="xw-s"><b>Snapshot</b><br>outside your normal</span><span class="xw-k">2 of 16 measures</span>', true);
      startLive(63); ready('I feel unwell', function () { stopLive(); next(); });
    },
    function symptoms() {
      coach('8 · Assessment', 'She says what she feels.', 'Pick any symptom. ASTRA follows an open rule table to decide what to ask and what to measure, the way a flight surgeon would.');
      phone(head('Assessment', 'What is bothering you?', 'Choose one to begin.') +
        Object.keys(FLOWS).map(function (k) { return '<button class="opt" data-pick="' + k + '" type="button">' + FLOWS[k].label + '</button>'; }).join(''), 'check');
      watch('<span class="xw-k">Assessment</span><span class="xw-s">Answer on<br>your iPhone</span>');
      S.pick = function (v) { S.flow = FLOWS[v]; S.answers = {}; S.q = 0; next(); };
      ready('Choose "puffy face"', function () { S.pick('face'); });
    },
    function question() {
      var q = S.flow.questions[S.q];
      coach('9 · Guided questions', 'Only what it needs to know.', 'Each answer narrows the next question. Nothing is asked for the sake of asking.');
      phone(head('Question ' + (S.q + 1) + ' of ' + S.flow.questions.length, q.text) +
        q.options.map(function (o) { return '<button class="opt" data-pick="' + o[0] + '" type="button">' + o[1] + '</button>'; }).join(''), 'check');
      S.pick = function (v) {
        S.answers[q.id] = v;
        if (S.q + 1 < S.flow.questions.length) { S.q++; go(S.i); } else next();
      };
      ready('Answer', function () { S.pick(q.options[q.auto || 0][0]); });
    },
    function exam() {
      coach('10 · Targeted exam', 'Then it measures.', 'The Watch and the phone run only the checks that matter for this symptom, one at a time. Every result keeps its source and quality, and a missing one is shown as missing.');
      var ex = S.flow.exam, at = 400;
      var n = phone(head('Exam', 'Running the checks', 'One at a time.') + '<div class="exam">' + ex.map(function (s) {
        return '<div class="exam-row"><div class="top"><span>' + s.name + '</span><span class="src">' + s.src + '</span></div><div class="prog"><i></i></div><div class="top"><span class="val"></span><span class="q' + (s.warn ? ' warn' : '') + '"></span></div></div>';
      }).join('') + '</div><div id="finderSlot"></div>', 'check');
      startLive(64); busy('Measuring…');
      $$('.exam-row', n).forEach(function (row, i) {
        var s = ex[i], dur = s.photo ? 6400 : 2400, t0 = at; at += dur;
        T(function () {
          var bar = $('.prog i', row); bar.style.transition = 'width ' + ((s.photo ? 3600 : dur - 500) / 1000) + 's linear'; bar.style.width = '100%';
          watch('<span class="xw-k">' + (i + 1) + ' of ' + ex.length + ' · ' + s.src + '</span><span class="xw-s">' + s.name + '</span><div class="spin"></div>');
          if (!s.photo) return;
          // The guided photo gets its own moment: frame, hold, capture, then today beside the reference.
          coach('10 · Guided photo', 'A photo she can compare.', 'The phone guides the framing so today’s photo matches the reference taken before flight. ASTRA does not read the face: a person compares the two pictures side by side.');
          var slot = $('#finderSlot', n);
          slot.innerHTML = '<div class="finder big"><span>ALIGN YOUR FACE IN THE OVAL</span></div>'; n.scrollTop = n.scrollHeight;
          T(function () { $('span', slot).textContent = 'HOLD STILL'; }, 1500);
          T(function () { $('span', slot).textContent = 'CAPTURED'; $('.finder', slot).classList.add('done'); }, 3000);
          T(function () { slot.innerHTML = '<div class="cmp fade"><div><span>REFERENCE</span></div><div><span>TODAY</span></div></div>'; n.scrollTop = n.scrollHeight; }, 3900);
        }, t0);
        T(function () { $('.val', row).textContent = s.val; $('.q', row).textContent = s.q; }, t0 + (s.photo ? 3700 : dur - 400));
      });
      T(function () { stopLive(); watch('<span class="xw-pill">Exam complete</span><span class="xw-s">' + ex.length + ' checks sent</span>'); }, at + 100);
      T(next, at + 1300);
    },
    function result() {
      coach('11 · Result', 'Possible causes, with evidence.', 'ASTRA does not hand down a diagnosis. It ranks what fits her answers and readings, shows where each idea comes from, and says what to do next.');
      var causes = S.flow.causes(S.answers).sort(function (a, b) { return b.score - a.score; });
      var n = phone(head('Result · not a diagnosis', 'Possible causes', 'Ordered by how well each fits.') + causes.map(function (c) {
        return '<div class="cause"><b>' + c.name + '</b><div class="meter"><i data-w="' + c.score + '"></i></div><span class="why">' + c.why + '</span><span class="srcline">' + c.src + '</span></div>';
      }).join('') + '<div class="next"><b>Next step</b>' + S.flow.next(S.answers) + '</div>' + cta('Ask ASTRA why'), 'check');
      T(function () { $$('.meter i', n).forEach(function (m) { m.style.width = m.dataset.w + '%'; }); }, 500);
      watch('<span class="xw-k">Result ready</span><span class="xw-s"><b>3 possible causes</b><br>See iPhone</span>', true);
      ready('Ask ASTRA why', next);
    },
    function assistant() {
      coach('12 · Ask ASTRA', 'An explanation she can check.', 'The assistant answers in plain words and points to its sources. It is designed to run on an on-board server, with no link to Earth.');
      var n = phone(head('Assistant', 'Ask ASTRA') + '<div class="bub me">' + S.flow.ask + '</div><div class="bub ai" id="aiB"></div><div class="cites" id="aiC"></div>', 'today');
      watch('<div class="spin"></div><span class="xw-k">On-board server</span><span class="xw-s">Answering…</span>'); busy('ASTRA is answering…');
      var words = S.flow.answer(S.answers).split(' '), out = $('#aiB', n), k = 0;
      (function type() {
        if (k >= words.length) {
          S.flow.cites.forEach(function (c, i) { T(function () { $('#aiC', n).insertAdjacentHTML('beforeend', '<span class="cite"><b>[' + (i + 1) + ']</b> ' + c + '</span>'); n.scrollTop = n.scrollHeight; }, 250 + i * 300); });
          T(function () { n.insertAdjacentHTML('beforeend', cta('See follow-up')); n.scrollTop = n.scrollHeight; watch('<span class="xw-pill">Answered</span><span class="xw-s">2 sources cited</span>'); ready('See follow-up', next); }, 1100);
          return;
        }
        out.innerHTML += (k ? ' ' : '') + words[k++].replace(/\[(\d)\]/, '<sup>[$1]</sup>'); n.scrollTop = n.scrollHeight; T(type, 42);
      })();
    },
    function episode() {
      coach('13 · Follow-up', 'Nothing gets lost.', 'Everything from this morning lives in one episode. It stays open until the follow-up is done and someone has reviewed it. Dismissing a reminder does not close it.');
      var items = [['Reported: ' + S.flow.label.toLowerCase(), 'Mission day 12 · 07:42'], ['Exam completed', S.flow.exam.length + ' checks, quality recorded'], ['Possible causes ranked', 'ASTRA rule table v0.1'], ['Follow-up check', 'Tomorrow 08:00 · pending', 1], ['Review by flight surgeon', 'Queued for next contact · pending', 1]];
      phone(head('Episode · open', 'Follow-up', 'One record from first report to closure.') + '<div class="card"><ul class="tl-list">' + items.map(function (it, i) {
        return '<li class="' + (it[2] ? 'pend' : '') + '" style="animation-delay:' + (300 + i * 260) + 'ms">' + it[0] + '<small>' + it[1] + '</small></li>';
      }).join('') + '</ul></div>' + cta('Finish'), 'history');
      watch('<span class="xw-k">Reminder set</span><span class="xw-big" style="font-size:3.6em">08:00</span><span class="xw-s">Tomorrow<br><b>Repeat check</b></span>', true);
      ready('Finish', next);
    },
    function end() {
      coach('That is ASTRA', 'From a feeling to a plan.', 'A personal baseline, an orbit-aware range, a guided exam, an explanation with sources and a follow-up that stays open. All designed for two devices.');
      phone('<div class="splash"><span class="logo">ASTRA</span><p class="s-sub">Your normal changes when you leave Earth.<br>ASTRA keeps up.</p></div><button class="opt" data-replay type="button" style="text-align:center">Replay the demo</button>' + cta('Back to the journey'), '');
      watch('<span class="xw-k">Mission day 12</span><span class="xw-big">9:44</span><span class="xw-pill">All recorded</span>');
      if (S.auto) toggleAuto();
      ready('Back to the journey', close);
    }
  ];

  var DAY1 = [['Resting heart rate', '58 bpm'], ['Heart rate variability', '66 ms'], ['Blood oxygen', '97 %'], ['Breathing rate, asleep', '15.6/min'], ['Wrist temperature', '−0.1 °C'], ['Sleep', '6.7 h'], ['Deep sleep', '72 min'], ['Cardio recovery', '34 bpm'], ['Exercise', '97 min'], ['Ambient noise', '54 dB'], ['Reaction time', '278 ms'], ['Near vision', '0.02 logMAR'], ['Hand tremor', '0.10 m/s²'], ['Symptoms', '1/10'], ['Sleep quality', '4/5'], ['Mood', '4/5']];
  var DAY12 = [['Resting heart rate', '63 bpm'], ['Heart rate variability', '41 ms', 1], ['Blood oxygen', '97 %'], ['Breathing rate, asleep', '14.8/min'], ['Wrist temperature', '+0.1 °C'], ['Sleep', '5.7 h', 1], ['Deep sleep', '55 min'], ['Cardio recovery', '30 bpm'], ['Exercise', '92 min'], ['Ambient noise', '60 dB'], ['Reaction time', '281 ms'], ['Near vision', '0.04 logMAR'], ['Hand tremor', '0.12 m/s²'], ['Symptoms', '2/10'], ['Sleep quality', '3/5'], ['Mood', '4/5']];
  function measure() {
    coach('4 · Daily check', 'One check, sixteen measures.', 'Each measure reaches the phone as it is taken: ten from the Watch, three from iPhone tests, three from her answers. Every value is saved with its time, unit, source and quality.');
    var n = phone(head('Day 1 of 14', 'Measuring…', '<span class="live-dot"></span>Live from Watch') +
      '<div class="card mlist">' + DAY1.map(function (m) { return '<div class="row off"><span>' + m[0] + '</span><b>·</b></div>'; }).join('') + '</div><div class="pbar"><i id="pb"></i></div>', 'check');
    xlink.classList.add('on'); busy('Measuring…');
    var pb = $('#pb', n), rows = $$('.mlist .row', n), stepMs = 400;
    pb.style.transition = 'width ' + (16 * stepMs / 1000) + 's linear'; T(function () { pb.style.width = '100%'; }, 60);
    DAY1.forEach(function (m, i) {
      T(function () {
        var src = i < 10 ? 'Apple Watch' : i < 13 ? 'iPhone test' : 'Question';
        watch('<span class="xw-k">' + (i + 1) + ' of 16 · ' + src + '</span><span class="xw-s">' + m[0] + '</span><span class="xw-big" style="font-size:3.2em">' + m[1] + '</span>');
        T(function () { rows[i].classList.remove('off'); rows[i].lastChild.textContent = m[1]; rows[i].lastChild.classList.add('flash'); }, 200);
      }, 500 + i * stepMs);
    });
    T(function () {
      xlink.classList.remove('on'); watch('<span class="xw-pill">Sent</span><span class="xw-s"><b>16 measures</b><br>saved on iPhone</span>');
      n.insertAdjacentHTML('beforeend', '<div class="banner">Check saved · day 1 of 14</div>' + cta('Continue')); n.scrollTop = n.scrollHeight;
      ready('Continue', next);
    }, 900 + 16 * stepMs);
  }

  /* ---------- Engine ---------- */
  function go(i) {
    clearAll(); S.i = i; S.pick = null;
    $('#xpBar').style.width = (i / (steps.length - 1) * 100) + '%';
    steps[i]();
  }
  function next() { go(Math.min(S.i + 1, steps.length - 1)); }
  function toggleAuto() {
    S.auto = !S.auto; cAuto.textContent = S.auto ? 'Auto-play: on' : 'Auto-play';
    if (S.auto && S.act) { var a = S.act; T(function () { if (S.auto && S.act === a) trigger(); }, 900); }
  }
  function open() {
    S.prevMode = window.ASTRA.getMode(); window.ASTRA.setMode('earth'); $('#phMode').textContent = 'EARTH';
    S.auto = false; cAuto.textContent = 'Auto-play'; phV.innerHTML = '';
    xp.hidden = false; document.body.style.overflow = 'hidden'; go(0); cNext.focus();
  }
  function close() {
    clearAll(); xp.hidden = true; document.body.style.overflow = ''; S.auto = false;
    window.ASTRA.setMode(S.prevMode);
  }
  function restart() { window.ASTRA.setMode('earth'); $('#phMode').textContent = 'EARTH'; phV.innerHTML = ''; go(0); }

  document.addEventListener('click', function (e) { if (e.target.closest('[data-launch]')) open(); });
  /* Deep links: #demo opens the guided demo, #autoplay opens it and plays it (handy for screen recording). */
  if (location.hash === '#demo' || location.hash === '#autoplay') { open(); if (location.hash === '#autoplay') toggleAuto(); }
  phV.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if ('go' in b.dataset) trigger();
    else if (b.dataset.pick && S.pick) { S.act = null; S.pick(b.dataset.pick); }
    else if ('replay' in b.dataset) restart();
  });
  cNext.addEventListener('click', trigger);
  cAuto.addEventListener('click', toggleAuto);
  $('#cRestart').addEventListener('click', restart);
  $('#xpClose').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (xp.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') trigger();
  });
})();
