/* ==========================================================================
   ASTRA × Grok Voice AI + 6-Language Unified Portal Controller
   Works seamlessly across:
     - /          (3D Showcase Journey)
     - /demo/     (14-Step Apple Watch + iPhone Guided Demo)
     - /studio    (3D Live Biomechanics, HUNCH Triage & AURA Evidence Lab)
   ========================================================================== */
(function () {
  "use strict";

  var LANGS = [
    { code: "en", short: "EN", label: "English", bcp47: "en-US" },
    { code: "es", short: "ES", label: "Español", bcp47: "es-ES" },
    { code: "fr", short: "FR", label: "Français", bcp47: "fr-FR" },
    { code: "ja", short: "JA", label: "日本語", bcp47: "ja-JP" },
    { code: "zh", short: "ZH", label: "中文", bcp47: "zh-CN" },
    { code: "de", short: "DE", label: "Deutsch", bcp47: "de-DE" },
  ];

  var VOICES = [
    { id: "eve", label: "Eve · Flight Surgeon" },
    { id: "ara", label: "Ara · Crew Companion" },
    { id: "rex", label: "Rex · Mission Control" },
    { id: "leo", label: "Leo · Commander" },
    { id: "lumen", label: "Lumen · Science Officer" },
  ];

  var I18N = {
    en: {
      dock: {
        story: "01 Story",
        demo: "02 Watch + iPhone Demo",
        studio: "03 3D Twin Lab",
        film: "0:29 Film",
        askBtn: "Ask ASTRA",
        grokPill: "ASTRA Voice",
        narrate: "🔊 Narrate",
        narrating: "🔊 Narrating Live",
        studioStory: "Orbital Story",
        studioDemo: "Watch + iPhone Demo",
      },
      ui: {
        title: "ASTRA Voice",
        badgeLive: "clawagents · Live",
        readyState: "READY",
        thinkingState: "THINKING…",
        speakingState: "SPEAKING…",
        listeningState: "LISTENING TO CREW VOICE…",
        welcome:
          "Hi, I’m ASTRA. Ask anything about astronaut baselines, try our Day 12 triage, or ask me to switch modes or launch the demo.",
        placeholder: "Ask ASTRA or say “launch demo”…",
        send: "Send",
        chips: [
          {
            label: "Why does normal change in orbit?",
            prompt: "Why does my personal normal change when I leave Earth for orbit?",
          },
          {
            label: "Day 12: puffy face & blurry vision",
            prompt:
              "On Mission Day 12 my face feels puffy and my near vision is blurrier. What should I check?",
          },
          {
            label: "Launch Watch + iPhone demo",
            prompt: "Launch the interactive Apple Watch and iPhone guided demo now.",
          },
          {
            label: "3D Lab · Solar Storm blackout",
            prompt: "Open the 3D Digital Twin Lab under a Solar Storm SPE blackout scenario.",
          },
        ],
      },
      journey: {
        distance: {
          label: ["01", "Distance"],
          lines: ["The farther", "the mission,", "the farther", "the doctor."],
          body: "A value that is fine on the ground can mean something else in orbit. A watch shows a number. It does not say what to check next, or what is missing.",
          btn: "Start on the ground",
        },
        baseline: {
          label: ["02", "Baseline"],
          lines: ["A baseline that", "travels with", "the astronaut."],
          body: "Every daily check records 16 measures from Apple Watch, iPhone tests and three questions. Together they make one snapshot of the astronaut that day. Fourteen snapshots draw a baseline that belongs to this astronaut, not to an average person.",
          btn: "Build the baseline",
        },
        orbit: {
          label: ["03", "Orbit"],
          lines: ["Your normal", "changes when you", "leave Earth."],
          body: "On the Inspiration4 mission, crew wearing Apple Watch showed heart rate and heart rate variability that changed across mission phases, differently for each person. So the first snapshot in orbit lands outside the Earth baseline. Orbit mode moves the expected ranges, and ASTRA keeps watching.",
          btnEarth: "Flip to Orbit mode",
          btnOrbit: "Flip to Earth baseline",
        },
        evidence: {
          label: ["04", "Evidence"],
          lines: ["Eleven quiet days.", "Then something", "drifts."],
          body: "On mission day 12 the snapshot falls outside the astronaut's orbit normal. ASTRA shows which measures moved it, she says what she feels, and it ranks possible causes with evidence for each. Never a diagnosis. The episode stays open until reviewed.",
          btn: "I feel unwell",
        },
        mission: {
          label: ["05", "Mission"],
          lines: ["From a feeling", "to a plan."],
          body: "A personal baseline, a range that follows the astronaut into orbit, a guided check, possible causes with evidence, and a follow-up that stays open until it is reviewed. On iPhone and Apple Watch, with no link to Earth required.",
          btn: "Launch the demo",
        },
        tagD12: "Day 12 · outside your normal",
        cue: "Scroll to explore",
        sciH: "Built on NASA science",
        howH: "How ASTRA works",
        watchFilm: "Watch the film",
        teamMeta: "Houston, TX, United States · Challenge: Create Health Monitoring Software for Astronauts on Space Missions",
        prev: "Previous",
        next: "Next",
      },
      demo: {
        restart: "Restart",
        close: "Back to the journey ✕",
        autoPlay: "Auto-play",
      },
      studioTabs: {
        console: "Live 3D Twin",
        triage: "Triage",
        aura: "Evidence",
        neuro: "Neuro-Lab",
        edge: "Edge API",
      },
    },

    es: {
      dock: {
        story: "01 Historia",
        demo: "02 Demo Watch + iPhone",
        studio: "03 Lab 3D",
        film: "0:29 Video",
        askBtn: "Hablar con ASTRA",
        grokPill: "Voz ASTRA",
        narrate: "🔊 Narrar",
        narrating: "🔊 Narrando en vivo",
        studioStory: "Historia Orbital",
        studioDemo: "Demo Watch + iPhone",
      },
      ui: {
        title: "Voz ASTRA",
        badgeLive: "clawagents · Activo",
        readyState: "LISTO",
        thinkingState: "PENSANDO…",
        speakingState: "HABLANDO…",
        listeningState: "ESCUCHANDO A LA TRIPULACIÓN…",
        welcome:
          "Hola, soy ASTRA. Pregúntame cómo cambia lo normal en órbita, prueba el triaje del Día 12 o pídeme abrir el demo interactivo.",
        placeholder: "Pregunta a ASTRA o di “abrir demo”…",
        send: "Enviar",
        chips: [
          {
            label: "¿Por qué cambia en órbita?",
            prompt: "¿Por qué cambia mi rango normal personal al dejar la Tierra hacia la órbita?",
          },
          {
            label: "Día 12: cara hinchada y vista borrosa",
            prompt:
              "En el Día 12 de misión siento la cara hinchada y visión cercana borrosa. ¿Qué debo revisar?",
          },
          {
            label: "Abrir demo Watch + iPhone",
            prompt: "Abre ahora la demostración guiada interactiva de Apple Watch y iPhone.",
          },
          {
            label: "Lab 3D · Tormenta solar",
            prompt: "Abre el Laboratorio Gemelo Digital 3D en escenario de apagón por tormenta solar SPE.",
          },
        ],
      },
      journey: {
        distance: {
          label: ["01", "Distancia"],
          lines: ["Cuanto más lejos", "la misión,", "más lejos", "está el médico."],
          body: "Un valor normal en tierra puede significar algo distinto en órbita. Un reloj muestra un número, pero no dice qué revisar después ni qué falta.",
          btn: "Comenzar en tierra",
        },
        baseline: {
          label: ["02", "Línea Base"],
          lines: ["Una línea base", "que viaja con", "cada astronauta."],
          body: "Cada chequeo diario registra 16 medidas del Apple Watch, pruebas del iPhone y tres preguntas. Catorce capturas trazan una línea base propia del astronauta, no de un promedio.",
          btn: "Construir línea base",
        },
        orbit: {
          label: ["03", "Órbita"],
          lines: ["Tu rango normal", "cambia al dejar", "la Tierra."],
          body: "En la misión Inspiration4, los relojes mostraron cambios de frecuencia cardíaca y VFC según la fase de vuelo y la persona. El modo Órbita ajusta las bandas esperadas y sigue vigilando.",
          btnEarth: "Cambiar a modo Órbita",
          btnOrbit: "Volver a rango Tierra",
        },
        evidence: {
          label: ["04", "Evidencia"],
          lines: ["Once días tranquilos.", "Luego algo", "se desvía."],
          body: "En el día 12 de misión la captura sale del rango orbital. ASTRA muestra qué señales cambiaron, ordena causas probables con evidencia NASA y deja el episodio abierto hasta su revisión.",
          btn: "No me siento bien",
        },
        mission: {
          label: ["05", "Misión"],
          lines: ["De un síntoma", "a un plan."],
          body: "Línea base personal, rangos que te siguen a órbita, revisión guiada y seguimiento abierto hasta cerrarlo. En iPhone y Apple Watch, sin requerir enlace a la Tierra.",
          btn: "Abrir el demo",
        },
        tagD12: "Día 12 · fuera de tu rango normal",
        cue: "Desplaza para explorar",
        sciH: "Basado en ciencia de la NASA",
        howH: "Cómo funciona ASTRA",
        watchFilm: "Ver el video",
        teamMeta: "Houston, TX, EE. UU. · Reto: Software de monitoreo de salud para astronautas",
        prev: "Anterior",
        next: "Siguiente",
      },
      demo: {
        restart: "Reiniciar",
        close: "Volver a la historia ✕",
        autoPlay: "Auto-reproducir",
      },
      studioTabs: {
        console: "Gemelo 3D",
        triage: "Triaje",
        aura: "Evidencia",
        neuro: "Neuro-Lab",
        edge: "API Reloj",
      },
    },

    fr: {
      dock: {
        story: "01 Récit",
        demo: "02 Démo Watch + iPhone",
        studio: "03 Labo 3D",
        film: "0:29 Film",
        askBtn: "Parler à ASTRA",
        grokPill: "Voix ASTRA",
        narrate: "🔊 Lire à voix haute",
        narrating: "🔊 Narration active",
        studioStory: "Récit Orbital",
        studioDemo: "Démo Watch + iPhone",
      },
      ui: {
        title: "Voix ASTRA",
        badgeLive: "clawagents · Actif",
        readyState: "PRÊT",
        thinkingState: "RÉFLEXION…",
        speakingState: "PAROLE EN COURS…",
        listeningState: "ÉCOUTE DE L'ÉQUIPAGE…",
        welcome:
          "Bonjour, je suis ASTRA. Demandez comment la normale évolue en orbite, testez le triage du Jour 12 ou lancez la démo guidée.",
        placeholder: "Posez une question ou dites « lancer la démo »…",
        send: "Envoyer",
        chips: [
          {
            label: "Pourquoi la normale change en orbite ?",
            prompt: "Pourquoi ma plage normale personnelle change-t-elle en quittant la Terre ?",
          },
          {
            label: "Jour 12 : visage gonflé & vision floue",
            prompt:
              "Au Jour 12 j'ai le visage gonflé et ma vision de près est floue. Que vérifier ?",
          },
          {
            label: "Lancer la démo Watch + iPhone",
            prompt: "Lance la démonstration guidée Apple Watch et iPhone maintenant.",
          },
          {
            label: "Labo 3D · Tempête solaire",
            prompt: "Ouvre le laboratoire Jumeau Numérique 3D en mode panne solaire SPE.",
          },
        ],
      },
      journey: {
        distance: {
          label: ["01", "Distance"],
          lines: ["Plus la mission", "est lointaine,", "plus le médecin", "est loin."],
          body: "Une valeur saine au sol peut signifier autre chose en orbite. Une montre affiche un chiffre, sans dire quoi vérifier ensuite.",
          btn: "Commencer au sol",
        },
        baseline: {
          label: ["02", "Référence"],
          lines: ["Une ligne de base", "qui voyage avec", "l'astronaute."],
          body: "Chaque bilan quotidien relève 16 mesures sur Apple Watch, tests iPhone et trois questions. Quatorze bilans tracent la normale propre à cet astronaute.",
          btn: "Bâtir la référence",
        },
        orbit: {
          label: ["03", "Orbite"],
          lines: ["Votre normale", "change lorsque vous", "quittez la Terre."],
          body: "Lors de la mission Inspiration4, la fréquence cardiaque et la VFC ont varié selon chaque membre. Le mode Orbite décale les seuils attendus tout en continuant la veille.",
          btnEarth: "Passer en mode Orbite",
          btnOrbit: "Revenir au mode Terre",
        },
        evidence: {
          label: ["04", "Preuves"],
          lines: ["Onze jours calmes.", "Puis un signal", "dérive."],
          body: "Au jour 12, l'instantané sort de la bande orbitale. ASTRA indique quelles mesures ont bougé, classe les causes possibles avec preuves NASA et garde l'épisode ouvert.",
          btn: "Je ne me sens pas bien",
        },
        mission: {
          label: ["05", "Mission"],
          lines: ["D'un ressenti", "à un plan."],
          body: "Une référence personnelle qui s'adapte à l'orbite, un entretien guidé et un suivi ouvert jusqu'à révision médicale. Sans connexion Terre.",
          btn: "Lancer la démo",
        },
        tagD12: "Jour 12 · hors de votre normale",
        cue: "Défiler pour explorer",
        sciH: "Fondé sur la science NASA",
        howH: "Comment fonctionne ASTRA",
        watchFilm: "Voir le film",
        teamMeta: "Houston, TX, États-Unis · Défi : Logiciel de suivi de santé pour astronautes",
        prev: "Précédent",
        next: "Suivant",
      },
      demo: {
        restart: "Recommencer",
        close: "Retour au récit ✕",
        autoPlay: "Lecture auto",
      },
      studioTabs: {
        console: "Jumeau 3D",
        triage: "Triage",
        aura: "Preuves",
        neuro: "Neuro-Lab",
        edge: "API Montre",
      },
    },

    ja: {
      dock: {
        story: "01 ストーリー",
        demo: "02 Watch + iPhone デモ",
        studio: "03 3Dラボ",
        film: "0:29 映像",
        askBtn: "ASTRAに質問",
        grokPill: "ASTRA音声",
        narrate: "🔊 音声解説",
        narrating: "🔊 音声解説中",
        studioStory: "軌道ストーリー",
        studioDemo: "Watch + iPhone デモ",
      },
      ui: {
        title: "ASTRA 音声",
        badgeLive: "clawagents · 稼働中",
        readyState: "準備完了",
        thinkingState: "考え中…",
        speakingState: "回答中…",
        listeningState: "音声を聞き取っています…",
        welcome:
          "こんにちは、ASTRAです。軌道上の正常値変化や12日目のトリアージについて質問するか、デモの起動を音声で指示してください。",
        placeholder: "質問を入力、または「デモを開いて」…",
        send: "送信",
        chips: [
          {
            label: "なぜ軌道上で正常値が変わる？",
            prompt: "地球を離れて軌道に入ると、なぜ個人の正常値が変化するのですか？",
          },
          {
            label: "12日目：顔のむくみと視界のにじみ",
            prompt: "ミッション12日目に顔がむくみ、近くが見えにくいです。何を確認すべきですか？",
          },
          {
            label: "Watch + iPhone デモを起動",
            prompt: "今すぐApple WatchとiPhoneのインタラクティブデモを起動してください。",
          },
          {
            label: "3Dラボ · 太陽嵐ブラックアウト",
            prompt: "太陽嵐ブラックアウト状態の3Dデジタルツインラボを開いてください。",
          },
        ],
      },
      journey: {
        distance: {
          label: ["01", "距離"],
          lines: ["ミッションが", "遠いほど、", "医師も", "遠くなる。"],
          body: "地上で問題ない数値でも、軌道上では意味が変わります。腕時計は数値を示しても、次に何を調べるべきかは教えてくれません。",
          btn: "地上から始める",
        },
        baseline: {
          label: ["02", "ベースライン"],
          lines: ["宇宙飛行士と", "ともに旅する", "個人基準値。"],
          body: "毎日のチェックでApple Watch・iPhoneテスト・3つの質問から16項目を記録。14日分のスナップショットで平均値ではない「あなた専用」の基準を描きます。",
          btn: "基準を作成する",
        },
        orbit: {
          label: ["03", "軌道適応"],
          lines: ["地球を離れると", "あなたの正常値も", "変化する。"],
          body: "Inspiration4ミッションでは心拍数とHRVが飛行フェーズや個人ごとに変化しました。軌道モードは期待範囲を自動調整して見守り続けます。",
          btnEarth: "軌道モードへ切替",
          btnOrbit: "地上モードへ戻す",
        },
        evidence: {
          label: ["04", "根拠提示"],
          lines: ["穏やかな11日間。", "そして12日目、", "兆候がずれる。"],
          body: "12日目に軌道基準から外れると、変化した指標を示し、NASA研究に基づく原因候補を根拠つきで順位付け。診断はせず確認完了まで開いたまま管理します。",
          btn: "体調がすぐれない",
        },
        mission: {
          label: ["05", "ミッション"],
          lines: ["違和感から", "行動計画へ。"],
          body: "個人基準値、軌道シフト適応、段階的チェック、根拠ある候補提示と継続フォロー。地球との通信なしでもiPhoneとApple Watchだけで完結します。",
          btn: "デモを起動",
        },
        tagD12: "12日目 · 正常範囲外",
        cue: "スクロールして探索",
        sciH: "NASAの科学的知見に基づく設計",
        howH: "ASTRAの仕組み",
        watchFilm: "紹介映像を見る",
        teamMeta: "米国テキサス州ヒューストン · 課題：宇宙ミッション向け健康監視ソフトウェア",
        prev: "前へ",
        next: "次へ",
      },
      demo: {
        restart: "最初から",
        close: "ストーリーに戻る ✕",
        autoPlay: "自動再生",
      },
      studioTabs: {
        console: "3Dツイン",
        triage: "トリアージ",
        aura: "NASA根拠",
        neuro: "音響ラボ",
        edge: "連携API",
      },
    },

    zh: {
      dock: {
        story: "01 轨道故事",
        demo: "02 手表+手机演示",
        studio: "03 3D数字孪生",
        film: "0:29 影片",
        askBtn: "唤醒 ASTRA",
        grokPill: "ASTRA 语音",
        narrate: "🔊 语音解说",
        narrating: "🔊 正在语音解说",
        studioStory: "返回故事",
        studioDemo: "手表+手机演示",
      },
      ui: {
        title: "ASTRA 语音助手",
        badgeLive: "clawagents · 在线",
        readyState: "就绪",
        thinkingState: "正在思考…",
        speakingState: "正在回答…",
        listeningState: "正在聆听航天员语音…",
        welcome:
          "你好，我是 ASTRA 智能伴侣。欢迎询问轨道基线变化、体验第12天症状分诊，或直接让我打开互动演示。",
        placeholder: "输入问题或说“打开演示”…",
        send: "发送",
        chips: [
          {
            label: "为什么入轨后正常基线会变？",
            prompt: "离开地球进入轨道后，为什么航天员的个人正常生理基线会发生变化？",
          },
          {
            label: "第12天：面部浮肿与视力模糊",
            prompt: "任务第12天早上我感觉脸部浮肿且近距离视力变模糊，应该检查什么？",
          },
          {
            label: "打开手表与手机互动演示",
            prompt: "请立即打开 Apple Watch 与 iPhone 14步互动指南演示。",
          },
          {
            label: "3D 实验室 · 太阳风暴断联",
            prompt: "打开处于太阳风暴通讯中断场景下的 3D 数字孪生实验室。",
          },
        ],
      },
      journey: {
        distance: {
          label: ["01", "距离"],
          lines: ["任务飞得", "越远，", "地面医生", "就越远。"],
          body: "地面看似正常的数值，在太空轨道可能意味截然不同。手表只显示冷冰冰的数字，却不会告诉你下一步查什么、还缺哪些信息。",
          btn: "从地面基线开始",
        },
        baseline: {
          label: ["02", "个人基线"],
          lines: ["随航天员", "一同启程的", "专属基线。"],
          body: "每日两分钟采集 Apple Watch、iPhone 测试与三项问卷共16项指标。连续14天构建只属于这位航天员自己的正常范围，而非人群平均值。",
          btn: "建立个人基线",
        },
        orbit: {
          label: ["03", "轨道适应"],
          lines: ["当你离开地球，", "你的“正常”", "随之改变。"],
          body: "Inspiration4 任务证实航天员心率与 HRV 会随飞行阶段因人而异地漂移。开启轨道模式后，期望区间动态适配并持续护航。",
          btnEarth: "切换至轨道模式",
          btnOrbit: "切回地面基线",
        },
        evidence: {
          label: ["04", "循证分诊"],
          lines: ["十一天平静无波，", "随后某项指标", "悄然偏离。"],
          body: "任务第12天快照落入轨道正常带之外。ASTRA 标出偏离指标、按 NASA 证据排序可能诱因——绝不武断下诊断，并持续追踪至随访完成。",
          btn: "我感到不适",
        },
        mission: {
          label: ["05", "任务闭环"],
          lines: ["从细微不适", "到清晰行动方案。"],
          body: "个人基线、轨道动态适配、交互式检查、循证诱因排序与随访闭环。无需连接地球，仅凭 iPhone 与 Apple Watch 自主运行。",
          btn: "启动互动演示",
        },
        tagD12: "第12天 · 超出个人轨道正常范围",
        cue: "向下滚动探索",
        sciH: "基于 NASA 航天医学科学",
        howH: "ASTRA 核心架构",
        watchFilm: "观看概念短片",
        teamMeta: "美国休斯顿 · 赛题：为太空任务打造航天员健康监测软件",
        prev: "上一幕",
        next: "下一幕",
      },
      demo: {
        restart: "重新开始",
        close: "返回故事 ✕",
        autoPlay: "自动播放",
      },
      studioTabs: {
        console: "3D孪生",
        triage: "红旗分诊",
        aura: "NASA文献",
        neuro: "神经声学",
        edge: "手表接口",
      },
    },

    de: {
      dock: {
        story: "01 Story",
        demo: "02 Watch + iPhone Demo",
        studio: "03 3D-Labor",
        film: "0:29 Film",
        askBtn: "ASTRA fragen",
        grokPill: "ASTRA Voice",
        narrate: "🔊 Vorlesen",
        narrating: "🔊 Liest vor",
        studioStory: "Orbital-Story",
        studioDemo: "Watch + iPhone Demo",
      },
      ui: {
        title: "ASTRA Voice",
        badgeLive: "clawagents · Aktiv",
        readyState: "BEREIT",
        thinkingState: "DENKT NACH…",
        speakingState: "SPRICHT…",
        listeningState: "HÖRE CREW-SPRACHE ZU…",
        welcome:
          "Hallo, ich bin ASTRA. Fragen Sie mich zur Orbit-Basislinie, testen Sie Tag 12 oder starten Sie per Sprache die interaktive Demo.",
        placeholder: "Frage stellen oder „Demo öffnen“ sagen…",
        send: "Senden",
        chips: [
          {
            label: "Warum ändert sich normal im Orbit?",
            prompt: "Warum verschiebt sich mein persönlicher Normalbereich im Weltraum?",
          },
          {
            label: "Tag 12: geschwollenes Gesicht & Sicht",
            prompt:
              "An Missionstag 12 fühlt sich mein Gesicht geschwollen an und die Nahsicht ist unscharf. Was soll ich prüfen?",
          },
          {
            label: "Watch + iPhone Demo starten",
            prompt: "Starte jetzt die geführte Apple Watch und iPhone Demo.",
          },
          {
            label: "3D-Labor · Sonnensturm",
            prompt: "Öffne das 3D-Digital-Twin-Labor im Sonnensturm-Blackout-Szenario.",
          },
        ],
      },
      journey: {
        distance: {
          label: ["01", "Distanz"],
          lines: ["Je weiter", "die Mission,", "desto weiter", "der Arzt."],
          body: "Ein Wert, der auf der Erde normal ist, bedeutet im Orbit oft etwas anderes. Eine Uhr zeigt Zahlen, aber nicht, was als Nächstes zu prüfen ist.",
          btn: "Am Boden starten",
        },
        baseline: {
          label: ["02", "Basislinie"],
          lines: ["Eine Basislinie,", "die mit jedem", "Astronauten reist."],
          body: "Jeder Check erfasst 16 Werte aus Apple Watch, iPhone-Tests und drei Fragen. Vierzehn Tage zeichnen das persönliche Normal – keinen Durchschnittswert.",
          btn: "Basislinie aufbauen",
        },
        orbit: {
          label: ["03", "Orbit"],
          lines: ["Dein Normalwert", "ändert sich beim", "Verlassen der Erde."],
          body: "Bei Inspiration4 zeigten Watch-Daten individuelle Anpassungen von Puls und HRV. Der Orbit-Modus verschiebt den Zielbereich automatisch.",
          btnEarth: "In Orbit-Modus wechseln",
          btnOrbit: "Zurück zu Erd-Normal",
        },
        evidence: {
          label: ["04", "Evidenz"],
          lines: ["Elf ruhige Tage.", "Dann driften", "einige Werte ab."],
          body: "An Tag 12 fällt die Messung aus dem Orbit-Band. ASTRA zeigt abweichende Signale, ordnet NASA-Ursachen ein und hält den Fall bis zur Prüfung offen.",
          btn: "Ich fühle mich unwohl",
        },
        mission: {
          label: ["05", "Mission"],
          lines: ["Vom Symptom", "zum klaren Plan."],
          body: "Persönliche Basislinie, Orbit-Anpassung, geführter Check und offene Nachverfolgung – komplett offline auf iPhone und Apple Watch.",
          btn: "Demo starten",
        },
        tagD12: "Tag 12 · außerhalb deines Normalbereichs",
        cue: "Scrollen zum Entdecken",
        sciH: "Basierend auf NASA-Forschung",
        howH: "So arbeitet ASTRA",
        watchFilm: "Film ansehen",
        teamMeta: "Houston, TX, USA · Challenge: Gesundheits-Software für Astronauten",
        prev: "Zurück",
        next: "Weiter",
      },
      demo: {
        restart: "Neu starten",
        close: "Zurück zur Story ✕",
        autoPlay: "Auto-Play",
      },
      studioTabs: {
        console: "3D-Zwilling",
        triage: "Triage",
        aura: "Evidenz",
        neuro: "Neuro-Lab",
        edge: "Watch-API",
      },
    },
  };

  /* --------------------------------------------------------------------------
     State & Page Detection
     -------------------------------------------------------------------------- */
  var path = location.pathname || "/";
  var pageKind = path.indexOf("/demo") === 0 ? "demo" : path.indexOf("/story") === 0 ? "journey" : "studio";
  var urlLang = new URLSearchParams(location.search).get("lang");
  var savedLang = null;
  try { savedLang = localStorage.getItem("astra_lang"); } catch (e) {}
  var currentLang = I18N[urlLang] ? urlLang : I18N[savedLang] ? savedLang : "en";
  var currentVoice = "eve";
  try {
    var sv = localStorage.getItem("astra_voice_id");
    if (sv && VOICES.some(function (v) { return v.id === sv; })) currentVoice = sv;
  } catch (e) {}
  var autoSpeak = true;
  var demoNarrate = false;
  var sessionId = "sess-" + Math.random().toString(36).slice(2, 10);
  var audioEl = null;
  var audioCtx = null;
  var analyser = null;
  var dataArr = null;
  var isListening = false;
  var isSpeaking = false;
  var isThinking = false;
  var recognition = null;
  var lastNarratedKey = "";

  function t(lang) {
    return I18N[lang || currentLang] || I18N.en;
  }

  /* --------------------------------------------------------------------------
     Web Audio Visualizer & NASA 2525 Hz Quindar Tone
     -------------------------------------------------------------------------- */
  function ensureAudioGraph() {
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.id = "astraGrokAudioEl";
      audioEl.setAttribute("playsinline", "");
      audioEl.preload = "auto";
      document.body.appendChild(audioEl);
      audioEl.addEventListener("play", function () {
        isSpeaking = true;
        playingVia = "element";
        setOrbState(t().ui.speakingState);
        watchForBargeIn();
      });
      audioEl.addEventListener("ended", function () {
        isSpeaking = false;
        setOrbState(t().ui.readyState);
        afterSpeak();
      });
      audioEl.addEventListener("pause", function () {
        isSpeaking = false;
      });
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !audioCtx) {
        audioCtx = new AC();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        dataArr = new Uint8Array(analyser.frequencyBinCount);
        var src = audioCtx.createMediaElementSource(audioEl);
        src.connect(analyser);
        analyser.connect(audioCtx.destination);
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(function () {});
      }
    } catch (e) {
      analyser = null;
    }
  }

  function playQuindar(freq) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) ensureAudioGraph();
      if (!audioCtx) return;
      var osc = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq || 2525;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.045, audioCtx.currentTime + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.11);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
  }

  /* Browser speech is only the backup for Grok Voice, but the default system voice is often the
     oldest, most robotic one installed. Prefer a natural-sounding voice for the language. */
  var NOVELTY_VOICE_RE = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy|princess|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley/i;
  function pickSynthVoice(bcp47) {
    var voices = [];
    try { voices = window.speechSynthesis.getVoices() || []; } catch (e) {}
    var base = String(bcp47 || "en-US").toLowerCase();
    var short = base.split("-")[0];
    var best = null;
    var bestScore = -1;
    voices.forEach(function (v) {
      var vl = String(v.lang || "").toLowerCase().replace("_", "-");
      if (vl.split("-")[0] !== short) return;
      var name = v.name || "";
      var score = vl === base ? 4 : 0;
      if (/premium|enhanced|natural|neural|siri/i.test(name)) score += 30;
      else if (/google|microsoft .*online|samantha|ava|allison|karen|daniel|moira|tessa|serena/i.test(name)) score += 18;
      if (NOVELTY_VOICE_RE.test(name)) score -= 40;
      if (v.default) score += 2;
      if (score > bestScore) { bestScore = score; best = v; }
    });
    return best;
  }
  try { if ("speechSynthesis" in window) window.speechSynthesis.getVoices(); } catch (e) {} // voices load asynchronously

  var synthSeq = 0;
  function speakWebSpeechFallback(text, lang) {
    if (!("speechSynthesis" in window) || !autoSpeak || !text) {
      setOrbState(t().ui.readyState);
      afterSpeak();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      var mine = ++synthSeq;
      var u = new SpeechSynthesisUtterance(text);
      var code = lang || currentLang;
      var langObj = LANGS.find(function (l) { return l.code === code; }) || LANGS[0];
      u.lang = langObj.bcp47;
      var voice = pickSynthVoice(langObj.bcp47);
      if (voice) u.voice = voice;
      u.rate = 1.0;
      u.onstart = function () {
        if (mine !== synthSeq) return;
        isSpeaking = true;
        playingVia = "synth";
        setOrbState(t().ui.speakingState);
        watchForBargeIn();
      };
      // A cancelled utterance (interrupted by the person, or replaced) must not restart listening.
      u.onend = u.onerror = function () {
        if (mine !== synthSeq) return;
        synthSeq += 1;
        isSpeaking = false;
        setOrbState(t().ui.readyState);
        afterSpeak();
      };
      window.speechSynthesis.speak(u);
    } catch (e) {
      afterSpeak();
    }
  }

  function playGrokAudioPayload(b64, mime, fallbackText, lang) {
    if (!autoSpeak) { afterSpeak(); return; }
    if (b64) {
      ensureAudioGraph();
      var url = "data:" + (mime || "audio/mpeg") + ";base64," + b64;
      audioEl.src = url;
      var p = audioEl.play();
      if (p && p.catch) {
        p.catch(function (err) {
          if (err && err.name === "AbortError") return; // interrupted on purpose, e.g. the person started talking
          speakWebSpeechFallback(fallbackText, lang);
        });
      }
    } else {
      speakWebSpeechFallback(fallbackText, lang);
    }
  }

  /* --------------------------------------------------------------------------
     60-FPS Plasma Orb Canvas Loop
     -------------------------------------------------------------------------- */
  var orbPhase = 0;
  function startOrbCanvasLoop(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 82 * dpr;
    canvas.height = 82 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    function frame() {
      requestAnimationFrame(frame);
      var energy = 0.14;
      if (analyser && dataArr && (isSpeaking || isListening)) {
        analyser.getByteFrequencyData(dataArr);
        var sum = 0;
        for (var i = 0; i < dataArr.length; i++) sum += dataArr[i];
        energy = Math.min(1, 0.22 + (sum / (dataArr.length * 255)) * 1.45);
      } else if (isSpeaking) {
        energy = 0.55 + Math.sin(orbPhase * 3.2) * 0.22;
      } else if (isThinking) {
        energy = 0.42;
      } else if (isListening) {
        energy = 0.62;
      }
      orbPhase += isThinking ? 0.08 : isSpeaking ? 0.065 : 0.025;

      ctx.clearRect(0, 0, 82, 82);
      var cx = 41, cy = 41;
      var glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 38);
      if (isListening) {
        glow.addColorStop(0, "rgba(248, 113, 113, 0.92)");
        glow.addColorStop(0.55, "rgba(251, 146, 60, 0.36)");
      } else if (isThinking) {
        glow.addColorStop(0, "rgba(255, 179, 71, 0.95)");
        glow.addColorStop(0.55, "rgba(167, 139, 250, 0.35)");
      } else {
        glow.addColorStop(0, "rgba(56, 189, 248, 0.92)");
        glow.addColorStop(0.55, "rgba(167, 139, 250, 0.34)");
      }
      glow.addColorStop(1, "rgba(7, 13, 20, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.fill();

      // Dynamic orbital rings
      for (var r = 0; r < 3; r++) {
        ctx.beginPath();
        var baseR = 17 + r * 6 + energy * 5;
        for (var a = 0; a <= Math.PI * 2 + 0.1; a += 0.2) {
          var wobble = Math.sin(a * (3 + r) + orbPhase * (r % 2 === 0 ? 1.5 : -1.2)) * (1.8 + energy * 4.5);
          var px = cx + Math.cos(a) * (baseR + wobble);
          var py = cy + Math.sin(a) * (baseR - wobble * 0.6);
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle =
          r === 0 ? "rgba(248, 250, 252, 0.88)" : r === 1 ? "rgba(56, 189, 248, 0.72)" : "rgba(255, 179, 71, 0.62)";
        ctx.lineWidth = r === 0 ? 1.6 : 1.1;
        ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  }

  /* --------------------------------------------------------------------------
     UI Translation Engine (6 Languages across /, /demo/, /studio)
     -------------------------------------------------------------------------- */
  function setChapterLines(headingEl, lines) {
    if (!headingEl || !lines || !lines.length) return;
    var existing = headingEl.querySelectorAll(".line > span");
    if (existing.length === lines.length) {
      for (var i = 0; i < lines.length; i++) existing[i].textContent = lines[i];
      return;
    }
    headingEl.innerHTML = lines
      .map(function (ln) {
        return '<span class="line"><span>' + escapeHtml(ln) + "</span></span>";
      })
      .join("");
  }

  function applyLanguage(lang) {
    if (!I18N[lang]) return;
    currentLang = lang;
    try { localStorage.setItem("astra_lang", lang); } catch (e) {}
    document.documentElement.setAttribute("lang", lang);
    var dict = t(lang);

    // Sync all language pickers
    document.querySelectorAll(".astra-lang-select").forEach(function (sel) {
      if (sel.value !== lang) sel.value = lang;
    });

    // Update generic i18n keys
    document.querySelectorAll("[data-i18n-key]").forEach(function (el) {
      var parts = el.dataset.i18nKey.split(".");
      var val = dict;
      for (var i = 0; i < parts.length; i++) val = val && val[parts[i]];
      if (typeof val === "string") el.textContent = val;
    });

    // Journey chapters on /
    if (pageKind === "journey") {
      ["distance", "baseline", "orbit", "evidence", "mission"].forEach(function (id) {
        var sec = document.getElementById(id);
        var copy = dict.journey[id];
        if (!sec || !copy) return;
        var lbl = sec.querySelector(".label");
        if (lbl) lbl.innerHTML = "<span>" + copy.label[0] + "</span> " + escapeHtml(copy.label[1]);
        var h = sec.querySelector("h1, h2");
        setChapterLines(h, copy.lines);
        var body = sec.querySelector(".body");
        if (body) body.textContent = copy.body;
        var btn = sec.querySelector(".copy > .btn");
        if (btn) {
          if (id === "orbit") {
            btn.textContent = btn.dataset.toggled === "1" ? copy.btnOrbit : copy.btnEarth;
          } else {
            btn.textContent = copy.btn;
          }
        }
      });
      var tagD12 = document.getElementById("tagD12");
      if (tagD12) tagD12.textContent = dict.journey.tagD12;
      var cue = document.getElementById("cueText");
      if (cue) cue.textContent = dict.journey.cue;
      var sciH = document.getElementById("sciH");
      if (sciH) sciH.textContent = dict.journey.sciH;
      var howH = document.getElementById("howH");
      if (howH) howH.textContent = dict.journey.howH;
      var teamMeta = document.querySelector(".team-meta");
      if (teamMeta) teamMeta.textContent = dict.journey.teamMeta;
      var prevSpan = document.querySelector("#prev span");
      if (prevSpan) prevSpan.textContent = dict.journey.prev;
      var nextSpan = document.querySelector("#next span");
      if (nextSpan) nextSpan.textContent = dict.journey.next;
      var filmOpen = document.getElementById("filmOpen");
      if (filmOpen) {
        var svg = filmOpen.querySelector("svg");
        var spanTime = filmOpen.querySelector("span");
        if (svg && spanTime) {
          filmOpen.innerHTML = "";
          filmOpen.appendChild(svg);
          filmOpen.appendChild(document.createTextNode(" " + dict.journey.watchFilm + " "));
          filmOpen.appendChild(spanTime);
        }
      }
      var howBtn = document.querySelector(".film .btn-amber");
      if (howBtn) howBtn.textContent = dict.journey.mission.btn;
    }

    // Demo page labels
    if (pageKind === "demo") {
      var cr = document.getElementById("cRestart");
      if (cr) cr.textContent = dict.demo.restart;
      var xc = document.getElementById("xpClose");
      if (xc) xc.textContent = dict.demo.close;
      var ca = document.getElementById("cAuto");
      if (ca && !ca.dataset.running) ca.textContent = dict.demo.autoPlay;
    }

    // Drawer texts & starter chips
    var titleEl = document.getElementById("astraGdTitle");
    if (titleEl) titleEl.textContent = dict.ui.title;
    var badgeEl = document.getElementById("astraGdBadge");
    if (badgeEl) badgeEl.textContent = dict.ui.badgeLive;
    var inp = document.getElementById("astraGdInput");
    if (inp) inp.placeholder = dict.ui.placeholder;
    var send = document.getElementById("astraGdSend");
    if (send) send.textContent = dict.ui.send;
    renderQuickChips();
    renderDeviceUi();
    if (!isSpeaking && !isThinking && !isListening) setOrbState(dict.ui.readyState);
  }

  /* --------------------------------------------------------------------------
     Portal Action Dispatcher (when ClawAgents + Grok calls control_portal_ui)
     -------------------------------------------------------------------------- */
  function executePortalActions(actions) {
    if (!Array.isArray(actions) || !actions.length) return;
    actions.forEach(function (act) {
      var target = (act && act.target) || "";
      if (target.indexOf("story_") === 0) {
        var chMap = {
          story_distance: { idx: 0, hash: "#distance" },
          story_baseline: { idx: 1, hash: "#baseline" },
          story_orbit: { idx: 2, hash: "#orbit" },
          story_evidence: { idx: 3, hash: "#evidence" },
          story_mission: { idx: 4, hash: "#mission" },
        };
        var item = chMap[target];
        if (item) {
          if (pageKind === "journey") {
            var tick = document.querySelector('.tick[data-ch="' + item.idx + '"]');
            if (tick) tick.click();
            else {
              var sec = document.querySelector(item.hash);
              if (sec) sec.scrollIntoView({ behavior: "smooth" });
            }
            if (target === "story_orbit") {
              var orbBtn = document.querySelector('#orbit [data-toggle]');
              if (orbBtn) setTimeout(function () { orbBtn.click(); }, 450);
            }
          } else {
            location.href = "/story" + item.hash;
          }
        }
      } else if (target === "open_demo") {
        if (pageKind === "studio") {
          var demoTab = document.getElementById("tabWatchDemo");
          if (demoTab) demoTab.click();
        } else if (pageKind !== "demo") {
          location.href = "/?tab=demo";
        }
      } else if (target === "open_film") {
        openFilmModal();
      } else if (target.indexOf("open_studio") === 0 || target.indexOf("studio_") === 0) {
        var scenMap = {
          studio_nominal: "nominal_lunar",
          studio_hypercapnia: "hypercapnia_drift",
          studio_asymmetry: "musculoskeletal_asymmetry",
          studio_spe_blackout: "spe_blackout",
        };
        var scenId = scenMap[target];
        if (pageKind === "studio") {
          if (scenId) {
            var sel = document.getElementById("scenarioSelect");
            if (sel) {
              sel.value = scenId;
              sel.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
          var tab = document.getElementById("tabMissionConsole");
          if (tab) tab.click();
        } else {
          location.href = scenId ? "/?scenario=" + encodeURIComponent(scenId) : "/";
        }
      }
    });
  }

  function openFilmModal() {
    var existingPlayer = document.getElementById("filmOpen");
    if (existingPlayer) {
      existingPlayer.click();
      return;
    }
    var dlg = document.getElementById("astraInlineFilmDlg");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "astraInlineFilmDlg";
      dlg.className = "astra-film-modal";
      dlg.innerHTML =
        '<div class="astra-film-bar"><span>ASTRA · 0:29 Mission Film</span>' +
        '<button type="button" class="astra-gd-iconbtn" id="astraInlineFilmClose" aria-label="Close">✕</button></div>' +
        '<video id="astraInlineFilmVid" src="/media/astra-film-29s.mp4" poster="/media/astra-film-poster.jpg" controls playsinline></video>';
      document.body.appendChild(dlg);
      document.getElementById("astraInlineFilmClose").addEventListener("click", function () {
        dlg.close();
      });
      dlg.addEventListener("close", function () {
        var v = document.getElementById("astraInlineFilmVid");
        if (v) v.pause();
      });
    }
    dlg.showModal();
    var vid = document.getElementById("astraInlineFilmVid");
    if (vid) vid.play().catch(function () {});
  }

  /* --------------------------------------------------------------------------
     Collect Live Telemetry Context from /studio if available
     -------------------------------------------------------------------------- */
  function readPageTelemetryContext() {
    var ctx = { page: pageKind, lang: currentLang };
    if (pageKind === "studio") {
      var scen = document.getElementById("scenarioSelect");
      var sol = document.getElementById("missionClockVal");
      var ready = document.getElementById("readinessScoreValue");
      if (scen) ctx.scenario = scen.value;
      if (sol) ctx.mission_clock = sol.textContent;
      if (ready) ctx.readiness_score = ready.textContent;
    } else if (pageKind === "demo") {
      var stepTitle = document.getElementById("cT");
      if (stepTitle) ctx.demo_step = stepTitle.textContent;
    }
    return ctx;
  }

  /* --------------------------------------------------------------------------
     Backend Calls: POST /api/voice/chat & POST /api/voice/tts
     -------------------------------------------------------------------------- */
  async function sendVoiceChat(userText, opts) {
    opts = opts || {};
    var clean = (userText || "").trim();
    if (!clean) return;
    var mySeq = ++chatSeq;
    var turnLang = opts.lang || currentLang;
    stopSpeaking(); // a new question, typed or spoken, takes the floor
    appendMessage("user", clean);
    var inp = document.getElementById("astraGdInput");
    var send = document.getElementById("astraGdSend");
    if (inp) inp.value = "";
    if (send) send.disabled = true;
    isThinking = true;
    setOrbState(t().ui.thinkingState);

    try {
      var resp = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: clean,
          lang: turnLang,
          input_mode: opts.inputMode || "text",
          stt_confidence: typeof opts.confidence === "number" ? opts.confidence : null,
          hands_free: handsFree,
          voice_id: currentVoice,
          current_view: pageKind,
          telemetry_context: readPageTelemetryContext(),
          synthesize_audio: autoSpeak,
          speed: 1.03,
        }),
      });
      var data = await resp.json();
      isThinking = false;
      var reply = (data && data.reply) || "Connection nominal. Ready for your next question.";
      var captionEl = document.getElementById("astraOrbCaption");
      if (captionEl) captionEl.textContent = reply;
      appendMessage("ai", reply, data.ui_actions || [], data.citations || []);
      if (mySeq !== chatSeq) return; // the person has already moved on to another question

      if (data.audio_base64 || autoSpeak) {
        playGrokAudioPayload(data.audio_base64, data.audio_mime, data.spoken_text || reply, (data && data.lang) || turnLang);
      } else {
        setOrbState(t().ui.readyState);
        afterSpeak();
      }

      if (data.ui_actions && data.ui_actions.length) {
        setTimeout(function () {
          executePortalActions(data.ui_actions);
        }, 550);
      }
    } catch (err) {
      isThinking = false;
      setOrbState(t().ui.readyState);
      appendMessage("ai", "Unable to reach ASTRA voice service right now. Please try again.");
      if (mySeq === chatSeq) afterSpeak();
    } finally {
      if (send) send.disabled = false;
    }
  }

  async function narrateTextWithGrok(text) {
    if (!text) return;
    setOrbState(t().ui.thinkingState);
    try {
      var resp = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          voice_id: currentVoice,
          lang: currentLang,
          speed: 1.04,
        }),
      });
      var data = await resp.json();
      var captionEl = document.getElementById("astraOrbCaption");
      if (captionEl) captionEl.textContent = text;
      if (data && data.audio_base64) {
        playGrokAudioPayload(data.audio_base64, data.audio_mime, text);
      } else {
        speakWebSpeechFallback(text);
      }
    } catch (e) {
      speakWebSpeechFallback(text);
    }
  }

  /* --------------------------------------------------------------------------
     Voice I/O: pick the right microphone and speaker, then take turns like a person
     --------------------------------------------------------------------------
     - The microphone is opened with getUserMedia on a device we choose, so ASTRA
       listens on a real, working mic instead of whatever the browser defaults to
       (often a virtual device left behind by a meeting app).
     - The speaker follows the microphone: a headset mic plays through the same
       headset, which also avoids ASTRA hearing itself.
     - One spoken turn is recorded and transcribed by Grok (/api/voice/stt). The
       browser's own speech recognition is the fallback when that is unavailable.
     - Hands-free mode listens again after each reply and lets the person interrupt. */
  var VOICE_TXT = {
    en: {
      mic: "Microphone", spk: "Speaker", auto: "Auto", sysDefault: "System default", handsFree: "Hands-free",
      transcribing: "TRANSCRIBING…", micOff: "MICROPHONE UNAVAILABLE",
      errDenied: "Microphone access is blocked. Allow it from the address bar, or type your question.",
      errNoMic: "No working microphone found. Connect one, or type your question.",
      errBusy: "The microphone is in use by another app. Close that app, or type your question.",
      errNetwork: "Speech recognition could not reach its service. Please type your question.",
      noSpeech: "I didn't catch anything. Tap the microphone and try again.",
      paused: "Hands-free paused. Tap the microphone when you are ready.",
      switched: "No sound from the first microphone, so I'm listening on {name}.",
      typeInstead: "This browser has no speech input. Type your question below.",
    },
    es: {
      mic: "Micrófono", spk: "Altavoz", auto: "Auto", sysDefault: "Predeterminado del sistema", handsFree: "Manos libres",
      transcribing: "TRANSCRIBIENDO…", micOff: "MICRÓFONO NO DISPONIBLE",
      errDenied: "El acceso al micrófono está bloqueado. Permítelo en la barra de direcciones o escribe tu pregunta.",
      errNoMic: "No encuentro un micrófono que funcione. Conecta uno o escribe tu pregunta.",
      errBusy: "Otra aplicación está usando el micrófono. Ciérrala o escribe tu pregunta.",
      errNetwork: "El reconocimiento de voz no pudo conectarse. Escribe tu pregunta.",
      noSpeech: "No he oído nada. Toca el micrófono e inténtalo de nuevo.",
      paused: "Manos libres en pausa. Toca el micrófono cuando quieras seguir.",
      switched: "El primer micrófono no daba señal; ahora escucho por {name}.",
      typeInstead: "Este navegador no admite entrada de voz. Escribe tu pregunta abajo.",
    },
    fr: {
      mic: "Microphone", spk: "Haut-parleur", auto: "Auto", sysDefault: "Par défaut du système", handsFree: "Mains libres",
      transcribing: "TRANSCRIPTION…", micOff: "MICROPHONE INDISPONIBLE",
      errDenied: "L'accès au microphone est bloqué. Autorisez-le dans la barre d'adresse ou tapez votre question.",
      errNoMic: "Aucun microphone fonctionnel trouvé. Branchez-en un ou tapez votre question.",
      errBusy: "Le microphone est utilisé par une autre application. Fermez-la ou tapez votre question.",
      errNetwork: "La reconnaissance vocale n'a pas pu joindre son service. Tapez votre question.",
      noSpeech: "Je n'ai rien entendu. Touchez le microphone et réessayez.",
      paused: "Mains libres en pause. Touchez le microphone pour reprendre.",
      switched: "Aucun son sur le premier microphone ; j'écoute maintenant sur {name}.",
      typeInstead: "Ce navigateur ne propose pas la saisie vocale. Tapez votre question ci-dessous.",
    },
    ja: {
      mic: "マイク", spk: "スピーカー", auto: "自動", sysDefault: "システムの既定", handsFree: "ハンズフリー",
      transcribing: "文字起こし中…", micOff: "マイクを使用できません",
      errDenied: "マイクへのアクセスがブロックされています。アドレスバーで許可するか、質問を入力してください。",
      errNoMic: "使用できるマイクが見つかりません。接続するか、質問を入力してください。",
      errBusy: "マイクが他のアプリで使用中です。そのアプリを閉じるか、質問を入力してください。",
      errNetwork: "音声認識サービスに接続できませんでした。質問を入力してください。",
      noSpeech: "聞き取れませんでした。マイクをタップしてもう一度お試しください。",
      paused: "ハンズフリーを一時停止しました。準備ができたらマイクをタップしてください。",
      switched: "最初のマイクから音が出ていないため、{name} で聞いています。",
      typeInstead: "このブラウザーは音声入力に対応していません。下に質問を入力してください。",
    },
    zh: {
      mic: "麦克风", spk: "扬声器", auto: "自动", sysDefault: "系统默认", handsFree: "免提对话",
      transcribing: "正在转写…", micOff: "麦克风不可用",
      errDenied: "麦克风权限被阻止。请在地址栏中允许，或直接输入问题。",
      errNoMic: "没有找到可用的麦克风。请连接麦克风，或直接输入问题。",
      errBusy: "麦克风正被其他应用占用。请关闭该应用，或直接输入问题。",
      errNetwork: "语音识别服务无法连接。请输入您的问题。",
      noSpeech: "我没有听到声音。请点击麦克风再试一次。",
      paused: "免提对话已暂停。准备好后请点击麦克风。",
      switched: "第一个麦克风没有声音，现在改用 {name} 收听。",
      typeInstead: "此浏览器不支持语音输入。请在下方输入问题。",
    },
    de: {
      mic: "Mikrofon", spk: "Lautsprecher", auto: "Auto", sysDefault: "Systemstandard", handsFree: "Freisprechen",
      transcribing: "TRANSKRIBIERE…", micOff: "MIKROFON NICHT VERFÜGBAR",
      errDenied: "Der Mikrofonzugriff ist blockiert. Erlauben Sie ihn in der Adressleiste oder tippen Sie Ihre Frage.",
      errNoMic: "Kein funktionierendes Mikrofon gefunden. Schließen Sie eines an oder tippen Sie Ihre Frage.",
      errBusy: "Das Mikrofon wird von einer anderen App verwendet. Schließen Sie diese oder tippen Sie Ihre Frage.",
      errNetwork: "Die Spracherkennung konnte ihren Dienst nicht erreichen. Bitte tippen Sie Ihre Frage.",
      noSpeech: "Ich habe nichts gehört. Tippen Sie auf das Mikrofon und versuchen Sie es erneut.",
      paused: "Freisprechen pausiert. Tippen Sie auf das Mikrofon, wenn Sie bereit sind.",
      switched: "Das erste Mikrofon lieferte keinen Ton, ich höre jetzt über {name}.",
      typeInstead: "Dieser Browser bietet keine Spracheingabe. Tippen Sie Ihre Frage unten ein.",
    },
  };

  function vt(key, name) {
    var d = VOICE_TXT[currentLang] || VOICE_TXT.en;
    return String(d[key] || VOICE_TXT.en[key] || "").replace("{name}", name || "");
  }

  /* Device knowledge. Labels are free text from the OS, so these are name patterns. */
  var VIRTUAL_RE = /blackhole|loopback|soundflower|vb-audio|vb-cable|cable (in|out)put|voicemeeter|virtual|aggregate|multi-output|zoomaudio|zoom audio|teams audio|microsoft teams|webex|ndi audio|\bobs\b|krisp|background music|stereo mix|what u hear|monitor of |eqmac|boom ?2/i;
  var HEADSET_RE = /airpods|headset|headphone|earbud|earphone|\bbuds\b|jabra|plantronics|\bpoly\b|bose|beats|sennheiser|hands-?free|wh-1000|wf-1000/i;
  var SPEAKERPHONE_RE = /speakerphone|jabra speak|poly sync|powerconf|emeet|conference/i;
  var EXTERNAL_MIC_RE = /\busb\b|yeti|r[oø]de|shure|snowball|samson|elgato|podcast|condenser|webcam|brio|camera/i;
  var BUILTIN_RE = /built-in|macbook|imac|internal|realtek|microphone array|laptop/i;
  var DISPLAY_RE = /display|monitor|hdmi|displayport|\btv\b/i;
  var PHONE_RE = /iphone|ipad/i;

  function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  var io = {
    micPref: lsGet("astra_mic_id") || "auto",
    spkPref: lsGet("astra_spk_id") || "auto",
    mics: [],
    speakers: [],
    stream: null,
    micSource: null,
    micAnalyser: null,
    micLabel: "",
    micGroupId: "",
    spkLabel: "",
    spkIsHeadset: false,
    canRouteOutput:
      (window.AudioContext && typeof window.AudioContext.prototype.setSinkId === "function") ||
      (window.HTMLMediaElement && typeof window.HTMLMediaElement.prototype.setSinkId === "function"),
  };
  var turn = { mode: "idle", viaServer: false, recorder: null, chunks: [], vadTimer: null, reason: "" };
  var handsFree = false;
  var silentTurns = 0;
  var sttReady = null;
  var chatSeq = 0;
  var bargeTimer = null;
  var playingVia = "";
  var STOP_WORDS = /^(stop|cancel|never ?mind|that'?s all|be quiet|para|basta|cancela|nada más|arrête|stop|annule|c'est tout|やめて|止めて|ストップ|もういい|停|停止|取消|不用了|stopp|abbrechen|das war'?s)[.!。！\s]*$/i;

  function cleanLabel(label) {
    return String(label || "")
      .replace(/^(default|communications|standard|predeterminado|par défaut)\s*[-–:]\s*/i, "")
      .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "")
      .replace(/\s*\((built-in|bluetooth|virtual)\)\s*$/i, "")
      .trim();
  }

  /* Turn enumerateDevices() output into real devices, marking the one the OS treats as default. */
  function normalizeDevices(all, kind) {
    var list = (all || []).filter(function (d) { return d.kind === kind; });
    var pseudoDefault = list.find(function (d) { return d.deviceId === "default"; });
    var real = list.filter(function (d) { return d.deviceId !== "default" && d.deviceId !== "communications"; });
    if (!real.length) real = list.slice(0, 1);
    return real.map(function (d, i) {
      var isDefault = pseudoDefault
        ? (!!d.groupId && d.groupId === pseudoDefault.groupId) || (!!d.label && String(pseudoDefault.label).slice(-d.label.length) === d.label)
        : i === 0;
      return { deviceId: d.deviceId, groupId: d.groupId || "", label: d.label || "", isDefault: isDefault };
    });
  }

  function scoreDevice(d, kind, ctx) {
    var label = d.label || "";
    if (!label) return d.isDefault ? 20 : 0;
    if (VIRTUAL_RE.test(label)) return -100;
    // The OS default is the person's own choice. It counts for more on the output side, where a
    // connected-but-unused headset is common; a headset mic still pulls its own earpieces (below).
    var s = d.isDefault ? (kind === "spk" ? 35 : 20) : 0;
    if (HEADSET_RE.test(label)) s += 30;
    else if (SPEAKERPHONE_RE.test(label)) s += 28;
    else if (kind === "mic" && EXTERNAL_MIC_RE.test(label)) s += 22;
    else if (BUILTIN_RE.test(label)) s += 15;
    else s += 10;
    if (PHONE_RE.test(label)) s -= 25;
    if (kind === "spk") {
      if (DISPLAY_RE.test(label)) s -= 12;
      // Keep a headset together: its mic and its earpieces, never its mic and the room speakers.
      if (ctx && ctx.micIsHeadset && ctx.micGroupId && d.groupId === ctx.micGroupId) s += 40;
    }
    return s;
  }

  /* Best first. Virtual devices sink to the bottom and are used only if nothing else exists. */
  function rankDevices(list, kind, ctx) {
    return (list || [])
      .map(function (d, i) { return { d: d, s: scoreDevice(d, kind, ctx), i: i }; })
      .sort(function (a, b) { return b.s - a.s || a.i - b.i; })
      .map(function (x) { return x.d; });
  }

  async function refreshDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      var all = await navigator.mediaDevices.enumerateDevices();
      io.mics = normalizeDevices(all, "audioinput");
      io.speakers = normalizeDevices(all, "audiooutput");
    } catch (e) {}
    renderDeviceUi();
  }

  async function applySpeaker() {
    var labelled = io.speakers.filter(function (d) { return d.label; });
    var target = null;
    if (io.spkPref !== "auto") target = io.speakers.find(function (d) { return d.deviceId === io.spkPref; }) || null;
    if (!target && labelled.length) {
      target = rankDevices(labelled, "spk", { micGroupId: io.micGroupId, micIsHeadset: HEADSET_RE.test(io.micLabel) })[0];
    }
    io.spkLabel = target ? cleanLabel(target.label) : "";
    io.spkIsHeadset = !!target && HEADSET_RE.test(target.label);
    if (io.canRouteOutput && target) {
      // "" keeps following the system default, so it tracks later changes made in the OS.
      var sink = target.isDefault && io.spkPref === "auto" ? "" : target.deviceId;
      try { if (audioCtx && audioCtx.setSinkId) await audioCtx.setSinkId(sink); } catch (e) {}
      try { if (audioEl && audioEl.setSinkId) await audioEl.setSinkId(sink); } catch (e) {}
    }
    renderDeviceUi();
  }

  function renderDeviceUi() {
    var micSel = document.getElementById("astraMicSelect");
    var spkSel = document.getElementById("astraSpkSelect");
    var hf = document.getElementById("astraHandsFreeBtn");
    function fill(sel, list, pref, picked, kindLabel) {
      if (!sel) return;
      var named = rankDevices(list.filter(function (d) { return d.label; }), sel === micSel ? "mic" : "spk");
      var html = '<option value="auto">' + escapeHtml(vt("auto") + (picked ? " · " + picked : "")) + "</option>";
      named.forEach(function (d) {
        html += '<option value="' + escapeHtml(d.deviceId) + '">' + escapeHtml(cleanLabel(d.label)) + "</option>";
      });
      sel.innerHTML = html;
      sel.value = pref !== "auto" && named.some(function (d) { return d.deviceId === pref; }) ? pref : "auto";
      sel.setAttribute("aria-label", kindLabel);
      sel.title = kindLabel + (picked ? ": " + picked : "");
    }
    fill(micSel, io.mics, io.micPref, io.micLabel, vt("mic"));
    fill(spkSel, io.speakers, io.spkPref, io.spkLabel, vt("spk"));
    if (spkSel && !io.canRouteOutput) {
      spkSel.innerHTML = '<option value="auto">' + escapeHtml(vt("sysDefault")) + "</option>";
      spkSel.disabled = true;
    }
    if (hf) {
      hf.textContent = vt("handsFree");
      hf.setAttribute("aria-pressed", handsFree ? "true" : "false");
    }
  }

  function openMicStream(deviceId) {
    var audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 };
    if (deviceId) audio.deviceId = { exact: deviceId };
    return navigator.mediaDevices.getUserMedia({ audio: audio });
  }

  function stopStream(stream) {
    try { stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) {}
  }

  function trackMatches(track, dev) {
    var st = {};
    try { st = track.getSettings() || {}; } catch (e) {}
    if (st.deviceId && st.deviceId === dev.deviceId) return true;
    if (st.deviceId === "default" && dev.isDefault) return true;
    return !!dev.label && String(track.label || "").slice(-dev.label.length) === dev.label;
  }

  /* A real microphone always has a noise floor. Exact digital silence for half a second
     means the device is muted at the source, unplugged, or a virtual cable with no input. */
  function micIsAlive(stream) {
    return new Promise(function (resolve) {
      var track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== "live") return resolve(false);
      // Without a running audio graph the level cannot be measured, so give the device the benefit of the doubt.
      if (!audioCtx || audioCtx.state !== "running") return resolve(true);
      var src, an;
      try {
        src = audioCtx.createMediaStreamSource(stream);
        an = audioCtx.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
      } catch (e) { return resolve(true); }
      var buf = new Float32Array(an.fftSize);
      var peak = 0;
      var ticks = 0;
      var timer = setInterval(function () {
        an.getFloatTimeDomainData(buf);
        for (var i = 0; i < buf.length; i++) { var v = Math.abs(buf[i]); if (v > peak) peak = v; }
        ticks += 1;
        if (peak > 0 || ticks >= 10) {
          clearInterval(timer);
          try { src.disconnect(); } catch (e) {}
          resolve(peak > 0 && !track.muted);
        }
      }, 50);
    });
  }

  async function acquireMic() {
    if (io.stream && io.stream.active) return io.stream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      var unsupported = new Error("getUserMedia unavailable");
      unsupported.name = "NotSupportedError";
      throw unsupported;
    }
    ensureAudioGraph();
    var stream;
    try {
      stream = await openMicStream(io.micPref !== "auto" ? io.micPref : "");
    } catch (err) {
      // A remembered device that has since been unplugged: fall back to choosing automatically.
      if (io.micPref !== "auto" && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) {
        io.micPref = "auto";
        lsSet("astra_mic_id", "auto");
        stream = await openMicStream("");
      } else {
        throw err;
      }
    }
    await refreshDevices(); // device names are only visible once permission is granted

    var switchedFrom = "";
    if (io.micPref === "auto") {
      var candidates = rankDevices(io.mics.filter(function (d) { return d.label; }), "mic").slice(0, 4);
      var firstChoice = stream;
      var settled = false;
      for (var i = 0; i < candidates.length && !settled; i++) {
        var cand = candidates[i];
        var current = stream.getAudioTracks()[0];
        if (!trackMatches(current, cand)) {
          var next = null;
          try { next = await openMicStream(cand.deviceId); } catch (e) { next = null; }
          if (!next) continue;
          if (stream !== firstChoice) stopStream(stream);
          stream = next;
        }
        if (await micIsAlive(stream)) settled = true;
        else if (!switchedFrom) switchedFrom = cleanLabel(cand.label);
      }
      if (!settled && stream !== firstChoice) {
        // Nothing produced a signal: go back to the browser's own choice rather than a guess.
        stopStream(stream);
        stream = firstChoice;
        switchedFrom = "";
      } else if (stream !== firstChoice) {
        stopStream(firstChoice);
      }
    }

    var track = stream.getAudioTracks()[0];
    var settings = {};
    try { settings = track.getSettings() || {}; } catch (e) {}
    var matched = io.mics.find(function (d) { return trackMatches(track, d); });
    io.stream = stream;
    io.micLabel = cleanLabel((matched && matched.label) || track.label);
    io.micGroupId = (matched && matched.groupId) || settings.groupId || "";
    try {
      io.micSource = audioCtx.createMediaStreamSource(stream);
      io.micAnalyser = audioCtx.createAnalyser();
      io.micAnalyser.fftSize = 1024;
      io.micSource.connect(io.micAnalyser); // analysis only: the mic is never routed to the speakers
    } catch (e) {
      io.micAnalyser = null;
    }
    track.addEventListener("ended", function () {
      // Unplugged mid-conversation: drop it, and pick again on the next turn.
      if (io.stream === stream) releaseMic();
      if (turn.mode === "listening") { cancelListening(); if (handsFree) startListening(); }
    });
    await applySpeaker();
    if (switchedFrom && switchedFrom !== io.micLabel) setCaption(vt("switched", io.micLabel));
    return stream;
  }

  function releaseMic() {
    if (io.micSource) { try { io.micSource.disconnect(); } catch (e) {} }
    io.micSource = null;
    io.micAnalyser = null;
    if (io.stream) stopStream(io.stream);
    io.stream = null;
    setMicLevel(0);
  }

  function setMicLevel(rms) {
    var btn = document.getElementById("astraMicBtn");
    if (btn) btn.style.setProperty("--mic-level", Math.min(1, rms * 9).toFixed(3));
  }

  function setCaption(text) {
    var el = document.getElementById("astraOrbCaption");
    if (el) el.textContent = text;
  }

  function micRms(buf) {
    if (!io.micAnalyser) return 0;
    io.micAnalyser.getFloatTimeDomainData(buf);
    var sum = 0;
    for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  function reportMicError(err) {
    var name = (err && err.name) || "";
    var msg = vt("errNoMic");
    if (name === "NotAllowedError" || name === "SecurityError") msg = vt("errDenied");
    else if (name === "NotReadableError" || name === "AbortError") msg = vt("errBusy");
    else if (name === "NotSupportedError") msg = vt("typeInstead");
    setOrbState(vt("micOff"));
    setCaption(msg);
    handsFree = false;
    renderDeviceUi();
    var inp = document.getElementById("astraGdInput");
    if (inp) inp.focus();
  }

  async function checkSttReady() {
    if (sttReady !== null) return sttReady;
    try {
      var resp = await fetch("/api/voice/status");
      var data = await resp.json();
      sttReady = !!(data && data.stt_ready);
    } catch (e) {
      sttReady = false;
    }
    return sttReady;
  }

  function stopSpeaking() {
    if (bargeTimer) { clearInterval(bargeTimer); bargeTimer = null; }
    playingVia = "";
    try { if (audioEl && !audioEl.paused) audioEl.pause(); } catch (e) {}
    synthSeq += 1;
    try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch (e) {}
    isSpeaking = false;
  }

  /* While ASTRA talks in hands-free mode, a person who starts speaking takes the floor. */
  function watchForBargeIn() {
    if (bargeTimer) { clearInterval(bargeTimer); bargeTimer = null; }
    // Browser speech synthesis bypasses echo cancellation, so on open speakers ASTRA would interrupt itself.
    if (!handsFree || !io.micAnalyser || (playingVia !== "element" && !io.spkIsHeadset)) return;
    var buf = new Float32Array(io.micAnalyser.fftSize);
    var loudMs = 0;
    var floor = 0.01;
    bargeTimer = setInterval(function () {
      if (!isSpeaking || !handsFree || !io.micAnalyser) { clearInterval(bargeTimer); bargeTimer = null; return; }
      var rms = micRms(buf);
      if (rms > Math.max(floor * 5, 0.05)) loudMs += 50;
      else { loudMs = Math.max(0, loudMs - 50); floor = floor * 0.95 + rms * 0.05; }
      if (loudMs >= 300) { stopSpeaking(); startListening(); }
    }, 50);
  }

  /* Called once ASTRA has finished a reply (or has nothing to say aloud). */
  function afterSpeak() {
    if (bargeTimer) { clearInterval(bargeTimer); bargeTimer = null; }
    playingVia = "";
    var drawer = document.getElementById("astraGrokDrawer");
    if (handsFree && drawer && !drawer.hidden && turn.mode === "idle" && !isThinking) startListening();
    else if (!handsFree && turn.mode === "idle") releaseMic();
  }

  function setListeningUi(on) {
    isListening = on;
    var micBtn = document.getElementById("astraMicBtn");
    if (micBtn) {
      micBtn.classList.toggle("is-listening", on);
      micBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (!on) setMicLevel(0);
  }

  async function startListening() {
    if (turn.mode !== "idle") return;
    stopSpeaking();
    turn.mode = "listening";
    turn.viaServer = false;
    turn.reason = "";
    setListeningUi(true);
    setOrbState(t().ui.listeningState);
    var stream;
    try {
      stream = await acquireMic();
    } catch (err) {
      turn.mode = "idle";
      setListeningUi(false);
      reportMicError(err);
      return;
    }
    if (turn.mode !== "listening") return; // cancelled while the permission prompt was open
    var useServer = (await checkSttReady()) && !!window.MediaRecorder;
    if (turn.mode !== "listening") return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!useServer && !SR) {
      cancelListening();
      releaseMic();
      setCaption(vt("typeInstead"));
      var inp = document.getElementById("astraGdInput");
      if (inp) inp.focus();
      return;
    }
    playQuindar(2525);
    // Start just after the cue tone so the tone is neither recorded nor mistaken for speech.
    setTimeout(function () {
      if (turn.mode !== "listening") return;
      if (useServer) startRecorder(stream);
      else startRecognition(SR, stream);
      startVad();
    }, 170);
  }

  function startVad() {
    var buf = io.micAnalyser ? new Float32Array(io.micAnalyser.fftSize) : null;
    var startedAt = Date.now();
    var lastVoiceAt = 0;
    var voiceMs = 0;
    var floor = 0.004;
    var blind = !buf || !audioCtx || audioCtx.state !== "running"; // no level data: cannot detect speech
    turn.speechStarted = false;
    turn.startedAt = startedAt;
    if (turn.vadTimer) clearInterval(turn.vadTimer);
    turn.vadTimer = setInterval(function () {
      if (turn.mode !== "listening") { clearInterval(turn.vadTimer); turn.vadTimer = null; return; }
      var now = Date.now();
      var rms = buf ? micRms(buf) : 0;
      setMicLevel(rms);
      if (rms > Math.max(floor * 3.2, 0.014)) {
        voiceMs += 50;
        lastVoiceAt = now;
        if (voiceMs >= 150) turn.speechStarted = true;
      } else if (!turn.speechStarted) {
        voiceMs = Math.max(0, voiceMs - 25);
        floor = floor * 0.9 + rms * 0.1; // learn the room before the person speaks
      }
      if (!turn.viaServer) return; // the browser recogniser decides its own end of speech
      var elapsed = now - startedAt;
      if (blind) { if (elapsed > 8000) finishListening("manual"); return; } // send what was recorded
      if (turn.speechStarted && now - lastVoiceAt > 950) finishListening("endpoint");
      else if (!turn.speechStarted && elapsed > 7000) finishListening("no-speech");
      else if (elapsed > 30000) finishListening("max");
    }, 50);
  }

  function startRecorder(stream) {
    var types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    var mime = types.filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0] || "";
    var rec;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 }) : new MediaRecorder(stream);
    } catch (e) {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) startRecognition(SR, stream);
      else cancelListening();
      return;
    }
    turn.viaServer = true;
    turn.recorder = rec;
    turn.chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) turn.chunks.push(e.data); };
    rec.onstop = function () {
      var blob = new Blob(turn.chunks, { type: rec.mimeType || mime || "audio/webm" });
      turn.recorder = null;
      turn.chunks = [];
      handleRecording(blob);
    };
    rec.start(250);
  }

  async function handleRecording(blob) {
    var reason = turn.reason;
    var heard = turn.speechStarted || (reason === "manual" && Date.now() - turn.startedAt > 700);
    if (reason === "cancel") { turn.mode = "idle"; return; }
    if (!heard || blob.size < 1200) { turn.mode = "idle"; return onNoSpeech(); }
    turn.mode = "transcribing";
    setOrbState(vt("transcribing"));
    var result = null;
    try {
      var resp = await fetch("/api/voice/stt?lang=" + encodeURIComponent(currentLang), {
        method: "POST",
        headers: { "Content-Type": (blob.type || "audio/webm").split(";")[0] },
        body: blob,
      });
      result = await resp.json();
    } catch (e) {
      result = null;
    }
    turn.mode = "idle";
    if (!result || !result.ok) {
      // Grok transcription is down: use the browser recogniser from the next turn on.
      sttReady = false;
      return onNoSpeech();
    }
    var text = String(result.text || "").trim();
    if (!text) return onNoSpeech();
    dispatchTranscript(text, { confidence: result.confidence, language: result.language });
  }

  function startRecognition(SR, stream) {
    var finalTranscript = "";
    var confidence = null;
    var retried = false;
    var failed = "";
    function begin(withTrack) {
      recognition = new SR();
      var langObj = LANGS.find(function (l) { return l.code === currentLang; }) || LANGS[0];
      recognition.lang = langObj.bcp47;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = function (evt) {
        var interim = "";
        for (var i = evt.resultIndex; i < evt.results.length; i++) {
          var alt = evt.results[i][0];
          if (evt.results[i].isFinal) {
            finalTranscript += alt.transcript + " ";
            if (alt.confidence > 0) confidence = alt.confidence;
          } else {
            interim += alt.transcript;
          }
        }
        turn.speechStarted = true;
        var inp = document.getElementById("astraGdInput");
        if (inp) inp.value = (finalTranscript + interim).trim();
      };
      recognition.onerror = function (evt) {
        var code = (evt && evt.error) || "";
        // Some browsers reject a supplied track; try once more on their own default input.
        if (withTrack && !retried && (code === "audio-capture" || code === "service-not-allowed")) {
          retried = true;
          recognition.onend = null;
          begin(false);
          return;
        }
        failed = code;
      };
      recognition.onend = function () {
        if (turn.mode !== "listening") return;
        var cancelled = turn.reason === "cancel";
        turn.mode = "idle";
        setListeningUi(false);
        if (turn.vadTimer) { clearInterval(turn.vadTimer); turn.vadTimer = null; }
        if (cancelled) return;
        playQuindar(2475);
        if (failed === "not-allowed" || failed === "service-not-allowed") return reportMicError({ name: "NotAllowedError" });
        if (failed === "audio-capture") return reportMicError({ name: "NotFoundError" });
        if (failed === "network") { setOrbState(vt("micOff")); setCaption(vt("errNetwork")); handsFree = false; renderDeviceUi(); releaseMic(); return; }
        var text = (finalTranscript || (document.getElementById("astraGdInput") || {}).value || "").trim();
        if (!text) return onNoSpeech();
        dispatchTranscript(text, { confidence: confidence, language: "" });
      };
      var track = withTrack && stream ? stream.getAudioTracks()[0] : null;
      try {
        // Where the browser supports it, recognise from the microphone we chose rather than its default.
        if (track) recognition.start(track);
        else recognition.start();
      } catch (e) {
        if (track && !retried) { retried = true; begin(false); }
        else { failed = "audio-capture"; recognition.onend(); }
      }
    }
    begin(true);
  }

  /* End the current listening turn. reason: endpoint | no-speech | max | manual | cancel */
  function finishListening(reason) {
    if (turn.mode !== "listening") return;
    turn.reason = reason;
    if (turn.vadTimer) { clearInterval(turn.vadTimer); turn.vadTimer = null; }
    if (turn.viaServer && turn.recorder) {
      setListeningUi(false);
      if (reason !== "cancel") playQuindar(2475);
      try { turn.recorder.stop(); } catch (e) { turn.mode = "idle"; }
    } else if (recognition) {
      try { if (reason === "cancel") recognition.abort(); else recognition.stop(); } catch (e) {}
      if (reason === "cancel") { turn.mode = "idle"; setListeningUi(false); }
    } else {
      turn.mode = "idle";
      setListeningUi(false);
    }
  }

  function cancelListening() {
    if (turn.mode === "listening") finishListening("cancel");
    if (turn.mode !== "transcribing") turn.mode = "idle";
    setListeningUi(false);
  }

  function onNoSpeech() {
    setListeningUi(false);
    silentTurns += 1;
    if (handsFree && silentTurns < 2) return startListening();
    if (handsFree) {
      handsFree = false;
      renderDeviceUi();
      setCaption(vt("paused"));
    } else {
      setCaption(vt("noSpeech"));
    }
    setOrbState(t().ui.readyState);
    releaseMic();
  }

  function dispatchTranscript(text, meta) {
    silentTurns = 0;
    var inp = document.getElementById("astraGdInput");
    if (inp) inp.value = text;
    if (STOP_WORDS.test(text)) {
      // "Stop" ends the conversation loop; it is not a question for the model.
      handsFree = false;
      renderDeviceUi();
      if (inp) inp.value = "";
      setOrbState(t().ui.readyState);
      releaseMic();
      return;
    }
    // A visitor who speaks another supported language gets the answer in that language.
    var spoken = meta && meta.language;
    var longEnough = text.split(/\s+/).length >= 4 || (/[぀-ヿ一-鿿]/.test(text) && text.length >= 6);
    var replyLang = spoken && I18N[spoken] && spoken !== currentLang && longEnough ? spoken : currentLang;
    sendVoiceChat(text, { inputMode: "voice", confidence: meta ? meta.confidence : null, lang: replyLang });
  }

  function toggleMic() {
    if (turn.mode === "listening") return finishListening("manual");
    if (turn.mode === "transcribing") return;
    silentTurns = 0;
    startListening();
  }

  function toggleHandsFree() {
    handsFree = !handsFree;
    silentTurns = 0;
    renderDeviceUi();
    if (handsFree) {
      if (turn.mode === "idle" && !isThinking) startListening();
    } else {
      cancelListening();
      if (!isSpeaking) releaseMic();
    }
  }

  function initVoiceIo() {
    refreshDevices().then(function () {
      // Names are already visible when permission was granted on an earlier visit.
      if (io.speakers.some(function (d) { return d.label; })) applySpeaker();
    });
  }

  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    var deviceChangeTimer = null;
    navigator.mediaDevices.addEventListener("devicechange", function () {
      clearTimeout(deviceChangeTimer);
      deviceChangeTimer = setTimeout(function () {
        // Headphones plugged in or pulled out: re-pick the speaker now, and the mic on the next turn.
        refreshDevices().then(function () {
          if (io.micPref === "auto" && turn.mode === "idle" && !handsFree) releaseMic();
          applySpeaker();
        });
      }, 400);
    });
  }

  window.ASTRAVoice = { rankDevices: rankDevices, normalizeDevices: normalizeDevices, cleanLabel: cleanLabel, io: io };

  /* --------------------------------------------------------------------------
     DOM Builders
     -------------------------------------------------------------------------- */
  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setOrbState(text) {
    var el = document.getElementById("astraOrbState");
    if (el) el.textContent = text;
  }

  function buildLangPickerHtml(extraClass) {
    var opts = LANGS.map(function (l) {
      return (
        '<option value="' +
        l.code +
        '"' +
        (l.code === currentLang ? " selected" : "") +
        ">" +
        l.short +
        " · " +
        l.label +
        "</option>"
      );
    }).join("");
    return (
      '<span class="astra-lang-wrap ' +
      (extraClass || "") +
      '" title="Switch language">' +
      '<span aria-hidden="true">🌐</span>' +
      '<select class="astra-lang-select" aria-label="Language">' +
      opts +
      "</select></span>"
    );
  }

  function appendMessage(role, text, actions, citations) {
    var box = document.getElementById("astraGdMessages");
    if (!box) return;
    var div = document.createElement("div");
    div.className = "astra-msg " + (role === "user" ? "astra-msg-user" : "astra-msg-ai");
    var html = "<div>" + escapeHtml(text) + "</div>";
    var tags = "";
    if (Array.isArray(actions) && actions.length) {
      tags += actions
        .map(function (a) {
          return '<span class="astra-tag-pill">⚡ ' + escapeHtml(a.target) + "</span>";
        })
        .join("");
    }
    if (Array.isArray(citations) && citations.length) {
      tags += citations
        .slice(0, 2)
        .map(function (c) {
          return '<span class="astra-tag-pill is-cite">📚 ' + escapeHtml(c) + "</span>";
        })
        .join("");
    }
    if (tags) html += '<div class="astra-msg-tags">' + tags + "</div>";
    div.innerHTML = html;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function renderQuickChips() {
    var wrap = document.getElementById("astraGdChips");
    if (!wrap) return;
    var chips = t().ui.chips;
    wrap.innerHTML = "";
    chips.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "astra-chip-btn";
      btn.textContent = c.label;
      btn.addEventListener("click", function () {
        sendVoiceChat(c.prompt);
      });
      wrap.appendChild(btn);
    });
  }

  function openDrawer(focusInput) {
    var drawer = document.getElementById("astraGrokDrawer");
    var launcher = document.getElementById("astraGrokLauncher");
    if (drawer) drawer.hidden = false;
    if (launcher) launcher.hidden = true;
    ensureAudioGraph();
    initVoiceIo();
    if (focusInput) {
      var inp = document.getElementById("astraGdInput");
      if (inp) inp.focus();
    }
  }

  function closeDrawer() {
    var drawer = document.getElementById("astraGrokDrawer");
    var launcher = document.getElementById("astraGrokLauncher");
    if (drawer) drawer.hidden = true;
    if (launcher) launcher.hidden = false;
    // Minimised means not listening: stop the turn and switch the microphone off.
    handsFree = false;
    cancelListening();
    releaseMic();
    renderDeviceUi();
  }

  function mountTopNavigation() {
    if (pageKind === "journey") {
      var bar = document.querySelector("header.bar");
      if (!bar) return;
      var oldLaunch = bar.querySelector('a[href*="demo"]');
      if (oldLaunch) oldLaunch.remove();
      var nav = document.createElement("nav");
      nav.className = "astra-nav-pills";
      nav.setAttribute("aria-label", "Portal views");
      nav.innerHTML =
        '<a class="astra-pill-link is-active" href="#distance" data-i18n-key="dock.story">' + t().dock.story + "</a>" +
        '<a class="astra-pill-link is-amber" href="/?tab=demo" data-i18n-key="dock.demo">' + t().dock.demo + "</a>" +
        '<a class="astra-pill-link" href="/" data-i18n-key="dock.studio">' + t().dock.studio + "</a>" +
        '<button type="button" class="astra-pill-link astra-hide-md" id="astraDockFilmBtn">▶ <span data-i18n-key="dock.film">' + t().dock.film + "</span></button>";

      var right = document.createElement("div");
      right.className = "astra-bar-controls";
      right.innerHTML =
        buildLangPickerHtml("") +
        '<button type="button" class="astra-voice-nav-btn" id="astraTopVoiceBtn">' +
        '<span class="astra-orb-dot" aria-hidden="true"></span>' +
        '<span data-i18n-key="dock.grokPill">' + t().dock.grokPill + "</span></button>";

      bar.appendChild(nav);
      bar.appendChild(right);
      document.getElementById("astraDockFilmBtn").addEventListener("click", openFilmModal);
      document.getElementById("astraTopVoiceBtn").addEventListener("click", function () {
        openDrawer(true);
      });
    } else if (pageKind === "demo") {
      document.body.classList.add("astra-demo-page");
      var dock = document.createElement("nav");
      dock.className = "astra-demo-dock";
      dock.setAttribute("aria-label", "Portal views");
      dock.innerHTML =
        '<a class="astra-pill-link" href="/story" data-i18n-key="dock.story">' + t().dock.story + "</a>" +
        '<span class="astra-pill-link is-active" data-i18n-key="dock.demo">' + t().dock.demo + "</span>" +
        '<a class="astra-pill-link" href="/" data-i18n-key="dock.studio">' + t().dock.studio + "</a>" +
        buildLangPickerHtml("") +
        '<button type="button" class="astra-voice-nav-btn" id="astraTopVoiceBtn">' +
        '<span class="astra-orb-dot" aria-hidden="true"></span>' +
        '<span data-i18n-key="dock.grokPill">' + t().dock.grokPill + "</span></button>";
      document.body.appendChild(dock);
      document.getElementById("astraTopVoiceBtn").addEventListener("click", function () {
        openDrawer(true);
      });

      // Add "Narrate with Grok" button right in the guided demo actions bar
      var coachActions = document.querySelector(".coach-actions");
      if (coachActions) {
        var nb = document.createElement("button");
        nb.type = "button";
        nb.className = "astra-narrate-btn";
        nb.id = "astraDemoNarrateBtn";
        nb.setAttribute("aria-pressed", "false");
        nb.textContent = t().dock.narrate;
        coachActions.appendChild(nb);
        nb.addEventListener("click", function () {
          demoNarrate = !demoNarrate;
          nb.setAttribute("aria-pressed", demoNarrate ? "true" : "false");
          nb.textContent = demoNarrate ? t().dock.narrating : t().dock.narrate;
          ensureAudioGraph();
          if (demoNarrate) {
            var title = (document.getElementById("cT") || {}).textContent || "";
            var body = (document.getElementById("cB") || {}).textContent || "";
            if (title || body) narrateTextWithGrok(title + ". " + body);
          }
        });

        var cTitle = document.getElementById("cT");
        var cBody = document.getElementById("cB");
        if (cTitle && cBody) {
          var obs = new MutationObserver(function () {
            if (!demoNarrate) return;
            var key = cTitle.textContent + "|" + cBody.textContent;
            if (key && key !== lastNarratedKey) {
              lastNarratedKey = key;
              narrateTextWithGrok(cTitle.textContent + ". " + cBody.textContent);
            }
          });
          obs.observe(cTitle, { childList: true, characterData: true, subtree: true });
          obs.observe(cBody, { childList: true, characterData: true, subtree: true });
        }
      }
    } else if (pageKind === "studio") {
      var slot = document.getElementById("astraStudioLangSlot");
      if (slot) {
        slot.innerHTML =
          buildLangPickerHtml("") +
          ' <button type="button" class="astra-voice-nav-btn" id="astraTopVoiceBtn">' +
          '<span class="astra-orb-dot" aria-hidden="true"></span>' +
          '<span data-i18n-key="dock.grokPill">' + t().dock.grokPill + "</span></button>";
        document.getElementById("astraTopVoiceBtn").addEventListener("click", function () {
          openDrawer(true);
        });
      }
      // Handle deep-link scenario param (e.g., /studio?scenario=spe_blackout)
      var sc = new URLSearchParams(location.search).get("scenario");
      if (sc) {
        setTimeout(function () {
          var sel = document.getElementById("scenarioSelect");
          if (sel) {
            sel.value = sc;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, 600);
      }
    }
  }

  function mountFloatingCopilot() {
    var launcher = document.createElement("button");
    launcher.type = "button";
    launcher.id = "astraGrokLauncher";
    launcher.className = "astra-grok-launcher";
    launcher.innerHTML =
      '<span class="astra-mini-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
      '<span data-i18n-key="dock.askBtn">' + t().dock.askBtn + "</span>";
    launcher.addEventListener("click", function () {
      openDrawer(true);
    });
    document.body.appendChild(launcher);

    var drawer = document.createElement("aside");
    drawer.id = "astraGrokDrawer";
    drawer.className = "astra-grok-drawer";
    drawer.hidden = true;
    drawer.setAttribute("aria-label", "ASTRA voice assistant");
    drawer.innerHTML =
      '<div class="astra-gd-head">' +
        '<div class="astra-gd-title">' +
          '<span class="astra-orb-dot" aria-hidden="true"></span>' +
          '<strong id="astraGdTitle">' + escapeHtml(t().ui.title) + "</strong>" +
          '<span class="astra-gd-badge" id="astraGdBadge">' + escapeHtml(t().ui.badgeLive) + "</span>" +
        "</div>" +
        '<div class="astra-gd-actions">' +
          '<button type="button" class="astra-gd-iconbtn" id="astraMuteBtn" title="Toggle voice playback" aria-pressed="true">🔊</button>' +
          '<button type="button" class="astra-gd-iconbtn" id="astraDrawerClose" title="Minimize" aria-label="Minimize">✕</button>' +
        "</div>" +
      "</div>" +
      '<div class="astra-gd-controls">' +
        '<select id="astraVoiceSelect" class="astra-gd-select" aria-label="Voice">' +
          VOICES.map(function (v) {
            return '<option value="' + v.id + '"' + (v.id === currentVoice ? " selected" : "") + ">" + v.label + "</option>";
          }).join("") +
        "</select>" +
        buildLangPickerHtml("") +
      "</div>" +
      '<div class="astra-gd-io">' +
        '<label class="astra-io-field">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/></svg>' +
          '<select id="astraMicSelect" class="astra-gd-select" aria-label="Microphone"><option value="auto">Auto</option></select>' +
        "</label>" +
        '<label class="astra-io-field">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>' +
          '<select id="astraSpkSelect" class="astra-gd-select" aria-label="Speaker"><option value="auto">Auto</option></select>' +
        "</label>" +
        '<button type="button" class="astra-hf-btn" id="astraHandsFreeBtn" aria-pressed="false" title="Keep listening after each reply; speak to interrupt">Hands-free</button>' +
      "</div>" +
      '<div class="astra-orb-stage">' +
        '<canvas id="astraVoiceCanvas" aria-hidden="true"></canvas>' +
        '<div class="astra-orb-meta">' +
          '<span class="astra-orb-state" id="astraOrbState">' + escapeHtml(t().ui.readyState) + "</span>" +
          '<p class="astra-orb-caption" id="astraOrbCaption">' + escapeHtml(t().ui.welcome) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="astra-gd-chips" id="astraGdChips"></div>' +
      '<div class="astra-gd-messages" id="astraGdMessages" aria-live="polite"></div>' +
      '<form class="astra-gd-form" id="astraGdForm">' +
        '<button type="button" class="astra-mic-btn" id="astraMicBtn" title="Speak with crew microphone" aria-label="Speak">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>' +
        "</button>" +
        '<input type="text" id="astraGdInput" class="astra-gd-input" autocomplete="off" placeholder="' + escapeHtml(t().ui.placeholder) + '">' +
        '<button type="submit" id="astraGdSend" class="astra-send-btn">' + escapeHtml(t().ui.send) + "</button>" +
      "</form>";

    document.body.appendChild(drawer);

    document.getElementById("astraDrawerClose").addEventListener("click", closeDrawer);
    document.getElementById("astraMuteBtn").addEventListener("click", function () {
      autoSpeak = !autoSpeak;
      this.textContent = autoSpeak ? "🔊" : "🔇";
      this.setAttribute("aria-pressed", autoSpeak ? "true" : "false");
      if (!autoSpeak) { stopSpeaking(); afterSpeak(); }
    });
    document.getElementById("astraVoiceSelect").addEventListener("change", function () {
      currentVoice = this.value;
      try { localStorage.setItem("astra_voice_id", currentVoice); } catch (e) {}
    });
    document.getElementById("astraMicBtn").addEventListener("click", toggleMic);
    document.getElementById("astraHandsFreeBtn").addEventListener("click", toggleHandsFree);
    document.getElementById("astraMicSelect").addEventListener("change", function () {
      io.micPref = this.value;
      lsSet("astra_mic_id", io.micPref);
      var wasListening = turn.mode === "listening";
      cancelListening();
      releaseMic();
      if (io.micPref === "auto") io.micLabel = "";
      renderDeviceUi();
      if (wasListening || handsFree) startListening();
    });
    document.getElementById("astraSpkSelect").addEventListener("change", function () {
      io.spkPref = this.value;
      lsSet("astra_spk_id", io.spkPref);
      ensureAudioGraph();
      // A short tone on the new output, so the person hears where ASTRA will speak.
      applySpeaker().then(function () { playQuindar(2525); });
    });
    renderDeviceUi();
    document.getElementById("astraGdForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var val = document.getElementById("astraGdInput").value;
      sendVoiceChat(val);
    });

    // Global delegated listener for all language selectors
    document.addEventListener("change", function (e) {
      if (e.target && e.target.classList && e.target.classList.contains("astra-lang-select")) {
        applyLanguage(e.target.value);
      }
    });

    appendMessage("ai", t().ui.welcome);
    renderQuickChips();
    startOrbCanvasLoop(document.getElementById("astraVoiceCanvas"));

    // Keyboard shortcut Cmd/Ctrl+J or M to toggle voice drawer gracefully
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (drawer.hidden) openDrawer(true);
        else closeDrawer();
      }
    });
  }

  function init() {
    mountTopNavigation();
    mountFloatingCopilot();
    if (currentLang !== "en") applyLanguage(currentLang);
    // Keep the workstation and the embedded Watch + iPhone tab in the same language.
    window.addEventListener("storage", function (e) {
      if (e.key === "astra_lang" && e.newValue && e.newValue !== currentLang) applyLanguage(e.newValue);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
