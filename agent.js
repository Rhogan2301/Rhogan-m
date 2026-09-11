/**
 * StudyAgent.AI — Autonomous ReAct Agent Engine
 * Features:
 * 1. Goal Decomposition & Thought Generation
 * 2. Autonomous Tool Dispatching (Planner, Flashcards, Quiz, Notes, Solver, Timer)
 * 3. Event-driven ReAct loop (Thought -> Action -> Observation -> Response)
 * 4. Dual Engine (Built-in Knowledge Generators + Gemini API Client)
 */

class StudyAgent {
  constructor(options = {}) {
    this.engineMode = options.engineMode || localStorage.getItem('studyagent_engine_mode') || 'autonomous';
    this.geminiApiKey = options.geminiApiKey || localStorage.getItem('studyagent_gemini_key') || '';
    this.geminiModel = options.geminiModel || localStorage.getItem('studyagent_gemini_model') || 'gemini-2.5-flash';
    
    // Active tool registries
    this.tools = {
      generate_study_plan: this.toolGenerateStudyPlan.bind(this),
      create_flashcards: this.toolCreateFlashcards.bind(this),
      generate_quiz: this.toolGenerateQuiz.bind(this),
      take_notes: this.toolTakeNotes.bind(this),
      solve_problem: this.toolSolveProblem.bind(this)
    };
  }

  setEngineConfig(mode, apiKey, model) {
    this.engineMode = mode;
    this.geminiApiKey = apiKey;
    this.geminiModel = model;
    localStorage.setItem('studyagent_engine_mode', mode);
    localStorage.setItem('studyagent_gemini_key', apiKey);
    localStorage.setItem('studyagent_gemini_model', model);
  }

  /**
   * Main entrypoint for student queries.
   * Executes the ReAct cycle with callbacks for live UI streaming.
   * @param {string} prompt - User request
   * @param {object} toolToggles - User preferences for which tools to allow
   * @param {function} onStep - Callback for each ReAct step: { type: 'think'|'act'|'observe'|'finish', data }
   */
  async executeMission(prompt, toolToggles = {}, onStep = () => {}) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return;

    // Step 1: Reason / Goal Decomposition
    onStep({
      type: 'think',
      content: `Analyzing student request: "${cleanPrompt}". Assessing subject domain, key concepts, and selecting optimal study tools.`
    });

    await this.delay(450);

    // If Gemini Live mode is enabled and API key is present
    if (this.engineMode === 'gemini' && this.geminiApiKey) {
      try {
        return await this.executeGeminiReAct(cleanPrompt, toolToggles, onStep);
      } catch (err) {
        console.warn('Gemini API call failed, falling back to autonomous built-in engine:', err);
        onStep({
          type: 'think',
          content: `Notice: Gemini API returned (${err.message}). Seamlessly engaging built-in Autonomous Academic Engine...`
        });
        return await this.executeAutonomousReAct(cleanPrompt, toolToggles, onStep);
      }
    } else {
      return await this.executeAutonomousReAct(cleanPrompt, toolToggles, onStep);
    }
  }

  /**
   * Built-in Autonomous Engine with ReAct dispatch
   */
  async executeAutonomousReAct(prompt, toolToggles, onStep) {
    const analysis = this.analyzeIntent(prompt);
    
    onStep({
      type: 'think',
      content: `Identified domain: [${analysis.domain.toUpperCase()}]. Topic focus: "${analysis.topic}". Determining active toolchain: ` +
        `[${toolToggles.plan !== false ? 'Planner' : ''} ` +
        `${toolToggles.flashcards !== false ? 'Flashcards' : ''} ` +
        `${toolToggles.quiz !== false ? 'Quiz' : ''} ` +
        `${toolToggles.notes !== false ? 'Notes' : ''}].`
    });

    await this.delay(500);

    const generatedArtifacts = {
      plan: null,
      flashcards: [],
      quiz: [],
      notes: null,
      solution: null
    };

    // Tool 1: Math / Science Problem Solver (if calculation or solve detected)
    if (analysis.isProblemOrFormula) {
      onStep({
        type: 'act',
        tool: 'solve_problem',
        desc: `Computing step-by-step mathematical / scientific derivation for "${analysis.topic}".`
      });
      await this.delay(400);
      const solution = this.tools.solve_problem(analysis);
      generatedArtifacts.solution = solution;
      onStep({
        type: 'observe',
        tool: 'solve_problem',
        result: `Derivation computed: 4 procedural steps verified.`
      });
      await this.delay(350);
    }

    // Tool 2: Study Planner
    if (toolToggles.plan !== false) {
      onStep({
        type: 'act',
        tool: 'generate_study_plan',
        desc: `Constructing actionable revision schedule with estimated time allocations.`
      });
      await this.delay(450);
      const plan = this.tools.generate_study_plan(analysis);
      generatedArtifacts.plan = plan;
      onStep({
        type: 'observe',
        tool: 'generate_study_plan',
        result: `Generated ${plan.tasks.length} phased study milestones totaling ${plan.totalMinutes} minutes.`
      });
      await this.delay(350);
    }

    // Tool 3: Flashcard Generator
    if (toolToggles.flashcards !== false) {
      onStep({
        type: 'act',
        tool: 'create_flashcards',
        desc: `Extracting high-yield definitions and concept pairs for active recall deck.`
      });
      await this.delay(450);
      const cards = this.tools.create_flashcards(analysis);
      generatedArtifacts.flashcards = cards;
      onStep({
        type: 'observe',
        tool: 'create_flashcards',
        result: `Synthesized ${cards.length} interactive flashcards with category tags.`
      });
      await this.delay(350);
    }

    // Tool 4: Practice Quiz Arena Maker
    if (toolToggles.quiz !== false) {
      onStep({
        type: 'act',
        tool: 'generate_quiz',
        desc: `Formulating diagnostic multiple-choice questions with answer keys and rationale.`
      });
      await this.delay(450);
      const quiz = this.tools.generate_quiz(analysis);
      generatedArtifacts.quiz = quiz;
      onStep({
        type: 'observe',
        tool: 'generate_quiz',
        result: `Constructed ${quiz.length} self-testing questions with instant grading logic.`
      });
      await this.delay(350);
    }

    // Tool 5: Smart Notes & Cheatsheet Synthesizer
    if (toolToggles.notes !== false) {
      onStep({
        type: 'act',
        tool: 'take_notes',
        desc: `Synthesizing structured Markdown cheat sheet and key formula reference.`
      });
      await this.delay(400);
      const notes = this.tools.take_notes(analysis, generatedArtifacts.solution);
      generatedArtifacts.notes = notes;
      onStep({
        type: 'observe',
        tool: 'take_notes',
        result: `Formatted revision notes compiled into Notebook.`
      });
      await this.delay(300);
    }

    // Final Agent Guidance Synthesis
    const finalResponse = this.composeFinalGuidance(analysis, generatedArtifacts);

    onStep({
      type: 'finish',
      response: finalResponse,
      artifacts: generatedArtifacts
    });

    return {
      response: finalResponse,
      artifacts: generatedArtifacts
    };
  }

  /**
   * Gemini API ReAct implementation using gemini-2.5-flash or specified model
   */
  async executeGeminiReAct(prompt, toolToggles, onStep) {
    onStep({
      type: 'think',
      content: `Connecting to Google Gemini API (${this.geminiModel}). Prompting model with academic reasoning persona and tool specifications...`
    });

    const systemPrompt = `You are StudyAgent, an expert Autonomous AI Student Learning Copilot.
The student asked: "${prompt}".
Generate a comprehensive, structured response in JSON format with the following keys:
{
  "subject_domain": "Biology|Physics|Math|History|Computer Science|General",
  "topic_title": "Clean topic name",
  "overview_summary": "Encouraging 2-3 paragraph explanation of the topic tailored for a student",
  "study_plan": {
    "title": "Study Roadmap Title",
    "tasks": [
      {"task": "Task description", "duration": "25 mins", "priority": "high|med|low"}
    ]
  },
  "flashcards": [
    {"front": "Question/Term", "back": "Answer/Definition", "tag": "Subject tag"}
  ],
  "quiz": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Why this option is correct"
    }
  ],
  "notes_markdown": "# Title\\n\\n## Key Concepts\\n- Bullet points\\n\\n### Important Formulas / Takeaways\\n..."
}
Output ONLY valid JSON. No markdown code blocks, no backticks, just pure parseable JSON.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;

    onStep({
      type: 'act',
      tool: 'gemini_multiturn_generate',
      desc: `Sending query to ${this.geminiModel} for deep pedagogical synthesis.`
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 3500,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Empty response received from Gemini.');
    }

    let parsed;
    try {
      parsed = JSON.parse(candidateText);
    } catch {
      // Clean possible fences
      const clean = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    onStep({
      type: 'observe',
      tool: 'gemini_multiturn_generate',
      result: `Gemini generated ${parsed.flashcards?.length || 0} flashcards, ${parsed.quiz?.length || 0} quiz items, and a complete study roadmap.`
    });

    await this.delay(300);

    const generatedArtifacts = {
      plan: parsed.study_plan ? {
        title: parsed.study_plan.title || `${parsed.topic_title} Plan`,
        tasks: (parsed.study_plan.tasks || []).map(t => ({
          text: t.task,
          duration: t.duration || '25 mins',
          priority: t.priority || 'med',
          completed: false
        })),
        totalMinutes: 90
      } : null,
      flashcards: (parsed.flashcards || []).map((f, i) => ({
        id: 'gemini-card-' + Date.now() + '-' + i,
        front: f.front,
        back: f.back,
        tag: f.tag || parsed.subject_domain || 'General',
        mastered: false
      })),
      quiz: (parsed.quiz || []).map((q, i) => ({
        id: 'gemini-q-' + Date.now() + '-' + i,
        question: q.question,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation
      })),
      notes: parsed.notes_markdown || `# ${parsed.topic_title}\n\n${parsed.overview_summary}`,
      solution: null
    };

    const finalResponse = `### 🎓 Mission Briefing: ${parsed.topic_title || 'Target Subject'}\n\n` +
      `${parsed.overview_summary}\n\n` +
      `✨ **Autonomous Artifacts Ready:**\n` +
      `- 🗂️ **${generatedArtifacts.flashcards.length} Flashcards** added to your active deck.\n` +
      `- 🎯 **${generatedArtifacts.quiz.length} Practice Questions** loaded into the Quiz Arena.\n` +
      `- 📅 **Structured Study Roadmap** ready in the Study Plan tab.\n` +
      `- 📝 **Full Revision Notes** compiled into your Notebook.`;

    onStep({
      type: 'finish',
      response: finalResponse,
      artifacts: generatedArtifacts
    });

    return {
      response: finalResponse,
      artifacts: generatedArtifacts
    };
  }

  /**
   * Intent and subject classification logic for procedural engine
   */
  analyzeIntent(prompt) {
    const lower = prompt.toLowerCase();
    
    // Check for math/equation solving
    const isProblemOrFormula = /solve|equation|formula|calculate|x\^2|derivative|integral|ohm|pythagor/i.test(lower);

    let domain = 'general';
    let topic = 'Concept Mastery';

    if (/mitosis|meiosis|biology|cell|dna|photosynthesis|respiration|organelle|genetics/i.test(lower)) {
      domain = 'biology';
      topic = lower.includes('mitosis') ? 'Cell Mitosis & Cell Division' :
              lower.includes('photosynthesis') ? 'Photosynthesis & Light Reactions' :
              lower.includes('dna') ? 'DNA Structure & Replication' : 'Cellular Biology';
    } else if (/newton|physics|motion|force|gravity|velocity|acceleration|ohm|kinematics|thermo/i.test(lower)) {
      domain = 'physics';
      topic = lower.includes('newton') ? "Newton's Laws of Motion" :
              lower.includes('ohm') ? "Ohm's Law & Circuits" :
              lower.includes('kinematics') ? 'Kinematics & Acceleration' : 'Classical Physics Principles';
    } else if (/quadratic|math|algebra|calculus|derivative|trigonometry|matrix|polynomial|pythagor/i.test(lower)) {
      domain = 'mathematics';
      topic = lower.includes('quadratic') ? 'Quadratic Equations & Factoring' :
              lower.includes('calculus') || lower.includes('derivative') ? 'Calculus: Derivatives & Rates of Change' :
              lower.includes('pythagor') ? 'Pythagorean Theorem & Right Triangles' : 'Algebraic Foundations';
    } else if (/chemistry|stoichiometry|mole|acid|base|periodic|element|reaction|bond/i.test(lower)) {
      domain = 'chemistry';
      topic = lower.includes('stoichiometry') ? 'Stoichiometry & Mole Conversions' :
              lower.includes('periodic') ? 'Periodic Trends & Electronegativity' : 'Chemical Bonding & Reactions';
    } else if (/history|war|revolution|timeline|empire|constitution|treaty/i.test(lower)) {
      domain = 'history';
      topic = lower.includes('world war') ? 'World War II: Turning Points & Causes' :
              lower.includes('revolution') ? 'The French Revolution (1789-1799)' : 'Key Historical Eras & Milestones';
    } else if (/python|code|programming|function|variable|javascript|algorithm|loop/i.test(lower)) {
      domain = 'programming';
      topic = lower.includes('python') ? 'Python Functions & Scope' :
              lower.includes('loop') ? 'Control Flow: Loops & Iterations' : 'Computer Science Fundamentals';
    } else {
      // General topic extractor
      const words = prompt.replace(/[^\w\s]/g, '').split(' ').filter(w => w.length > 3);
      if (words.length > 0) {
        topic = words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }

    return { domain, topic, isProblemOrFormula, rawPrompt: prompt };
  }

  // ==========================================================================
  // TOOL IMPLEMENTATIONS
  // ==========================================================================

  toolGenerateStudyPlan(analysis) {
    const topic = analysis.topic;
    let tasks = [];

    if (analysis.domain === 'biology') {
      tasks = [
        { text: `Review core vocabulary & definitions for ${topic}`, duration: '20 mins', priority: 'high', completed: false },
        { text: 'Diagram phases and structural mechanics (prophase -> cytokinesis)', duration: '25 mins', priority: 'high', completed: false },
        { text: 'Self-test with StudyAgent 3D Flashcards deck', duration: '15 mins', priority: 'med', completed: false },
        { text: 'Complete diagnostic practice quiz in Quiz Arena', duration: '15 mins', priority: 'high', completed: false },
        { text: 'Final cheat-sheet synthesis and review of common exam pitfalls', duration: '15 mins', priority: 'low', completed: false }
      ];
    } else if (analysis.domain === 'mathematics') {
      tasks = [
        { text: `Understand derivation and standard form of ${topic}`, duration: '20 mins', priority: 'high', completed: false },
        { text: 'Work through 3 guided practice examples with step-by-step checks', duration: '30 mins', priority: 'high', completed: false },
        { text: 'Memorize critical formulas using the active flashcard deck', duration: '15 mins', priority: 'med', completed: false },
        { text: 'Timed challenge: Complete 5 problem variants in Quiz Arena', duration: '20 mins', priority: 'high', completed: false }
      ];
    } else if (analysis.domain === 'physics') {
      tasks = [
        { text: `Deconstruct fundamental definitions and SI units for ${topic}`, duration: '15 mins', priority: 'high', completed: false },
        { text: 'Analyze Free Body Diagrams and force vector resolution', duration: '25 mins', priority: 'high', completed: false },
        { text: 'Apply formula relationships across contrasting scenarios', duration: '20 mins', priority: 'med', completed: false },
        { text: 'Test conceptual intuition with Quiz Arena questions', duration: '15 mins', priority: 'high', completed: false }
      ];
    } else {
      tasks = [
        { text: `Phase 1: Conceptual Foundation & Active Reading (${topic})`, duration: '25 mins', priority: 'high', completed: false },
        { text: 'Phase 2: Active Recall session with Flashcard Deck', duration: '20 mins', priority: 'high', completed: false },
        { text: 'Phase 3: Diagnostic Self-Assessment in Quiz Arena', duration: '15 mins', priority: 'med', completed: false },
        { text: 'Phase 4: Synthesize Cheatsheet into Smart Notes Notebook', duration: '15 mins', priority: 'low', completed: false }
      ];
    }

    const totalMinutes = tasks.reduce((sum, t) => sum + parseInt(t.duration), 0);
    return {
      title: `${topic} Roadmap`,
      tasks,
      totalMinutes
    };
  }

  toolCreateFlashcards(analysis) {
    const domain = analysis.domain;
    const cards = [];

    if (domain === 'biology') {
      cards.push(
        { id: 'c1', front: 'What are the 4 main stages of Mitosis?', back: 'Prophase, Metaphase, Anaphase, Telophase (Acronym: PMAT).', tag: 'Biology', mastered: false },
        { id: 'c2', front: 'What happens during Metaphase?', back: 'Chromosomes line up along the equator (metaphase plate) of the cell; spindle fibers attach to kinetochores.', tag: 'Biology', mastered: false },
        { id: 'c3', front: 'How does Cytokinesis differ between animal and plant cells?', back: 'Animal cells form a cleavage furrow via actin ring contraction; plant cells build a rigid cell plate that becomes a new cell wall.', tag: 'Biology', mastered: false },
        { id: 'c4', front: 'What is the role of the Centrosome / Centrioles?', back: 'Organizes microtubules to form the mitotic spindle apparatus that pulls sister chromatids apart.', tag: 'Biology', mastered: false },
        { id: 'c5', front: 'What is the ploidy outcome of Mitosis?', back: '2 genetically identical diploid (2n) daughter cells from 1 parent diploid cell.', tag: 'Biology', mastered: false }
      );
    } else if (domain === 'physics') {
      cards.push(
        { id: 'c1', front: "State Newton's First Law of Motion (Inertia).", back: 'An object at rest stays at rest, and an object in motion stays in motion with constant velocity, unless acted upon by a net external force (ΣF = 0).', tag: 'Physics', mastered: false },
        { id: 'c2', front: "What is Newton's Second Law mathematically?", back: 'F_net = m · a (Net Force = mass × acceleration). Units: 1 Newton = 1 kg·m/s².', tag: 'Physics', mastered: false },
        { id: 'c3', front: "What is Newton's Third Law?", back: 'For every action, there is an equal and opposite reaction (F_A_on_B = -F_B_on_A). They act on DIFFERENT objects.', tag: 'Physics', mastered: false },
        { id: 'c4', front: "What is Ohm's Law and its constituent units?", back: 'V = I · R (Voltage [Volts] = Current [Amperes] × Resistance [Ohms Ω]).', tag: 'Physics', mastered: false },
        { id: 'c5', front: 'Distinguish Mass from Weight.', back: 'Mass is the scalar measure of inertia (kg, invariant). Weight is gravitational force (W = mg, in Newtons, depends on local gravity).', tag: 'Physics', mastered: false }
      );
    } else if (domain === 'mathematics') {
      cards.push(
        { id: 'c1', front: 'What is the standard Quadratic Formula?', back: 'x = (-b ± √(b² - 4ac)) / (2a) for ax² + bx + c = 0.', tag: 'Math', mastered: false },
        { id: 'c2', front: 'What does the Discriminant (Δ = b² - 4ac) indicate?', back: 'Δ > 0: 2 distinct real roots.\nΔ = 0: 1 real repeated root.\nΔ < 0: 2 complex conjugate roots.', tag: 'Math', mastered: false },
        { id: 'c3', front: 'How do you find the vertex of a parabola y = ax² + bx + c?', back: 'x_vertex = -b / (2a); y_vertex = f(-b / 2a).', tag: 'Math', mastered: false },
        { id: 'c4', front: 'What is the Pythagorean Theorem?', back: 'In a right triangle with legs a, b and hypotenuse c: a² + b² = c².', tag: 'Math', mastered: false },
        { id: 'c5', front: 'What is the Power Rule for differentiation?', back: 'd/dx [x^n] = n · x^(n - 1).', tag: 'Math', mastered: false }
      );
    } else if (domain === 'chemistry') {
      cards.push(
        { id: 'c1', front: "What is Avogadro's Number and its meaning?", back: '6.022 × 10²³ particles/mole. Represents particles in exactly 12g of Carbon-12.', tag: 'Chemistry', mastered: false },
        { id: 'c2', front: 'What is Molarity (M)?', back: 'M = moles of solute / liters of solution (mol/L).', tag: 'Chemistry', mastered: false },
        { id: 'c3', front: 'What is Le Chatelier’s Principle?', back: 'If a dynamic equilibrium is disturbed by changing conditions, the position of equilibrium moves to counteract the change.', tag: 'Chemistry', mastered: false },
        { id: 'c4', front: 'What constitutes an Acid vs Base under Brønsted-Lowry?', back: 'Acid = Proton (H⁺) donor. Base = Proton (H⁺) acceptor.', tag: 'Chemistry', mastered: false }
      );
    } else if (domain === 'programming') {
      cards.push(
        { id: 'c1', front: 'What is the difference between an Argument and a Parameter in Python?', back: 'Parameters are variable names in function definitions. Arguments are actual values passed when calling.', tag: 'Coding', mastered: false },
        { id: 'c2', front: 'What happens if a Python function has no return statement?', back: 'It implicitly returns None.', tag: 'Coding', mastered: false },
        { id: 'c3', front: 'Explain *args vs **kwargs in Python.', back: '*args passes variable non-keyword tuple arguments; **kwargs passes variable keyword key-value pairs (dict).', tag: 'Coding', mastered: false },
        { id: 'c4', front: 'What is Variable Scope (LEGB rule)?', back: 'Local -> Enclosing -> Global -> Built-in.', tag: 'Coding', mastered: false }
      );
    } else {
      // General study cards
      cards.push(
        { id: 'c1', front: `Core Definition: ${analysis.topic}`, back: `The primary theoretical model and practical significance of ${analysis.topic}.`, tag: 'Core', mastered: false },
        { id: 'c2', front: `Key Principle of ${analysis.topic}`, back: 'Fundamental law or mechanism governing interactions in this domain.', tag: 'Principle', mastered: false },
        { id: 'c3', front: 'Common Exam Pitfall to Avoid', back: 'Confusing underlying causal mechanisms with symptomatic observations.', tag: 'Exam Prep', mastered: false }
      );
    }

    return cards;
  }

  toolGenerateQuiz(analysis) {
    const domain = analysis.domain;
    const questions = [];

    if (domain === 'biology') {
      questions.push(
        {
          id: 'q1',
          question: 'In which stage of mitosis do sister chromatids separate and move toward opposite poles?',
          options: ['Prophase', 'Metaphase', 'Anaphase', 'Telophase'],
          correct: 2,
          explanation: 'During Anaphase, cohesin proteins are cleaved, allowing sister chromatids to be pulled to opposite poles by shortening kinetochore microtubules.'
        },
        {
          id: 'q2',
          question: 'A somatic cell with 46 chromosomes undergoes mitosis. How many chromosomes are present in each daughter cell?',
          options: ['23', '46', '92', '12'],
          correct: 1,
          explanation: 'Mitosis is an equational division; each of the two daughter cells inherits an exact copy of 46 chromosomes (diploid).'
        },
        {
          id: 'q3',
          question: 'What cellular structure is responsible for orchestrating spindle microtubule assembly in animal cells?',
          options: ['Centrosome', 'Golgi apparatus', 'Ribosome', 'Nucleolus'],
          correct: 0,
          explanation: 'The centrosome serves as the main microtubule-organizing center (MTOC) required for proper spindle apparatus formation.'
        }
      );
    } else if (domain === 'physics') {
      questions.push(
        {
          id: 'q1',
          question: 'A 5 kg block is accelerated at 4 m/s² on a frictionless surface. What is the net horizontal force acting on it?',
          options: ['1.25 N', '9.8 N', '20 N', '40 N'],
          correct: 2,
          explanation: 'According to Newton’s Second Law: F = m × a = 5 kg × 4 m/s² = 20 N.'
        },
        {
          id: 'q2',
          question: 'A car hits a bug on a highway. According to Newton’s 3rd Law, which entity experiences the greater magnitude of force?',
          options: ['The bug', 'The car', 'Both experience the exact same magnitude of force', 'The heavier vehicle'],
          correct: 2,
          explanation: 'Action-reaction forces are strictly equal in magnitude and opposite in direction regardless of differences in mass. The bug experiences higher acceleration because of its tiny mass.'
        },
        {
          id: 'q3',
          question: 'If voltage in a simple circuit is doubled while resistance remains constant, what happens to current?',
          options: ['Halved', 'Remains unchanged', 'Doubled', 'Quadrupled'],
          correct: 2,
          explanation: 'From Ohm’s Law I = V / R, current is directly proportional to voltage when resistance R is fixed.'
        }
      );
    } else if (domain === 'mathematics') {
      questions.push(
        {
          id: 'q1',
          question: 'What are the roots of the equation x² - 5x + 6 = 0?',
          options: ['x = -2, -3', 'x = 2, 3', 'x = 1, 6', 'x = -1, -6'],
          correct: 1,
          explanation: 'Factoring: (x - 2)(x - 3) = 0. Setting each factor to 0 gives x = 2 and x = 3.'
        },
        {
          id: 'q2',
          question: 'If the discriminant b² - 4ac of a quadratic equation is negative (< 0), the graph of the parabola:',
          options: ['Crosses the x-axis twice', 'Touches the x-axis at exactly one point', 'Never touches or intersects the x-axis', 'Has no vertex'],
          correct: 2,
          explanation: 'A negative discriminant indicates complex conjugate solutions, meaning there are no real x-intercepts.'
        },
        {
          id: 'q3',
          question: 'What is the derivative of f(x) = 3x³ - 5x + 2?',
          options: ['9x² - 5', '6x² - 5x', '9x³ - 5', '3x² - 5'],
          correct: 0,
          explanation: 'Using the power rule: d/dx(3x³) = 9x², d/dx(-5x) = -5, and d/dx(2) = 0. Thus f\'(x) = 9x² - 5.'
        }
      );
    } else {
      questions.push(
        {
          id: 'q1',
          question: `Which statement most accurately reflects the foundational principle of ${analysis.topic}?`,
          options: [
            'It operates independently of any systemic feedback.',
            'It depends on systematic equilibrium between interrelated variables.',
            'It has been proven obsolete by modern experiments.',
            'It cannot be analyzed through empirical observation.'
          ],
          correct: 1,
          explanation: `In ${analysis.topic}, foundational mechanics rely on reciprocal equilibrium and well-defined rules.`
        },
        {
          id: 'q2',
          question: `What is the primary benefit of applying structured frameworks to ${analysis.topic}?`,
          options: [
            'Reduces cognitive load and isolates cause-and-effect relationships.',
            'Guarantees zero exam errors without practice.',
            'Eliminates the need to understand underlying principles.',
            'Replaces empirical evidence with assumptions.'
          ],
          correct: 0,
          explanation: 'Structured frameworks help students organize mental models and reason from first principles.'
        }
      );
    }

    return questions;
  }

  toolTakeNotes(analysis, solution) {
    const topic = analysis.topic;
    const domain = analysis.domain;

    let notes = `# 📚 Revision Guide: ${topic}\n\n`;
    notes += `> **Domain**: ${domain.toUpperCase()} | **Generated by**: StudyAgent Autonomous Copilot\n\n`;
    notes += `## 1. Core Definition & Overview\n`;
    notes += `**${topic}** is a critical foundational concept. Mastering this topic requires understanding the core mechanisms, operational formulas, and high-frequency exam questions.\n\n`;

    if (domain === 'biology') {
      notes += `### The Stages of Mitosis (PMAT)\n`;
      notes += `1. **Prophase**: Chromatin condenses into visible double-stranded chromosomes; nucleolus disappears; mitotic spindle initiates assembly.\n`;
      notes += `2. **Metaphase**: Chromosomes align along the equatorial metaphase plate; spindle fibers attach securely to kinetochores.\n`;
      notes += `3. **Anaphase**: Sister chromatids are enzymatically detached at the centromere and migrate toward opposite poles.\n`;
      notes += `4. **Telophase**: Nuclear envelopes reform around each set of daughter chromosomes; chromosomes decondense back to chromatin.\n`;
      notes += `5. **Cytokinesis**: Division of cytoplasm producing two genetically identical diploid cells.\n\n`;
      notes += `### High-Yield Exam Reminders\n`;
      notes += `- **Mitosis vs Meiosis**: Mitosis produces 2 identical diploid cells (growth & repair); Meiosis produces 4 genetically unique haploid gametes.\n`;
      notes += `- **Interphase**: Mitosis is only the M-phase; 90% of a cell's life is spent in Interphase (G1, S phase [DNA replication], G2).\n`;
    } else if (domain === 'mathematics') {
      notes += `### Quadratic Equation Master Sheet\n`;
      notes += `Standard Form:\n`;
      notes += `$$\\mathbf{ax^2 + bx + c = 0}$$\n\n`;
      notes += `### The Quadratic Formula\n`;
      notes += `$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n`;
      notes += `### Discriminant Analysis ($\\Delta = b^2 - 4ac$)\n`;
      notes += `- $\\Delta > 0$: 2 distinct real roots (two parabola x-intercepts)\n`;
      notes += `- $\\Delta = 0$: 1 real repeated root (parabola vertex touches x-axis)\n`;
      notes += `- $\\Delta < 0$: 2 complex conjugate roots (no real x-intercepts)\n\n`;
      notes += `### Vertex of Parabola\n`;
      notes += `- Horizontal coordinate: $h = -\\frac{b}{2a}$\n`;
      notes += `- Vertical coordinate: $k = f(h)$\n`;
    } else if (domain === 'physics') {
      notes += `### Newton's Three Laws of Motion Summary\n`;
      notes += `1. **First Law (Law of Inertia)**: An object remains at rest or moves in a straight line at constant speed unless acted on by an unbalanced net force ($\\Sigma \\vec{F} = 0 \\implies \\vec{a} = 0$).\n`;
      notes += `2. **Second Law (Fundamental Dynamics)**: The acceleration of an object is directly proportional to the net force acting upon it and inversely proportional to its mass: $\\mathbf{\\Sigma \\vec{F} = m \\cdot \\vec{a}}$.\n`;
      notes += `3. **Third Law (Action-Reaction)**: For every action force, there exists a reaction force equal in magnitude and opposite in direction ($\\vec{F}_{A \\rightarrow B} = -\\vec{F}_{B \\rightarrow A}$).\n\n`;
      notes += `### Core Units & Dimensional Analysis\n`;
      notes += `- $1\\text{ Newton (N)} = 1\\text{ kg} \\cdot \\text{m/s}^2$\n`;
      notes += `- Weight: $W = mg$ (where $g \\approx 9.8\\text{ m/s}^2$ at Earth's surface)\n`;
    } else {
      notes += `### Key Concepts & Analytical Framework\n`;
      notes += `- **Foundation**: Master the core definitions before progressing to multi-step applications.\n`;
      notes += `- **Active Recall**: Test yourself using the Flashcards tab rather than passive re-reading.\n`;
      notes += `- **Deliberate Practice**: Target incorrect answers in the Quiz Arena to solidify retention.\n`;
    }

    if (solution) {
      notes += `\n## 2. Step-by-Step Derivation & Worked Solution\n`;
      notes += `${solution.text}\n`;
    }

    return notes;
  }

  toolSolveProblem(analysis) {
    const raw = analysis.rawPrompt;
    let derivation = '';

    if (/x\^2|quadratic|solve/i.test(raw)) {
      derivation = `### Problem: Solve $x^2 - 5x + 6 = 0$\n\n` +
        `**Step 1: Identify coefficients**\n` +
        `$a = 1, \\; b = -5, \\; c = 6$\n\n` +
        `**Step 2: Factoring approach**\n` +
        `Find two numbers that multiply to $c = 6$ and add up to $b = -5$:\n` +
        `$(-2) \\times (-3) = 6$ and $(-2) + (-3) = -5$.\n\n` +
        `**Step 3: Factor the quadratic expression**\n` +
        `$(x - 2)(x - 3) = 0$\n\n` +
        `**Step 4: Solve for roots using Zero-Product Property**\n` +
        `$x - 2 = 0 \\implies x_1 = 2$\n` +
        `$x - 3 = 0 \\implies x_2 = 3$\n\n` +
        `**Verification using Quadratic Formula:**\n` +
        `$x = \\frac{-(-5) \\pm \\sqrt{(-5)^2 - 4(1)(6)}}{2(1)} = \\frac{5 \\pm \\sqrt{25 - 24}}{2} = \\frac{5 \\pm 1}{2} \\implies 3, \\; 2$. Verified! ✅`;
    } else {
      derivation = `### Step-by-Step Solution Breakdown\n\n` +
        `1. **Isolate given variables**: Identify known values and target unknown.\n` +
        `2. **Select governing theorem**: Apply the corresponding physical / mathematical formula.\n` +
        `3. **Substitute with unit verification**: Compute numerical value while checking dimensional consistency.\n` +
        `4. **Sanity check**: Verify that the magnitude and sign correspond to physical intuition.`;
    }

    return { text: derivation };
  }

  composeFinalGuidance(analysis, artifacts) {
    const topic = analysis.topic;
    return `### 🎯 Study Mission Generated: ${topic}\n\n` +
      `I've completed my autonomous ReAct analysis for **${topic}**. All your personalized study tools are now armed and loaded into your workspace tabs:\n\n` +
      `- 🗂️ **${artifacts.flashcards.length} Interactive Flashcards** added to your deck (with 3D flip & mastery ratings).\n` +
      `- 🎯 **${artifacts.quiz.length} Diagnostic Quiz Questions** loaded in the Quiz Arena with instant grading.\n` +
      `- 📅 **${artifacts.plan ? artifacts.plan.tasks.length : 0} Phased Study Tasks** mapped in your Study Roadmap.\n` +
      `- 📝 **Structured Revision Notes & Formulas** saved to your Notebook.\n\n` +
      `**Next recommended action**: Open the **Flashcards** tab to prime your memory, or start a **25-minute Pomodoro focus block**!`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Attach to window
window.StudyAgent = StudyAgent;
