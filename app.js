/**
 * StudyAgent.AI — UI Controller & State Manager
 */

(function () {
  'use strict';

  // State Management
  const state = {
    currentTab: 'chat-tab',
    deck: [],
    currentCardIndex: 0,
    isCardFlipped: false,
    quizQuestions: [],
    quizAnswers: {}, // { questionId: { selectedIndex, isCorrect } }
    studyPlan: null,
    notesMarkdown: '',
    pomodoro: {
      durationMinutes: 25,
      secondsLeft: 25 * 60,
      isRunning: false,
      intervalId: null,
      mode: 'Study',
      completedSessions: 0,
      totalMinutes: 0
    },
    stats: {
      cardsCount: 0,
      cardsMastered: 0,
      quizzesTaken: 0,
      quizScoreTotal: 0,
      tasksDone: 0,
      focusMinutes: 0
    }
  };

  let agent;

  // Web Audio Context for Chimes & Feedback
  let audioCtx = null;
  function playSound(type = 'chime') {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'chime') {
        // High pleasant ding
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      } else if (type === 'correct') {
        // Success chord
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(160, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      console.log('Audio feedback not supported or muted');
    }
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    agent = new StudyAgent();
    loadStateFromStorage();
    initNavigation();
    initChat();
    initFlashcards();
    initQuiz();
    initPlanner();
    initNotes();
    initPomodoro();
    initSettings();
    initTheme();
    updateBadgesAndStats();
    updateEngineBadge();

    // Check if initial empty state needs sample data
    if (state.deck.length === 0 && state.quizQuestions.length === 0) {
      loadInitialPreset();
    }
  });

  function loadInitialPreset() {
    // Populate an initial default lesson on Mitosis so student sees rich workspace on load
    const demoAnalysis = {
      domain: 'biology',
      topic: 'Cell Mitosis & Cell Division',
      isProblemOrFormula: false,
      rawPrompt: 'Mitosis and cell division'
    };

    state.deck = agent.tools.create_flashcards(demoAnalysis);
    state.quizQuestions = agent.tools.generate_quiz(demoAnalysis);
    state.studyPlan = agent.tools.generate_study_plan(demoAnalysis);
    state.notesMarkdown = agent.tools.take_notes(demoAnalysis, null);

    renderFlashcardViewer();
    renderQuizArena();
    renderPlanner();
    renderNotes();
    updateBadgesAndStats();
    saveStateToStorage();

    // Update mission in sidebar
    document.getElementById('sidebar-mission-topic').textContent = 'Cell Mitosis';
    document.getElementById('sidebar-mission-desc').textContent = 'Active recall deck & 3-question diagnostic loaded.';
  }

  // ==========================================================================
  // NAVIGATION & TABS
  // ==========================================================================
  function initNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });
  }

  function switchTab(tabId) {
    state.currentTab = tabId;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      const match = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });

    if (tabId === 'flashcards-tab') renderFlashcardViewer();
    if (tabId === 'quiz-tab') renderQuizArena();
    if (tabId === 'planner-tab') renderPlanner();
    if (tabId === 'notes-tab') renderNotes();
  }

  // ==========================================================================
  // COPILOT CHAT & REACT STREAMING
  // ==========================================================================
  function initChat() {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('student-input');
    const clearBtn = document.getElementById('btn-clear-chat');
    const chips = document.querySelectorAll('.chip-btn');

    // Quick prompt chips
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        input.value = prompt;
        form.dispatchEvent(new Event('submit'));
      });
    });

    // Clear chat
    clearBtn.addEventListener('click', () => {
      const stream = document.getElementById('messages-stream');
      stream.innerHTML = `
        <div class="message-card agent-message">
          <div class="message-header">
            <div class="agent-avatar">🤖</div>
            <div class="agent-meta">
              <span class="agent-name">StudyAgent Copilot</span>
              <span class="agent-time">Online</span>
            </div>
            <span class="agent-role-pill">Chat Cleared</span>
          </div>
          <div class="message-body">
            <p>Chat cleared! Ready for your next study topic or problem.</p>
          </div>
        </div>
      `;
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prompt = input.value.trim();
      if (!prompt) return;

      input.value = '';
      input.style.height = 'auto';

      // 1. Append User Message
      appendUserMessage(prompt);

      // 2. Prepare Tools toggles
      const toolToggles = {
        flashcards: document.getElementById('tool-opt-flashcards').checked,
        quiz: document.getElementById('tool-opt-quiz').checked,
        plan: document.getElementById('tool-opt-plan').checked,
        notes: document.getElementById('tool-opt-notes').checked
      };

      // 3. Create Live Agent Card with Accordion
      const agentCard = createAgentStreamingCard();
      const messagesStream = document.getElementById('messages-stream');
      messagesStream.appendChild(agentCard.el);
      messagesStream.scrollTop = messagesStream.scrollHeight;

      // Update active mission display in sidebar
      document.getElementById('sidebar-mission-topic').textContent = prompt.slice(0, 32) + (prompt.length > 32 ? '...' : '');
      document.getElementById('sidebar-mission-desc').textContent = 'Autonomous ReAct execution in progress...';

      // 4. Run ReAct Loop
      try {
        await agent.executeMission(prompt, toolToggles, (step) => {
          handleAgentStep(agentCard, step);
          messagesStream.scrollTop = messagesStream.scrollHeight;
        });

        playSound('chime');
      } catch (err) {
        console.error('Agent execution error:', err);
        agentCard.bodyEl.innerHTML += `<p style="color: var(--danger); margin-top: 10px;">⚠️ Error during execution: ${err.message}</p>`;
      }
    });

    // Auto-expand textarea
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });
  }

  function appendUserMessage(text) {
    const stream = document.getElementById('messages-stream');
    const msgCard = document.createElement('div');
    msgCard.className = 'message-card user-message';
    msgCard.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; font-size: 0.85rem; color: var(--text-highlight);">You</div>
      <div>${escapeHtml(text)}</div>
    `;
    stream.appendChild(msgCard);
    stream.scrollTop = stream.scrollHeight;
  }

  function createAgentStreamingCard() {
    const card = document.createElement('div');
    card.className = 'message-card agent-message';

    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `
      <div class="agent-avatar">🤖</div>
      <div class="agent-meta">
        <span class="agent-name">StudyAgent Copilot</span>
        <span class="agent-time">Executing ReAct Loop...</span>
      </div>
      <span class="agent-role-pill" id="agent-exec-pill">Running</span>
    `;

    // Trace Box (Accordion)
    const traceBox = document.createElement('div');
    traceBox.className = 'agent-trace-box';
    traceBox.innerHTML = `
      <div class="trace-header">
        <span>⚡ Agent Internal Reasoning & Tool Calls</span>
        <span class="trace-toggle-arrow">▼</span>
      </div>
      <div class="trace-steps"></div>
    `;

    const traceHeader = traceBox.querySelector('.trace-header');
    const traceSteps = traceBox.querySelector('.trace-steps');
    traceHeader.addEventListener('click', () => {
      const isHidden = traceSteps.style.display === 'none';
      traceSteps.style.display = isHidden ? 'flex' : 'none';
      traceHeader.querySelector('.trace-toggle-arrow').textContent = isHidden ? '▼' : '▶';
    });

    const body = document.createElement('div');
    body.className = 'message-body';
    body.innerHTML = `<p class="streaming-placeholder"><em>Formulating strategy...</em></p>`;

    card.appendChild(header);
    card.appendChild(traceBox);
    card.appendChild(body);

    return {
      el: card,
      traceStepsEl: traceSteps,
      bodyEl: body,
      headerEl: header
    };
  }

  function handleAgentStep(agentCard, step) {
    const stepsEl = agentCard.traceStepsEl;

    if (step.type === 'think') {
      const stepItem = document.createElement('div');
      stepItem.className = 'trace-step';
      stepItem.innerHTML = `
        <span class="step-icon">💭</span>
        <div class="step-content">
          <div class="step-title">THOUGHT / REASONING</div>
          <div class="step-desc">${escapeHtml(step.content)}</div>
        </div>
      `;
      stepsEl.appendChild(stepItem);
    } else if (step.type === 'act') {
      const stepItem = document.createElement('div');
      stepItem.className = 'trace-step';
      stepItem.innerHTML = `
        <span class="step-icon">⚙️</span>
        <div class="step-content">
          <div class="step-title">ACTION: <span class="tool-call-badge">${step.tool}</span></div>
          <div class="step-desc">${escapeHtml(step.desc)}</div>
        </div>
      `;
      stepsEl.appendChild(stepItem);
    } else if (step.type === 'observe') {
      const stepItem = document.createElement('div');
      stepItem.className = 'trace-step';
      stepItem.innerHTML = `
        <span class="step-icon">📋</span>
        <div class="step-content">
          <div class="step-title">OBSERVATION [${step.tool}]</div>
          <div class="step-desc">${escapeHtml(step.result)}</div>
        </div>
      `;
      stepsEl.appendChild(stepItem);
    } else if (step.type === 'finish') {
      // Finished
      const pill = agentCard.headerEl.querySelector('#agent-exec-pill');
      if (pill) {
        pill.textContent = 'Mission Complete';
        pill.style.background = 'rgba(16, 185, 129, 0.2)';
        pill.style.color = '#34d399';
      }
      agentCard.headerEl.querySelector('.agent-time').textContent = 'Just now';

      // Render response markdown
      agentCard.bodyEl.innerHTML = renderMarkdown(step.response);

      // Add Quick Jump Buttons
      const actionBar = document.createElement('div');
      actionBar.className = 'msg-action-bar';

      if (step.artifacts.flashcards && step.artifacts.flashcards.length > 0) {
        state.deck = step.artifacts.flashcards;
        state.currentCardIndex = 0;
        const btn = document.createElement('button');
        btn.className = 'msg-action-btn';
        btn.textContent = `🗂️ Flip Flashcards (${step.artifacts.flashcards.length})`;
        btn.addEventListener('click', () => switchTab('flashcards-tab'));
        actionBar.appendChild(btn);
      }

      if (step.artifacts.quiz && step.artifacts.quiz.length > 0) {
        state.quizQuestions = step.artifacts.quiz;
        state.quizAnswers = {};
        const btn = document.createElement('button');
        btn.className = 'msg-action-btn';
        btn.textContent = `🎯 Start Quiz (${step.artifacts.quiz.length} Qs)`;
        btn.addEventListener('click', () => switchTab('quiz-tab'));
        actionBar.appendChild(btn);
      }

      if (step.artifacts.plan) {
        state.studyPlan = step.artifacts.plan;
        const btn = document.createElement('button');
        btn.className = 'msg-action-btn';
        btn.textContent = `📅 View Study Roadmap`;
        btn.addEventListener('click', () => switchTab('planner-tab'));
        actionBar.appendChild(btn);
      }

      if (step.artifacts.notes) {
        state.notesMarkdown = step.artifacts.notes;
        const btn = document.createElement('button');
        btn.className = 'msg-action-btn';
        btn.textContent = `📝 Open Notebook`;
        btn.addEventListener('click', () => switchTab('notes-tab'));
        actionBar.appendChild(btn);
      }

      agentCard.bodyEl.appendChild(actionBar);

      // Update persistent storage and badges
      saveStateToStorage();
      updateBadgesAndStats();

      // Update mission title
      if (step.artifacts.plan) {
        document.getElementById('sidebar-mission-topic').textContent = step.artifacts.plan.title;
        document.getElementById('sidebar-mission-desc').textContent = `${step.artifacts.plan.tasks.length} tasks scheduled (${step.artifacts.plan.totalMinutes}m)`;
      }
    }
  }

  // ==========================================================================
  // FLASHCARDS DECK LOGIC
  // ==========================================================================
  function initFlashcards() {
    const flipper = document.getElementById('flashcard-flipper');
    const btnPrev = document.getElementById('btn-card-prev');
    const btnNext = document.getElementById('btn-card-next');
    const btnAgain = document.getElementById('btn-card-again');
    const btnMastered = document.getElementById('btn-card-mastered');
    const btnShuffle = document.getElementById('btn-shuffle-cards');
    const btnClear = document.getElementById('btn-clear-cards');
    const btnSample = document.getElementById('btn-sample-flashcards');
    const btnAddManual = document.getElementById('btn-add-manual-card');

    // Flip card
    flipper.addEventListener('click', () => {
      state.isCardFlipped = !state.isCardFlipped;
      flipper.classList.toggle('is-flipped', state.isCardFlipped);
    });

    // Navigation
    btnPrev.addEventListener('click', () => {
      if (state.deck.length === 0) return;
      state.currentCardIndex = (state.currentCardIndex - 1 + state.deck.length) % state.deck.length;
      state.isCardFlipped = false;
      renderFlashcardViewer();
    });

    btnNext.addEventListener('click', () => {
      if (state.deck.length === 0) return;
      state.currentCardIndex = (state.currentCardIndex + 1) % state.deck.length;
      state.isCardFlipped = false;
      renderFlashcardViewer();
    });

    // Mastery Ratings
    btnAgain.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.deck.length === 0) return;
      state.deck[state.currentCardIndex].mastered = false;
      playSound('wrong');
      btnNext.click();
      updateBadgesAndStats();
      saveStateToStorage();
    });

    btnMastered.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.deck.length === 0) return;
      state.deck[state.currentCardIndex].mastered = true;
      playSound('correct');
      btnNext.click();
      updateBadgesAndStats();
      saveStateToStorage();
    });

    // Shuffle
    btnShuffle.addEventListener('click', () => {
      if (state.deck.length <= 1) return;
      for (let i = state.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
      }
      state.currentCardIndex = 0;
      state.isCardFlipped = false;
      renderFlashcardViewer();
    });

    // Clear
    btnClear.addEventListener('click', () => {
      if (confirm('Clear all cards from your active deck?')) {
        state.deck = [];
        state.currentCardIndex = 0;
        renderFlashcardViewer();
        updateBadgesAndStats();
        saveStateToStorage();
      }
    });

    // Sample Deck
    btnSample.addEventListener('click', () => {
      loadInitialPreset();
      renderFlashcardViewer();
    });

    // Add Manual Card Modal
    const manualModal = document.getElementById('manual-card-modal');
    const btnCloseManual = document.getElementById('btn-close-manual-card');
    const btnSaveManual = document.getElementById('btn-save-manual-card');

    btnAddManual.addEventListener('click', () => {
      manualModal.style.display = 'flex';
      document.getElementById('new-card-term').focus();
    });

    btnCloseManual.addEventListener('click', () => {
      manualModal.style.display = 'none';
    });

    btnSaveManual.addEventListener('click', () => {
      const term = document.getElementById('new-card-term').value.trim();
      const def = document.getElementById('new-card-def').value.trim();
      const tag = document.getElementById('new-card-tag').value.trim() || 'Custom';

      if (!term || !def) {
        alert('Please provide both question/term and explanation.');
        return;
      }

      state.deck.push({
        id: 'manual-' + Date.now(),
        front: term,
        back: def,
        tag: tag,
        mastered: false
      });

      document.getElementById('new-card-term').value = '';
      document.getElementById('new-card-def').value = '';
      manualModal.style.display = 'none';

      state.currentCardIndex = state.deck.length - 1;
      renderFlashcardViewer();
      updateBadgesAndStats();
      saveStateToStorage();
    });
  }

  function renderFlashcardViewer() {
    const emptyState = document.getElementById('flashcards-empty-state');
    const viewerContainer = document.getElementById('card-viewer-container');
    const flipper = document.getElementById('flashcard-flipper');

    if (!state.deck || state.deck.length === 0) {
      emptyState.style.display = 'block';
      viewerContainer.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    viewerContainer.style.display = 'flex';

    if (state.currentCardIndex >= state.deck.length) {
      state.currentCardIndex = 0;
    }

    const card = state.deck[state.currentCardIndex];
    flipper.classList.toggle('is-flipped', state.isCardFlipped);

    document.getElementById('card-tag-front').textContent = card.tag || 'Study Term';
    document.getElementById('card-tag-back').textContent = (card.tag || 'Study Term') + ' · Answer';
    document.getElementById('card-front-text').textContent = card.front;
    document.getElementById('card-back-text').textContent = card.back;

    document.getElementById('card-index-indicator').textContent = `Card ${state.currentCardIndex + 1} of ${state.deck.length}`;
    
    const masteryStatus = document.getElementById('card-mastery-status');
    if (card.mastered) {
      masteryStatus.textContent = 'Status: ✅ Mastered';
      masteryStatus.style.color = 'var(--success)';
    } else {
      masteryStatus.textContent = 'Status: 🔄 Needs Practice';
      masteryStatus.style.color = 'var(--warning)';
    }

    const progressPercent = ((state.currentCardIndex + 1) / state.deck.length) * 100;
    document.getElementById('card-progress-fill').style.width = `${progressPercent}%`;
  }

  // ==========================================================================
  // QUIZ ARENA LOGIC
  // ==========================================================================
  function initQuiz() {
    const btnRestart = document.getElementById('btn-restart-quiz');
    const btnClear = document.getElementById('btn-clear-quiz');
    const btnSample = document.getElementById('btn-load-sample-quiz');
    const btnRetry = document.getElementById('btn-quiz-retry');
    const btnReinforce = document.getElementById('btn-quiz-reinforce');

    btnRestart.addEventListener('click', () => {
      state.quizAnswers = {};
      renderQuizArena();
    });

    btnRetry.addEventListener('click', () => {
      state.quizAnswers = {};
      renderQuizArena();
    });

    btnClear.addEventListener('click', () => {
      if (confirm('Clear active quiz questions?')) {
        state.quizQuestions = [];
        state.quizAnswers = {};
        renderQuizArena();
        updateBadgesAndStats();
        saveStateToStorage();
      }
    });

    btnSample.addEventListener('click', () => {
      loadInitialPreset();
      renderQuizArena();
    });

    btnReinforce.addEventListener('click', () => {
      switchTab('chat-tab');
      const input = document.getElementById('student-input');
      input.value = `Explain the questions I missed on the quiz and give me 2 new practice questions to test my understanding.`;
      input.focus();
    });
  }

  function renderQuizArena() {
    const emptyState = document.getElementById('quiz-empty-state');
    const activeContainer = document.getElementById('quiz-active-container');
    const questionsList = document.getElementById('questions-list');
    const summaryCard = document.getElementById('quiz-summary-card');

    if (!state.quizQuestions || state.quizQuestions.length === 0) {
      emptyState.style.display = 'block';
      activeContainer.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    activeContainer.style.display = 'flex';
    questionsList.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D', 'E'];
    let correctCount = 0;
    let answeredCount = 0;

    state.quizQuestions.forEach((q, qIndex) => {
      const qCard = document.createElement('div');
      qCard.className = 'question-card';

      const userAns = state.quizAnswers[q.id || ('q_' + qIndex)];
      if (userAns) {
        answeredCount++;
        if (userAns.isCorrect) correctCount++;
      }

      let optionsHtml = '';
      q.options.forEach((opt, optIdx) => {
        let optClass = 'option-btn';
        if (userAns) {
          if (optIdx === q.correct) {
            optClass += ' selected-correct';
          } else if (userAns.selectedIndex === optIdx && !userAns.isCorrect) {
            optClass += ' selected-incorrect';
          }
        }

        optionsHtml += `
          <button class="${optClass}" data-qindex="${qIndex}" data-optindex="${optIdx}" ${userAns ? 'disabled' : ''}>
            <span class="opt-letter">${letters[optIdx] || optIdx}</span>
            <span>${escapeHtml(opt)}</span>
          </button>
        `;
      });

      let explanationHtml = '';
      if (userAns) {
        explanationHtml = `
          <div class="explanation-box">
            <strong>${userAns.isCorrect ? '✅ Correct!' : '❌ Incorrect.'}</strong>
            ${escapeHtml(q.explanation || '')}
          </div>
        `;
      }

      qCard.innerHTML = `
        <div class="q-header">
          <div class="q-number-badge">${qIndex + 1}</div>
          <div class="q-text">${escapeHtml(q.question)}</div>
        </div>
        <div class="options-grid">
          ${optionsHtml}
        </div>
        ${explanationHtml}
      `;

      questionsList.appendChild(qCard);
    });

    // Attach click handlers to option buttons
    questionsList.querySelectorAll('.option-btn:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', function () {
        const qIndex = parseInt(this.getAttribute('data-qindex'));
        const optIndex = parseInt(this.getAttribute('data-optindex'));
        const question = state.quizQuestions[qIndex];
        const qId = question.id || ('q_' + qIndex);

        const isCorrect = (optIndex === question.correct);
        state.quizAnswers[qId] = {
          selectedIndex: optIndex,
          isCorrect: isCorrect
        };

        if (isCorrect) playSound('correct');
        else playSound('wrong');

        renderQuizArena();
        updateBadgesAndStats();
        saveStateToStorage();
      });
    });

    // Update Banner
    const totalQ = state.quizQuestions.length;
    document.getElementById('quiz-progress-text').textContent = `${answeredCount}/${totalQ} Answered`;
    document.getElementById('quiz-correct-count').textContent = `Correct: ${correctCount}`;
    document.getElementById('quiz-incorrect-count').textContent = `Missed: ${answeredCount - correctCount}`;

    // Completion summary check
    if (answeredCount === totalQ && totalQ > 0) {
      summaryCard.style.display = 'block';
      const pct = Math.round((correctCount / totalQ) * 100);
      document.getElementById('quiz-final-score-title').textContent = pct >= 80 ? '🎉 Outstanding Mastery!' : '📚 Good Practice Effort!';
      document.getElementById('quiz-final-score-desc').textContent = `You scored ${correctCount} out of ${totalQ} (${pct}%).`;
    } else {
      summaryCard.style.display = 'none';
    }
  }

  // ==========================================================================
  // STUDY PLANNER LOGIC
  // ==========================================================================
  function initPlanner() {
    const btnAdd = document.getElementById('btn-add-plan-task');
    const btnClear = document.getElementById('btn-clear-plan');
    const btnSample = document.getElementById('btn-load-sample-plan');

    btnAdd.addEventListener('click', () => {
      const taskText = prompt('Enter new study task / objective:');
      if (!taskText) return;
      const duration = prompt('Estimated duration (e.g. "20 mins"):', '25 mins') || '25 mins';

      if (!state.studyPlan) {
        state.studyPlan = { title: 'Custom Study Plan', tasks: [], totalMinutes: 0 };
      }

      state.studyPlan.tasks.push({
        text: taskText,
        duration: duration,
        priority: 'med',
        completed: false
      });

      renderPlanner();
      updateBadgesAndStats();
      saveStateToStorage();
    });

    btnClear.addEventListener('click', () => {
      if (confirm('Clear study roadmap?')) {
        state.studyPlan = null;
        renderPlanner();
        updateBadgesAndStats();
        saveStateToStorage();
      }
    });

    btnSample.addEventListener('click', () => {
      loadInitialPreset();
      renderPlanner();
    });
  }

  function renderPlanner() {
    const emptyState = document.getElementById('planner-empty-state');
    const tasksList = document.getElementById('planner-tasks-container');

    if (!state.studyPlan || !state.studyPlan.tasks || state.studyPlan.tasks.length === 0) {
      emptyState.style.display = 'block';
      tasksList.style.display = 'none';
      document.getElementById('plan-subject-title').textContent = 'Target Goal: None Set';
      document.getElementById('plan-completion-stats').textContent = '0 Completed';
      document.getElementById('plan-progress-fill').style.width = '0%';
      return;
    }

    emptyState.style.display = 'none';
    tasksList.style.display = 'flex';
    tasksList.innerHTML = '';

    const tasks = state.studyPlan.tasks;
    let completedCount = 0;

    document.getElementById('plan-subject-title').textContent = state.studyPlan.title || 'Study Roadmap';

    tasks.forEach((task, index) => {
      if (task.completed) completedCount++;

      const item = document.createElement('div');
      item.className = `task-item ${task.completed ? 'completed' : ''}`;

      const pClass = task.priority === 'high' ? 'p-high' : task.priority === 'low' ? 'p-low' : 'p-med';

      item.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-index="${index}">
        <div class="task-content">
          <div class="task-text">${escapeHtml(task.text)}</div>
          <div class="task-meta">
            <span>⏱️ ${escapeHtml(task.duration || '25 mins')}</span>
            <span class="task-priority-tag ${pClass}">${(task.priority || 'med').toUpperCase()}</span>
          </div>
        </div>
      `;

      tasksList.appendChild(item);
    });

    // Attach checkbox events
    tasksList.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.addEventListener('change', function () {
        const idx = parseInt(this.getAttribute('data-index'));
        state.studyPlan.tasks[idx].completed = this.checked;
        if (this.checked) playSound('correct');
        renderPlanner();
        updateBadgesAndStats();
        saveStateToStorage();
      });
    });

    // Update Progress
    const pct = Math.round((completedCount / tasks.length) * 100);
    document.getElementById('plan-completion-stats').textContent = `${completedCount} of ${tasks.length} Completed (${pct}%)`;
    document.getElementById('plan-progress-fill').style.width = `${pct}%`;
  }

  // ==========================================================================
  // SMART NOTES LOGIC
  // ==========================================================================
  function initNotes() {
    const btnCopy = document.getElementById('btn-copy-notes');
    const btnDownload = document.getElementById('btn-download-notes');
    const btnClear = document.getElementById('btn-clear-notes');
    const btnSample = document.getElementById('btn-load-sample-notes');

    btnCopy.addEventListener('click', async () => {
      if (!state.notesMarkdown) return;
      try {
        await navigator.clipboard.writeText(state.notesMarkdown);
        btnCopy.textContent = '✅ Copied!';
        setTimeout(() => { btnCopy.textContent = '📋 Copy Notes'; }, 2000);
      } catch (err) {
        alert('Copied to clipboard failed: ' + err.message);
      }
    });

    btnDownload.addEventListener('click', () => {
      if (!state.notesMarkdown) return;
      const blob = new Blob([state.notesMarkdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'studyagent_notes.md';
      a.click();
      URL.revokeObjectURL(url);
    });

    btnClear.addEventListener('click', () => {
      if (confirm('Clear current notebook notes?')) {
        state.notesMarkdown = '';
        renderNotes();
        updateBadgesAndStats();
        saveStateToStorage();
      }
    });

    btnSample.addEventListener('click', () => {
      loadInitialPreset();
      renderNotes();
    });
  }

  function renderNotes() {
    const emptyState = document.getElementById('notes-empty-state');
    const contentWrapper = document.getElementById('notes-content-wrapper');
    const paper = document.getElementById('notes-rendered-content');

    if (!state.notesMarkdown || state.notesMarkdown.trim() === '') {
      emptyState.style.display = 'block';
      contentWrapper.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    contentWrapper.style.display = 'block';
    paper.innerHTML = renderMarkdown(state.notesMarkdown);
  }

  // ==========================================================================
  // POMODORO FOCUS TIMER
  // ==========================================================================
  function initPomodoro() {
    const modeBtns = document.querySelectorAll('.timer-mode-btn');
    const btnToggle = document.getElementById('btn-timer-toggle');
    const btnReset = document.getElementById('btn-timer-reset');
    const miniToggle = document.getElementById('mini-timer-toggle-btn');

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const minutes = parseInt(btn.getAttribute('data-minutes'));
        const modeName = btn.getAttribute('data-mode');
        setTimerDuration(minutes, modeName);
      });
    });

    btnToggle.addEventListener('click', toggleTimer);
    miniToggle.addEventListener('click', toggleTimer);
    btnReset.addEventListener('click', resetTimer);

    updateTimerDisplay();
  }

  function setTimerDuration(minutes, modeName) {
    pauseTimer();
    state.pomodoro.durationMinutes = minutes;
    state.pomodoro.secondsLeft = minutes * 60;
    state.pomodoro.mode = modeName;
    document.getElementById('timer-current-mode').textContent = `${modeName} Session`;
    updateTimerDisplay();
  }

  function toggleTimer() {
    if (state.pomodoro.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  function startTimer() {
    if (state.pomodoro.isRunning) return;
    state.pomodoro.isRunning = true;
    document.getElementById('timer-btn-text').textContent = 'Pause Focus';
    document.getElementById('mini-timer-toggle-btn').textContent = 'Pause Session';

    state.pomodoro.intervalId = setInterval(() => {
      if (state.pomodoro.secondsLeft > 0) {
        state.pomodoro.secondsLeft--;
        updateTimerDisplay();
      } else {
        // Finished
        pauseTimer();
        playSound('chime');
        state.pomodoro.completedSessions++;
        state.pomodoro.totalMinutes += state.pomodoro.durationMinutes;
        document.getElementById('pomodoro-completed-count').textContent = state.pomodoro.completedSessions;
        document.getElementById('pomodoro-minutes-total').textContent = state.pomodoro.totalMinutes;
        updateBadgesAndStats();
        saveStateToStorage();
        alert(`🔔 Pomodoro Complete! Great job maintaining focus.`);
      }
    }, 1000);
  }

  function pauseTimer() {
    state.pomodoro.isRunning = false;
    clearInterval(state.pomodoro.intervalId);
    state.pomodoro.intervalId = null;
    document.getElementById('timer-btn-text').textContent = 'Start Focus';
    document.getElementById('mini-timer-toggle-btn').textContent = 'Start Session';
  }

  function resetTimer() {
    pauseTimer();
    state.pomodoro.secondsLeft = state.pomodoro.durationMinutes * 60;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const totalSec = state.pomodoro.secondsLeft;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    document.getElementById('timer-digits-display').textContent = timeStr;
    document.getElementById('mini-timer-display').textContent = timeStr;

    // Circle progress (circumference = 2 * PI * 105 = ~660)
    const maxSec = state.pomodoro.durationMinutes * 60;
    const progress = totalSec / maxSec;
    const dashoffset = 660 * (1 - progress);
    const stroke = document.getElementById('timer-circle-stroke');
    if (stroke) {
      stroke.style.strokeDashoffset = dashoffset;
    }

    // Mini bar
    const miniBar = document.getElementById('mini-timer-bar-fill');
    if (miniBar) {
      miniBar.style.width = `${progress * 100}%`;
    }
  }

  // ==========================================================================
  // SETTINGS & GEMINI CONFIGURATION
  // ==========================================================================
  function initSettings() {
    const modal = document.getElementById('settings-modal');
    const btnOpen = document.getElementById('btn-open-settings');
    const btnClose = document.getElementById('btn-close-settings');
    const btnSave = document.getElementById('btn-save-settings');
    const selectEngine = document.getElementById('setting-engine-mode');
    const inputKey = document.getElementById('setting-gemini-key');
    const selectModel = document.getElementById('setting-gemini-model');
    const geminiSection = document.getElementById('gemini-key-section');
    const btnTest = document.getElementById('btn-test-gemini-key');
    const testResult = document.getElementById('gemini-verify-result');
    const btnResetAll = document.getElementById('btn-reset-all-data');

    // Populate initial inputs
    selectEngine.value = agent.engineMode;
    inputKey.value = agent.geminiApiKey;
    selectModel.value = agent.geminiModel;
    geminiSection.style.display = agent.engineMode === 'gemini' ? 'flex' : 'none';

    selectEngine.addEventListener('change', () => {
      geminiSection.style.display = selectEngine.value === 'gemini' ? 'flex' : 'none';
    });

    btnOpen.addEventListener('click', () => {
      modal.style.display = 'flex';
    });

    btnClose.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    btnSave.addEventListener('click', () => {
      const mode = selectEngine.value;
      const key = inputKey.value.trim();
      const model = selectModel.value;

      agent.setEngineConfig(mode, key, model);
      updateEngineBadge();
      modal.style.display = 'none';
    });

    // Test Gemini Connection
    btnTest.addEventListener('click', async () => {
      const key = inputKey.value.trim();
      const model = selectModel.value;
      if (!key) {
        testResult.className = 'verify-status error';
        testResult.textContent = '❌ Please enter an API key to test.';
        return;
      }

      testResult.className = 'verify-status';
      testResult.textContent = 'Verifying API connection...';

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello, respond with: OK' }] }]
          })
        });

        if (res.ok) {
          testResult.className = 'verify-status success';
          testResult.textContent = '✅ Connected successfully to Google Gemini!';
        } else {
          const err = await res.json();
          testResult.className = 'verify-status error';
          testResult.textContent = `❌ Verification failed: ${err.error?.message || res.statusText}`;
        }
      } catch (e) {
        testResult.className = 'verify-status error';
        testResult.textContent = '❌ Connection error: ' + e.message;
      }
    });

    // Reset All Data
    btnResetAll.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all cards, quizzes, notes, and study plans?')) {
        localStorage.clear();
        state.deck = [];
        state.quizQuestions = [];
        state.quizAnswers = {};
        state.studyPlan = null;
        state.notesMarkdown = '';
        renderFlashcardViewer();
        renderQuizArena();
        renderPlanner();
        renderNotes();
        updateBadgesAndStats();
        modal.style.display = 'none';
        alert('All study data has been reset.');
      }
    });
  }

  function updateEngineBadge() {
    const badgeText = document.getElementById('engine-status-text');
    if (agent.engineMode === 'gemini' && agent.geminiApiKey) {
      badgeText.textContent = `Gemini Live API (${agent.geminiModel})`;
    } else {
      badgeText.textContent = 'Autonomous Engine (Client ReAct)';
    }
  }

  // ==========================================================================
  // THEME TOGGLE
  // ==========================================================================
  function initTheme() {
    const btnToggle = document.getElementById('btn-toggle-theme');
    const savedTheme = localStorage.getItem('studyagent_theme') || 'dark';

    if (savedTheme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    }

    btnToggle.addEventListener('click', () => {
      const isLight = document.body.classList.contains('light-theme');
      if (isLight) {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('studyagent_theme', 'dark');
      } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('studyagent_theme', 'light');
      }
    });
  }

  // ==========================================================================
  // BADGES & STATS
  // ==========================================================================
  function updateBadgesAndStats() {
    // Badges on tabs
    document.getElementById('badge-flashcards').textContent = state.deck.length;
    document.getElementById('badge-quiz').textContent = state.quizQuestions.length;
    document.getElementById('badge-planner').textContent = state.studyPlan?.tasks ? state.studyPlan.tasks.length : 0;
    document.getElementById('badge-notes').textContent = state.notesMarkdown ? '1' : '0';

    // Sidebar stats
    document.getElementById('stat-cards-count').textContent = state.deck.length;

    // Calculate Quiz Score
    let correct = 0;
    let answered = 0;
    Object.values(state.quizAnswers).forEach(ans => {
      answered++;
      if (ans.isCorrect) correct++;
    });
    const avgScore = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    document.getElementById('stat-quiz-score').textContent = `${avgScore}%`;

    // Tasks done
    let tasksDone = 0;
    if (state.studyPlan?.tasks) {
      tasksDone = state.studyPlan.tasks.filter(t => t.completed).length;
    }
    document.getElementById('stat-tasks-done').textContent = tasksDone;

    // Focus time
    document.getElementById('stat-focus-time').textContent = `${state.pomodoro.totalMinutes}m`;
  }

  // ==========================================================================
  // STORAGE
  // ==========================================================================
  function saveStateToStorage() {
    try {
      localStorage.setItem('studyagent_deck', JSON.stringify(state.deck));
      localStorage.setItem('studyagent_quiz', JSON.stringify(state.quizQuestions));
      localStorage.setItem('studyagent_quiz_answers', JSON.stringify(state.quizAnswers));
      localStorage.setItem('studyagent_plan', JSON.stringify(state.studyPlan));
      localStorage.setItem('studyagent_notes', state.notesMarkdown);
      localStorage.setItem('studyagent_pomo_mins', String(state.pomodoro.totalMinutes));
      localStorage.setItem('studyagent_pomo_count', String(state.pomodoro.completedSessions));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  function loadStateFromStorage() {
    try {
      const savedDeck = localStorage.getItem('studyagent_deck');
      if (savedDeck) state.deck = JSON.parse(savedDeck);

      const savedQuiz = localStorage.getItem('studyagent_quiz');
      if (savedQuiz) state.quizQuestions = JSON.parse(savedQuiz);

      const savedAnswers = localStorage.getItem('studyagent_quiz_answers');
      if (savedAnswers) state.quizAnswers = JSON.parse(savedAnswers);

      const savedPlan = localStorage.getItem('studyagent_plan');
      if (savedPlan) state.studyPlan = JSON.parse(savedPlan);

      const savedNotes = localStorage.getItem('studyagent_notes');
      if (savedNotes) state.notesMarkdown = savedNotes;

      const savedMins = localStorage.getItem('studyagent_pomo_mins');
      if (savedMins) state.pomodoro.totalMinutes = parseInt(savedMins) || 0;

      const savedSessions = localStorage.getItem('studyagent_pomo_count');
      if (savedSessions) state.pomodoro.completedSessions = parseInt(savedSessions) || 0;
    } catch (e) {
      console.warn('Storage parse error:', e);
    }
  }

  // ==========================================================================
  // UTILITIES (MARKDOWN PARSER & ESCAPING)
  // ==========================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderMarkdown(md) {
    if (!md) return '';
    let html = escapeHtml(md);

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold / Italics
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Code blocks & inline code
    html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Unordered lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s?<ul>/gim, '');

    // Paragraphs / linebreaks
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><h([1-3])>/gi, '<h$1>').replace(/<\/h([1-3])><\/p>/gi, '</h$1>');
    html = html.replace(/<p><blockquote>/gi, '<blockquote>').replace(/<\/blockquote><\/p>/gi, '</blockquote>');
    html = html.replace(/<p><ul>/gi, '<ul>').replace(/<\/ul><\/p>/gi, '</ul>');
    html = html.replace(/<p><pre>/gi, '<pre>').replace(/<\/pre><\/p>/gi, '</pre>');

    return html;
  }

})();
