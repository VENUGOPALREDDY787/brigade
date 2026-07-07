const { ipcRenderer } = require('electron');

// DOM Elements
const searchInput = document.getElementById('search-input');
const suggestionList = document.getElementById('suggestion-list');
const chatContainer = document.getElementById('chat-container');
const approvalPanel = document.getElementById('approval-panel');
const approvalCommand = document.getElementById('approval-command');
const btnApprove = document.getElementById('btn-approve');
const btnReject = document.getElementById('btn-reject');
const modeBadge = document.getElementById('mode-badge');
const gatewayLink = document.getElementById('gateway-link');
const activeAppBadge = document.getElementById('active-app-badge');
const crewMembers = document.querySelectorAll('.crew-member');
const serverStatusBanner = document.getElementById('server-status-banner');

// Tideline memory graph elements
const tidelineGraphView = document.getElementById('tideline-graph-view');
const graphNodes = document.getElementById('graph-nodes');
const newMemoryInput = document.getElementById('new-memory-input');
const btnAddMemory = document.getElementById('btn-add-memory');

// Active Agent Workers Dashboard elements
const agentWorkerPanel = document.getElementById('agent-worker-panel');
const btnStopWorkers = document.getElementById('btn-stop-workers');
const consoleLogs = document.getElementById('worker-logs-console');

// Worker cards and status labels
const cardLead = document.getElementById('card-lead');
const cardResearch = document.getElementById('card-research');
const cardCoding = document.getElementById('card-coding');
const cardWhatsapp = document.getElementById('card-whatsapp');

const statusLead = document.getElementById('status-lead');
const statusResearch = document.getElementById('status-research');
const statusCoding = document.getElementById('status-coding');
const statusWhatsapp = document.getElementById('status-whatsapp');

// App State
let isLiveMode = false;
let ws = null;
let currentSuggestions = [];
let activeSuggestionIndex = 0;
let currentAgentScope = 'all'; // 'all', 'research', 'coding', 'tideline'

// Simulation Timers (to cancel them on "Stop Workers")
let simulationTimers = [];
let activeSimulationAction = null;
let isCliRunning = false;

// Simulated Desktop environments & focus states
const apps = ['Google Chrome', 'VS Code', 'Command Prompt / Terminal'];
let currentAppIndex = 0;

// Local Mock Tideline Memory Facts List
let mockMemories = [
  {
    text: "I keep a strict vegetarian diet.",
    trust: "1.00",
    relations: ["origin: owner", "preference"]
  },
  {
    text: "Ordered a custom portobello burger.",
    trust: "0.95",
    relations: ["supersedes: I keep a strict vegetarian diet.", "derived_from: wacli"]
  },
  {
    text: "Presenting the Shadow Partner overlay client at the Spinabot Ideathon.",
    trust: "1.00",
    relations: ["origin: owner", "context: 2026-07-07"]
  },
  {
    text: "Voters love visual client overlay tools that are ready and runnable.",
    trust: "0.85",
    relations: ["origin: web-search", "relates: Presenting the Shadow Partner..."]
  }
];

// Context suggestions by active app
const contextSuggestions = {
  'Google Chrome': [
    {
      icon: '💬',
      title: 'Ask John on WhatsApp to return my book',
      sub: 'Resolves contact via Tideline and commands wacli channel integration',
      shortcut: 'Enter',
      action: 'whatsapp-book',
      scope: 'research'
    },
    {
      icon: '📄',
      title: 'Summarize Chrome page: "Multi-Agent Systems"',
      sub: 'Reads active tab DOM and passes to research-agent',
      shortcut: '⌥S',
      action: 'summarize-chrome',
      scope: 'research'
    },
    {
      icon: '🧠',
      title: 'Search Tideline memory for "multi-agent"',
      sub: 'Queries local memory graph (BM25 + HRR)',
      shortcut: '⌥M',
      action: 'query-memory',
      scope: 'tideline'
    }
  ],
  'VS Code': [
    {
      icon: '📁',
      title: 'Scan active project directory',
      sub: 'Checks workspace workspace files using coding-agent',
      shortcut: 'Enter',
      action: 'scan-directory',
      scope: 'coding'
    },
    {
      icon: '🧪',
      title: 'Run Sandbox Simulation',
      sub: 'Diagnoses crew reporting hierarchy for loops and budget leaks',
      shortcut: '⌥D',
      action: 'sandbox',
      scope: 'coding'
    },
    {
      icon: '🛠️',
      title: 'Run codebase check on "src/core/server.ts"',
      sub: 'Resolves imports and checks syntax/types',
      shortcut: '⌥C',
      action: 'code-check',
      scope: 'coding'
    }
  ],
  'Command Prompt / Terminal': [
    {
      icon: '💬',
      title: 'Ask John on WhatsApp to return my book',
      sub: 'Resolves contact via Tideline and commands wacli channel integration',
      shortcut: 'Enter',
      action: 'whatsapp-book',
      scope: 'research'
    },
    {
      icon: '🔏',
      title: 'View Cryptographic Audit Ledger',
      sub: 'Verifies the Proof-of-Trust cryptographically signed actions list',
      shortcut: '⌥A',
      action: 'pot-ledger',
      scope: 'coding'
    },
    {
      icon: '🧠',
      title: 'Recall command completions for "git"',
      sub: 'Retrieves past successful git flows from memory',
      shortcut: '⌥R',
      action: 'query-memory',
      scope: 'tideline'
    }
  ]
};

// Initialize UI
function init() {
  updateContextUI();
  
  // Try connecting to the local Brigade Gateway
  connectToGateway();
  
  // Crew Selector Button Actions: Reset state and filter suggestions
  crewMembers.forEach(member => {
    member.addEventListener('click', () => {
      crewMembers.forEach(m => m.classList.remove('active'));
      member.classList.add('active');
      currentAgentScope = member.getAttribute('data-agent');
      
      resetToSuggestions();
      updateContextUI();
    });
  });

  // Cycle Active App Badge Action
  activeAppBadge.addEventListener('click', () => {
    currentAppIndex = (currentAppIndex + 1) % apps.length;
    resetToSuggestions();
    updateContextUI();
  });

  // Manual Gateway Reconnect Action
  gatewayLink.addEventListener('click', () => {
    gatewayLink.textContent = '🔌 Reconnecting...';
    gatewayLink.style.color = 'var(--accent-purple)';
    connectToGateway();
  });

  // Toggle Mode Badge Action
  modeBadge.addEventListener('click', () => {
    if (!isLiveMode) {
      setLiveState(true, true); // Force simulated live
    } else {
      setLiveState(false, false);
    }
    
    resetToSuggestions();
    updateContextUI();
  });

  // Tideline Graph Commit Memory button
  btnAddMemory.addEventListener('click', commitNewFact);
  newMemoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      commitNewFact();
    }
  });

  // Stop active worker simulator button
  btnStopWorkers.addEventListener('click', stopAllSimulationWorkers);
}

// Reset views back to suggestion lists
function resetToSuggestions() {
  chatContainer.style.display = 'none';
  chatContainer.innerHTML = '';
  approvalPanel.style.display = 'none';
  tidelineGraphView.style.display = 'none';
  searchInput.value = '';
  searchInput.focus();
}

// Update UI based on active app focus and crew filters
function updateContextUI() {
  const currentApp = apps[currentAppIndex];
  activeAppBadge.textContent = `🎯 Active App: ${currentApp}`;
  
  // If the Tideline tab is selected, render the graphical visualizer!
  if (currentAgentScope === 'tideline') {
    renderTidelineGraph();
    return;
  }
  
  // Get suggestions for the active app
  let list = contextSuggestions[currentApp] || [];
  
  // Filter suggestions by selected agent scope
  if (currentAgentScope !== 'all') {
    list = list.filter(item => item.scope === currentAgentScope);
  }
  
  renderSuggestions(list);
}

// Render Suggestions List
function renderSuggestions(list) {
  suggestionList.style.display = 'block';
  tidelineGraphView.style.display = 'none';
  currentSuggestions = list;
  activeSuggestionIndex = 0;
  suggestionList.innerHTML = '';
  
  if (list.length === 0) {
    suggestionList.innerHTML = `<li class="suggestion-item" style="color: var(--text-secondary); text-align: center; justify-content: center; font-size: 13px; pointer-events: none;">No context suggestions for this scope</li>`;
    return;
  }
  
  list.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = `suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}`;
    
    li.innerHTML = `
      <div class="suggestion-left">
        <div class="suggestion-icon">${item.icon}</div>
        <div class="suggestion-info">
          <span class="suggestion-title">${item.title}</span>
          <span class="suggestion-sub">${item.sub}</span>
        </div>
      </div>
      <span class="suggestion-shortcut">${item.shortcut}</span>
    `;
    
    li.addEventListener('click', () => {
      selectSuggestion(item);
    });
    
    suggestionList.appendChild(li);
  });
}

// Render Tideline Lens memory graph
function renderTidelineGraph() {
  suggestionList.style.display = 'none';
  chatContainer.style.display = 'none';
  approvalPanel.style.display = 'none';
  tidelineGraphView.style.display = 'flex';
  
  graphNodes.innerHTML = '';
  
  mockMemories.forEach(node => {
    const div = document.createElement('div');
    div.className = 'graph-node';
    
    let relationTags = '';
    node.relations.forEach(rel => {
      let cssClass = '';
      if (rel.startsWith('supersedes:')) cssClass = 'supersedes';
      else if (rel.startsWith('contradicts:')) cssClass = 'contradicts';
      relationTags += `<span class="relation-tag ${cssClass}">${rel}</span>`;
    });
    
    div.innerHTML = `
      <div class="node-content-row">
        <span class="node-text">${node.text}</span>
        <span class="node-trust">trust: ${node.trust}</span>
      </div>
      <div class="node-relations">
        ${relationTags}
      </div>
    `;
    
    graphNodes.appendChild(div);
  });
  
  graphNodes.scrollTop = graphNodes.scrollHeight;
}

// Add new memory to mock list
function commitNewFact() {
  const text = newMemoryInput.value.trim();
  if (text === '') return;
  
  mockMemories.push({
    text: text,
    trust: "1.00",
    relations: ["origin: owner", "preference", "committed: recently"]
  });
  
  newMemoryInput.value = '';
  renderTidelineGraph();
}

// Adjust Suggestion selection highlight
function updateSuggestionHighlight() {
  const items = suggestionList.querySelectorAll('.suggestion-item');
  items.forEach((item, index) => {
    if (index === activeSuggestionIndex) {
      item.classList.add('active');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('active');
    }
  });
}

// Select a suggestion and trigger action
function selectSuggestion(item) {
  if (isLiveMode && ws && ws.readyState === WebSocket.OPEN) {
    sendQueryToGateway(item.title);
  } else {
    runDemoSimulation(item);
  }
}

// Write to the worker console log
function logConsole(sender, message, styleClass = 'system') {
  const logLine = document.createElement('div');
  logLine.className = `log-line ${styleClass}`;
  
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  
  logLine.textContent = `[${timeStr}] [${sender}] ${message}`;
  consoleLogs.appendChild(logLine);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Reset the worker card statuses
function resetWorkerCards() {
  cardLead.className = 'worker-card';
  cardResearch.className = 'worker-card';
  cardCoding.className = 'worker-card';
  cardWhatsapp.className = 'worker-card';

  statusLead.className = 'worker-status status-idle';
  statusLead.textContent = 'IDLE';
  statusResearch.className = 'worker-status status-idle';
  statusResearch.textContent = 'IDLE';
  statusCoding.className = 'worker-status status-idle';
  statusCoding.textContent = 'IDLE';
  statusWhatsapp.className = 'worker-status status-idle';
  statusWhatsapp.textContent = 'IDLE';
}

// Run interactive simulator for the ideathon
function runDemoSimulation(item) {
  // Clear any existing simulation timers first
  stopAllSimulationWorkers();
  activeSimulationAction = item.action;
  
  suggestionList.style.display = 'none';
  chatContainer.style.display = 'flex';
  chatContainer.innerHTML = '';
  
  // User bubble
  appendChatBubble('user', `Query crew: "${item.title}"`);
  
  if (item.action === 'whatsapp-book') {
    runWhatsAppSimulation();
    return;
  }
  
  // Simulated Agent Stream bubble for default simulations
  setTimeout(() => {
    if (activeSimulationAction !== item.action) return;
    
    const responseText = getSimulatedResponse(item.action);
    const bubble = appendChatBubble('agent', '');
    
    cardLead.classList.add('active-run');
    statusLead.textContent = 'RUNNING';
    statusLead.className = 'worker-status status-running';
    logConsole('lead-agent', `Initiated task: "${item.title}"`, 'lead');
    
    typewriterEffect(bubble, responseText, () => {
      cardLead.classList.remove('active-run');
      statusLead.textContent = 'IDLE';
      statusLead.className = 'worker-status status-idle';
      
      if (item.action === 'summarize-chrome') {
        setTimeout(() => {
          if (activeSimulationAction !== item.action) return;
          showApprovalPanel('npm install -g @spinabot/brigade');
        }, 600);
      } else if (item.action === 'code-check') {
        setTimeout(() => {
          if (activeSimulationAction !== item.action) return;
          showApprovalPanel('npx tsx src/core/server.ts --check');
        }, 600);
      }
    });
  }, 500);
}

// Spawns and executes the actual Brigade CLI on the user's machine (DYNAMIC FLOW)
function runRealBrigadeCLI(queryText) {
  stopAllSimulationWorkers();
  isCliRunning = true;
  
  suggestionList.style.display = 'none';
  chatContainer.style.display = 'flex';
  chatContainer.innerHTML = '';
  
  appendChatBubble('user', queryText);
  const bubble = appendChatBubble('agent', '<p><em>Spawning local Brigade CLI process...</em></p>');
  
  // Update status card
  resetWorkerCards();
  cardLead.classList.add('active-run');
  statusLead.textContent = 'RUNNING';
  statusLead.className = 'worker-status status-running';
  
  logConsole('system', `Executing terminal bridge: "node brigade.mjs agent -m '${queryText}'"`, 'system');
  logConsole('lead-agent', 'Invoking local AI model settings...', 'lead');

  // Trigger IPC execution call
  ipcRenderer.send('run-brigade-cli', queryText);
}

// Clean ANSI color codes from incoming log streams
function cleanAnsiCodes(text) {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

// Listen for CLI output chunks and pipe them dynamically to the chat view in real-time
ipcRenderer.on('cli-stream-chunk', (event, chunk) => {
  if (!isCliRunning) return;
  
  const lastBubble = chatContainer.lastElementChild.querySelector('.chat-bubble-content');
  
  // Clean logs and parse formatting
  const cleanChunk = cleanAnsiCodes(chunk);
  
  // Append text and auto-scroll
  if (lastBubble.querySelector('p')) {
    // If it already has html structure, append to a pre formatted container
    let pre = lastBubble.querySelector('pre');
    if (!pre) {
      pre = document.createElement('pre');
      lastBubble.appendChild(pre);
    }
    pre.textContent += cleanChunk;
  } else {
    // Replace the default loader text
    lastBubble.innerHTML = `<p><strong>[brigade-cli]</strong> Executing agent loop:</p><pre>${cleanChunk}</pre>`;
  }
  
  // Parse logs to update status badges dynamically!
  if (cleanChunk.includes('Delegating') || cleanChunk.includes('sub-agent')) {
    cardResearch.classList.add('active-run');
    statusResearch.textContent = 'DELEGATED';
    statusResearch.className = 'worker-status status-running';
    logConsole('lead-agent', 'Delegating subtasks to research-agent...', 'lead');
  }
  if (cleanChunk.includes('Tideline') || cleanChunk.includes('Memory')) {
    logConsole('tideline-memory', 'Syncing fact recall loops...', 'tideline');
  }
  
  chatContainer.scrollTop = chatContainer.scrollHeight;
});

// Listen for CLI completion
ipcRenderer.on('cli-stream-done', (event, code) => {
  isCliRunning = false;
  
  cardLead.classList.remove('active-run');
  cardResearch.classList.remove('active-run');
  
  if (code === 0) {
    statusLead.textContent = 'SUCCESS';
    statusLead.className = 'worker-status status-success';
    statusResearch.textContent = 'SUCCESS';
    statusResearch.className = 'worker-status status-success';
    logConsole('system', 'Brigade CLI process completed successfully (Exit code: 0).', 'system');
  } else {
    statusLead.textContent = 'ERROR';
    statusLead.className = 'worker-status status-stopped';
    logConsole('system', `Brigade CLI process exited with error code: ${code}.`, 'error');
  }
});

// Advanced WhatsApp Multi-Agent Simulation workflow
function runWhatsAppSimulation() {
  resetWorkerCards();
  consoleLogs.innerHTML = '';
  logConsole('system', 'Starting WhatsApp multi-agent crew execution loop...', 'system');
  
  const t1 = setTimeout(() => {
    cardLead.classList.add('active-run');
    statusLead.textContent = 'RUNNING';
    statusLead.className = 'worker-status status-running';
    logConsole('lead-agent', 'Parsing request: "Ask John on WhatsApp to return my book"', 'lead');
  }, 800);
  simulationTimers.push(t1);

  const t2 = setTimeout(() => {
    cardLead.classList.remove('active-run');
    statusLead.textContent = 'DELEGATED';
    statusLead.className = 'worker-status status-running';
    
    cardWhatsapp.classList.add('active-run');
    statusWhatsapp.textContent = 'RUNNING';
    statusWhatsapp.className = 'worker-status status-running';
    logConsole('lead-agent', 'Delegating message dispatch & contact resolution to whatsapp-agent.', 'lead');
    logConsole('whatsapp-agent', 'Received delegation. Initiating contact resolution for name: "John"...', 'whatsapp');
  }, 2200);
  simulationTimers.push(t2);

  const t3 = setTimeout(() => {
    cardResearch.classList.add('active-run');
    statusResearch.textContent = 'QUERYING';
    statusResearch.className = 'worker-status status-running';
    logConsole('whatsapp-agent', 'Checking Tideline Memory graphs for "John" contact details...', 'whatsapp');
    logConsole('tideline-memory', 'Executing BM25 keyword match for query "John"...', 'tideline');
  }, 3800);
  simulationTimers.push(t3);

  const t4 = setTimeout(() => {
    cardResearch.classList.remove('active-run');
    statusResearch.textContent = 'IDLE';
    statusResearch.className = 'worker-status status-idle';
    logConsole('tideline-memory', 'Found fact: "John (WhatsApp: +91 98765 43210)" (Origin: owner-wacli, Trust: 0.95)', 'tideline');
    logConsole('whatsapp-agent', 'Resolved contact path: +91 98765 43210. Drafting WhatsApp message payload...', 'whatsapp');
  }, 5200);
  simulationTimers.push(t4);

  const t5 = setTimeout(() => {
    cardWhatsapp.classList.remove('active-run');
    statusWhatsapp.textContent = 'WAITING';
    statusWhatsapp.className = 'worker-status status-waiting';
    
    logConsole('whatsapp-agent', 'Draft payload: "Hi John, Venu here. Could you please return my book when you get a chance?"', 'whatsapp');
    logConsole('whatsapp-agent', 'Security policy rule wacli-message-approval requires user confirmation.', 'whatsapp');
    logConsole('system', 'Execution paused. Waiting for operator approval...', 'system');
    
    showApprovalPanel('whatsapp send --to "+91 98765 43210" --msg "Hi John, could you please return my book?"');
  }, 6800);
  simulationTimers.push(t5);
}

// Complete the WhatsApp message simulation once user clicks Approve
function approveWhatsAppMessage() {
  approvalPanel.style.display = 'none';
  logConsole('system', 'Operator APPROVED the command execution.', 'system');
  
  cardWhatsapp.classList.add('active-run');
  statusWhatsapp.textContent = 'RUNNING';
  statusWhatsapp.className = 'worker-status status-running';
  logConsole('whatsapp-agent', 'Connecting to WhatsApp gateway socket adapter...', 'whatsapp');

  const t1 = setTimeout(() => {
    logConsole('whatsapp-agent', 'Handshake completed. Sending message payload to +91 98765 43210...', 'whatsapp');
  }, 1200);
  simulationTimers.push(t1);

  const t2 = setTimeout(() => {
    logConsole('whatsapp-agent', '✔ Message sent successfully! Status: Delivered.', 'whatsapp');
    cardWhatsapp.classList.remove('active-run');
    statusWhatsapp.textContent = 'SUCCESS';
    statusWhatsapp.className = 'worker-status status-success';
    
    logConsole('tideline-memory', 'Writing to facts log: "Asked John to return my book on WhatsApp" (Provenance: owner, Trust: 1.00)', 'tideline');
    
    cardLead.classList.remove('active-run');
    statusLead.textContent = 'SUCCESS';
    statusLead.className = 'worker-status status-success';
    logConsole('system', 'Workflow successfully completed. All subagents terminated cleanly.', 'system');
    
    const bubble = appendChatBubble('agent', '');
    typewriterEffect(bubble, `
      <p style="color: var(--accent-emerald)"><strong>✔ WhatsApp Message Sent</strong></p>
      <p>I have successfully contacted John on WhatsApp asking for your book back.</p>
      <pre>Destination: +91 98765 43210\nContent: "Hi John, could you please return my book?"\nStatus: Sent (Delivered)</pre>
      <p>A record has been committed to your Tideline memory.</p>
    `);
  }, 2800);
  simulationTimers.push(t2);
}

// Stop all running simulations and set status to stopped
function stopAllSimulationWorkers() {
  // Clear all running setTimeout timers
  simulationTimers.forEach(timer => clearTimeout(timer));
  simulationTimers = [];
  activeSimulationAction = null;
  isCliRunning = false;
  
  // Hide approval panel
  approvalPanel.style.display = 'none';
  
  // Set cards to STOPPED status
  const cards = [cardLead, cardResearch, cardCoding, cardWhatsapp];
  const statuses = [statusLead, statusResearch, statusCoding, statusWhatsapp];
  
  cards.forEach(card => {
    if (card) card.className = 'worker-card';
  });
  
  statuses.forEach(status => {
    if (status) {
      status.textContent = 'STOPPED';
      status.className = 'worker-status status-stopped';
    }
  });
  
  logConsole('system', '🛑 Stop Command Received. All running crew workers terminated.', 'error');
}

// Helper to append bubble
function appendChatBubble(sender, text) {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  
  const initials = sender === 'user' ? 'ME' : '🦁';
  
  bubble.innerHTML = `
    <div class="chat-avatar ${sender}">${initials}</div>
    <div class="chat-bubble-content">${text}</div>
  `;
  
  chatContainer.appendChild(bubble);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return bubble.querySelector('.chat-bubble-content');
}

// Typewriter effect for streaming mock output
function typewriterEffect(element, text, callback) {
  let index = 0;
  const speed = 15; 
  
  element.innerHTML = '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const childNodes = Array.from(doc.body.childNodes);
  
  let currentChildIndex = 0;
  
  function nextNode() {
    if (currentChildIndex >= childNodes.length) {
      if (callback) callback();
      return;
    }
    
    const node = childNodes[currentChildIndex];
    if (node.nodeType === Node.TEXT_NODE) {
      let textIndex = 0;
      const textSpan = document.createElement('span');
      element.appendChild(textSpan);
      
      function typeText() {
        if (textIndex < node.textContent.length) {
          textSpan.textContent += node.textContent.charAt(textIndex);
          textIndex++;
          setTimeout(typeText, speed);
        } else {
          currentChildIndex++;
          nextNode();
        }
      }
      typeText();
    } else {
      const clone = node.cloneNode(true);
      element.appendChild(clone);
      currentChildIndex++;
      setTimeout(nextNode, speed * 5);
    }
  }
  
  nextNode();
}

// Mock Responses for Demo Mode
function getSimulatedResponse(action) {
  if (action === 'summarize-chrome') {
    return `
      <p><strong>[research-agent]</strong> Active Tab found: <em>"Multi-Agent Systems"</em>.</p>
      <p>I have scanned the document text. Here is a summary of the core thesis:</p>
      <ul>
        <li><strong>Decentralization:</strong> Isolating agent state and hosting keys locally prevents middleman data harvesting.</li>
        <li><strong>Memory Decay:</strong> Facts in Tideline decline in trust weights unless verified by repeat operations.</li>
      </ul>
      <p>To implement the suggested security hooks, I require installing the global Brigade binary:</p>
    `;
  } else if (action === 'scan-directory') {
    return `
      <p><strong>[coding-agent]</strong> Scanning directory: <code>D:\\saas\\BRIGADE DESKTOP\\brigade</code></p>
      <p>I identified a clean Brigade clone with the following health specs:</p>
      <pre>✔ src/core/server.ts (Port 7777 available)\n✔ src/tideline/ (Memory graph functional)\n✔ Local storage mode: Filesystem (JSONL)</pre>
      <p>No issues found. Your workspace is healthy and ready to run.</p>
    `;
  } else if (action === 'code-check') {
    return `
      <p><strong>[coding-agent]</strong> Performing typecheck and dependency analysis on <code>src/core/server.ts</code>...</p>
      <p>Identified 59 external module references. Resolving TypeScript definitions...</p>
      <p>I require permission to execute the typecheck runner:</p>
    `;
  } else if (action === 'query-memory') {
    return `
      <p><strong>[tideline-memory]</strong> Recalling facts for query <em>"multi-agent"</em>:</p>
      <pre>Hit 1: [Origin: Owner] "I am presenting Brigade Shadow Partner at the spinabot ideathon on July 7, 2026." (Trust: 1.00)\nHit 2: [Origin: owner] "Voters prefer runnable desktop client ideas with visual demos." (Trust: 0.95)</pre>
      <p>Memory recall complete.</p>
    `;
  } else if (action === 'audit-logs') {
    return `
      <p><strong>[research-agent]</strong> Analyzing recent system terminal execution logs...</p>
      <pre>Log: [2026-07-07T16:20:10Z] CMD: git status -> Exit: 0\nLog: [2026-07-07T16:21:40Z] CMD: npm install -> Exit: 0\nLog: [2026-07-07T16:22:15Z] CMD: npm start -> Exit: 1 (ENOENT: path.txt error)</pre>
      <p>All recent failures have been resolved successfully.</p>
    `;
  } else if (action === 'sandbox') {
    return `
      <p><strong>[brigade-sandbox]</strong> Initializing crew reporting dry-run simulation...</p>
      <pre>⚙ Parsing reporting hierarchy in org chart...\n🔬 Checking research-agent ➔ coding-agent delegation paths...\n🔄 Checking circular loops in subagent-policy.ts...\n💰 Auditing token allocation and token safety thresholds...</pre>
      <p style="color: var(--accent-emerald)"><strong>✔ Simulation Status: SAFE</strong></p>
      <ul>
        <li><strong>Cycle status:</strong> No reporting cycles or infinite delegation loops found.</li>
        <li><strong>Budget guard:</strong> Max task budget capped at $5.00. Threat scanner: ACTIVE.</li>
      </ul>
    `;
  } else if (action === 'pot-ledger') {
    return `
      <p><strong>[proof-of-trust]</strong> Fetching signed local audit logs ledger:</p>
      <pre>Hash: 0x8a1d...e3a0 [Approved: git status]\n  • Signer: Operator (Key: 0x6e00...)\n  • Verify status: VALID\n\nHash: 0xef10...6599 [Approved: npm install]\n  • Signer: Operator (Key: 0x6e00...)\n  • Verify status: VALID\n\nHash: 0x7c92...4102 [Blocked: rm -rf /]\n  • Signer: BLOCKED (Access violation)\n  • Verify status: FAILED (Policy vetoed)</pre>
      <p>Ledger matches the local provenance database. Integrity: 100% verified.</p>
    `;
  }
  return '<p>Processing...</p>';
}

// Show Approval Box
function showApprovalPanel(command) {
  approvalCommand.textContent = command;
  approvalPanel.style.display = 'flex';
  btnApprove.focus();
}

// Handle Approval Accept
function approveAction() {
  if (activeSimulationAction === 'whatsapp-book') {
    approveWhatsAppMessage();
    return;
  }
  
  approvalPanel.style.display = 'none';
  
  const cmd = approvalCommand.textContent;
  const bubble = appendChatBubble('agent', '');
  
  if (cmd.includes('npm install')) {
    typewriterEffect(bubble, `
      <p style="color: var(--accent-emerald)"><strong>✔ Command Execution Approved</strong></p>
      <p>Running: <code>npm install -g @spinabot/brigade</code>...</p>
      <pre>added 142 packages, and audited 143 packages in 4s\n\nsuccess: @spinabot/brigade installed globally.</pre>
      <p>Installation complete. Your Shadow Partner overlay is successfully connected!</p>
    `, () => {
      setTimeout(() => {
        appendChatBubble('agent', '<p><em>Demo flow complete. Press Esc to exit overlay, or type a custom query.</em></p>');
      }, 1000);
    });
  } else {
    typewriterEffect(bubble, `
      <p style="color: var(--accent-emerald)"><strong>✔ Command Execution Approved</strong></p>
      <p>Running check command: <code>${cmd}</code>...</p>
      <pre>✔ Typecheck passed: 0 compilation errors found.</pre>
      <p>Operation complete.</p>
    `, () => {
      setTimeout(() => {
        appendChatBubble('agent', '<p><em>Operation complete. Press Esc to exit.</em></p>');
      }, 1000);
    });
  }
}

// Handle Approval Reject
function rejectAction() {
  approvalPanel.style.display = 'none';
  
  if (activeSimulationAction === 'whatsapp-book') {
    logConsole('system', 'Operator REJECTED the WhatsApp dispatch command.', 'error');
    cardWhatsapp.classList.remove('active-run');
    statusWhatsapp.textContent = 'REJECTED';
    statusWhatsapp.className = 'worker-status status-stopped';
  }
  
  appendChatBubble('agent', '<p style="color: var(--accent-rose)"><strong>✘ Command Execution Rejected</strong> by operator. Operation aborted.</p>');
}

// Set visual Live/Simulated Server status states in the UI
function setLiveState(live, simulated = false) {
  isLiveMode = live;
  
  if (live) {
    modeBadge.textContent = 'Gateway Live';
    modeBadge.classList.add('live');
    
    serverStatusBanner.textContent = `● Gateway Server: Connected (${simulated ? 'Simulated' : 'Active on Port 7777'})`;
    serverStatusBanner.className = 'server-status-banner online';
    
    gatewayLink.textContent = `🔗 ws://localhost:7777 ${simulated ? '(Simulated)' : ''}`;
    gatewayLink.style.color = 'var(--accent-emerald)';
  } else {
    modeBadge.textContent = 'Demo Mode';
    modeBadge.classList.remove('live');
    
    serverStatusBanner.textContent = `● Gateway Server: Disconnected (Running in Demo Mode)`;
    serverStatusBanner.className = 'server-status-banner offline';
    
    gatewayLink.textContent = '🔗 localhost:7777 (Offline)';
    gatewayLink.style.color = 'var(--text-secondary)';
  }
}

// WebSocket Connection to local Brigade Gateway
function connectToGateway() {
  ws = new WebSocket('ws://localhost:7777');
  
  ws.onopen = () => {
    setLiveState(true, false);
  };
  
  ws.onclose = () => {
    setLiveState(false, false);
    setTimeout(connectToGateway, 10000);
  };
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleGatewayMessage(msg);
    } catch (e) {
      console.error('Failed to parse gateway message:', e);
    }
  };
}

// Handle inbound WebSocket messages from Gateway
function handleGatewayMessage(msg) {
  if (msg.type === 'agent_stream') {
    if (chatContainer.style.display !== 'flex') {
      suggestionList.style.display = 'none';
      chatContainer.style.display = 'flex';
      chatContainer.innerHTML = '';
      appendChatBubble('agent', '');
    }
    const lastBubble = chatContainer.lastElementChild.querySelector('.chat-bubble-content');
    lastBubble.textContent += msg.content;
  } else if (msg.type === 'approval_requested') {
    showApprovalPanel(msg.command || msg.payload);
  }
}

// Send user query to Gateway
function sendQueryToGateway(query) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    suggestionList.style.display = 'none';
    chatContainer.style.display = 'flex';
    chatContainer.innerHTML = '';
    
    appendChatBubble('user', query);
    appendChatBubble('agent', 'Connecting to gateway agent...');
    
    ws.send(JSON.stringify({
      type: 'user_message',
      content: query,
      timestamp: Date.now()
    }));
  }
}

// Keyboard and Event Listeners
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ipcRenderer.send('hide-window');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (suggestionList.style.display !== 'none' && currentSuggestions.length > 0) {
      activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
      updateSuggestionHighlight();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (suggestionList.style.display !== 'none' && currentSuggestions.length > 0) {
      activeSuggestionIndex = (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
      updateSuggestionHighlight();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (suggestionList.style.display !== 'none' && currentSuggestions.length > 0) {
      selectSuggestion(currentSuggestions[activeSuggestionIndex]);
    } else if (searchInput.value.trim() !== '') {
      const queryText = searchInput.value.trim();
      searchInput.value = '';
      if (isLiveMode) {
        sendQueryToGateway(queryText);
      } else {
        // Run actual local Brigade CLI dynamically if they type a custom query
        runRealBrigadeCLI(queryText);
      }
    }
  }
});

// Search input live filtering
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  const currentApp = apps[currentAppIndex];
  
  if (currentAgentScope === 'tideline') {
    const filteredNodes = mockMemories.filter(node => 
      node.text.toLowerCase().includes(query)
    );
    renderFilteredTidelineGraph(filteredNodes);
    return;
  }
  
  let list = contextSuggestions[currentApp] || [];
  
  if (currentAgentScope !== 'all') {
    list = list.filter(item => item.scope === currentAgentScope);
  }
  
  if (query === '') {
    renderSuggestions(list);
    chatContainer.style.display = 'none';
    approvalPanel.style.display = 'none';
    return;
  }
  
  const filtered = list.filter(item => 
    item.title.toLowerCase().includes(query) || 
    item.sub.toLowerCase().includes(query)
  );
  
  renderSuggestions(filtered);
});

// Render filtered nodes inside Tideline Graph
function renderFilteredTidelineGraph(filteredList) {
  graphNodes.innerHTML = '';
  
  if (filteredList.length === 0) {
    graphNodes.innerHTML = `<div style="text-align: center; color: var(--text-secondary); margin-top: 50px; font-size: 13px;">No memories match your query</div>`;
    return;
  }
  
  filteredList.forEach(node => {
    const div = document.createElement('div');
    div.className = 'graph-node';
    
    let relationTags = '';
    node.relations.forEach(rel => {
      let cssClass = '';
      if (rel.startsWith('supersedes:')) cssClass = 'supersedes';
      else if (rel.startsWith('contradicts:')) cssClass = 'contradicts';
      relationTags += `<span class="relation-tag ${cssClass}">${rel}</span>`;
    });
    
    div.innerHTML = `
      <div class="node-content-row">
        <span class="node-text">${node.text}</span>
        <span class="node-trust">trust: ${node.trust}</span>
      </div>
      <div class="node-relations">
        ${relationTags}
      </div>
    `;
    
    graphNodes.appendChild(div);
  });
}

// IPC messages from main process
ipcRenderer.on('window-shown', () => {
  searchInput.value = '';
  updateContextUI();
  chatContainer.style.display = 'none';
  approvalPanel.style.display = 'none';
  searchInput.focus();
});

// Button events
btnApprove.addEventListener('click', approveAction);
btnReject.addEventListener('click', rejectAction);

// Handle Enter/Esc on approval panel
approvalPanel.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    approveAction();
  } else if (e.key === 'Escape') {
    rejectAction();
  }
});

// Init on load
init();
