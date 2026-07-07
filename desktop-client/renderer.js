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

// App State
let isLiveMode = false;
let ws = null;
let currentSuggestions = [];
let activeSuggestionIndex = 0;
let simulatedStep = 0; // Tracks the progress of the mock demo flow

// Standard Mock suggestions (representing context-aware desktop states)
const defaultSuggestions = [
  {
    icon: '📄',
    title: 'Summarize Chrome page: "Multi-Agent Systems"',
    sub: 'Reads active tab metadata and passes to research-agent',
    shortcut: 'Enter',
    action: 'summarize-chrome'
  },
  {
    icon: '📁',
    title: 'Scan active directory in VS Code',
    sub: 'Checks workspace structures using coding-agent',
    shortcut: '⌥D',
    action: 'scan-directory'
  },
  {
    icon: '🧠',
    title: 'Recall tideline facts about "Ideathon"',
    sub: 'Queries the hybrid local memory graph (BM25 + HRR)',
    shortcut: '⌘M',
    action: 'query-memory'
  }
];

// Initialize UI
function init() {
  renderSuggestions(defaultSuggestions);
  adjustWindowHeight();
  
  // Try connecting to the local Brigade Gateway
  connectToGateway();
}

// Render Suggestions List
function renderSuggestions(list) {
  currentSuggestions = list;
  activeSuggestionIndex = 0;
  suggestionList.innerHTML = '';
  
  if (list.length === 0) {
    suggestionList.style.display = 'none';
    adjustWindowHeight();
    return;
  }
  
  suggestionList.style.display = 'block';
  
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
  
  adjustWindowHeight();
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
    // In Live mode, send query to Gateway
    sendQueryToGateway(item.title);
  } else {
    // Trigger simulated interaction
    runDemoSimulation(item);
  }
}

// Run interactive simulator for the ideathon
function runDemoSimulation(item) {
  suggestionList.style.display = 'none';
  chatContainer.style.display = 'flex';
  chatContainer.innerHTML = '';
  
  // User bubble
  appendChatBubble('user', `Query crew: "${item.title}"`);
  adjustWindowHeight();
  
  // Simulated Agent Stream bubble
  setTimeout(() => {
    const responseText = getSimulatedResponse(item.action);
    const bubble = appendChatBubble('agent', '');
    typewriterEffect(bubble, responseText, () => {
      // Show approval gating panel after streaming response completes
      if (item.action === 'summarize-chrome') {
        setTimeout(() => {
          showApprovalPanel('npm install -g @spinabot/brigade');
        }, 600);
      }
    });
  }, 500);
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
  adjustWindowHeight();
  return bubble.querySelector('.chat-bubble-content');
}

// Typewriter effect for streaming mock output
function typewriterEffect(element, text, callback) {
  let index = 0;
  // Speed of characters
  const speed = 15; 
  
  // We can inject HTML elements directly to support structured text
  element.innerHTML = '';
  
  // Use a temporary parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const childNodes = Array.from(doc.body.childNodes);
  
  let currentChildIndex = 0;
  
  function nextNode() {
    if (currentChildIndex >= childNodes.length) {
      adjustWindowHeight();
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
          adjustWindowHeight();
          setTimeout(typeText, speed);
        } else {
          currentChildIndex++;
          nextNode();
        }
      }
      typeText();
    } else {
      // Element node - append directly for pre-formatted elements
      const clone = node.cloneNode(true);
      element.appendChild(clone);
      currentChildIndex++;
      adjustWindowHeight();
      setTimeout(nextNode, speed * 5);
    }
  }
  
  nextNode();
}

// Mock Responses for Demo Mode
function getSimulatedResponse(action) {
  if (action === 'summarize-chrome') {
    return `
      <p><strong>[research-agent]</strong> Active Tab found: <em>"Multi-Agent Orchestration & Sovereignty"</em>.</p>
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
  } else if (action === 'query-memory') {
    return `
      <p><strong>[tideline-memory]</strong> Recalling facts for query <em>"Ideathon"</em>:</p>
      <pre>Hit 1: [Origin: Owner] "I am presenting Brigade Shadow Partner at the spinabot ideathon on July 7, 2026." (Trust: 1.00)\nHit 2: [Origin: owner] "Voters prefer runnable desktop client ideas with visual demos." (Trust: 0.95)</pre>
      <p>Memory recall complete.</p>
    `;
  }
  return '<p>Processing...</p>';
}

// Show Approval Box
function showApprovalPanel(command) {
  approvalCommand.textContent = command;
  approvalPanel.style.display = 'flex';
  adjustWindowHeight();
  
  // Shift focus to button
  btnApprove.focus();
}

// Handle Approval Accept
function approveAction() {
  approvalPanel.style.display = 'none';
  adjustWindowHeight();
  
  const bubble = appendChatBubble('agent', '');
  typewriterEffect(bubble, `
    <p style="color: var(--accent-emerald)"><strong>✔ Command Execution Approved</strong></p>
    <p>Running: <code>npm install -g @spinabot/brigade</code>...</p>
    <pre>added 142 packages, and audited 143 packages in 4s\n\nsuccess: @spinabot/brigade installed globally.</pre>
    <p>Installation complete. Your Shadow Partner overlay is successfully connected!</p>
  `, () => {
    setTimeout(() => {
      // Finish Demo
      appendChatBubble('agent', '<p><em>Demo flow complete. Press Esc to exit overlay, or type a custom query.</em></p>');
    }, 1000);
  });
}

// Handle Approval Reject
function rejectAction() {
  approvalPanel.style.display = 'none';
  adjustWindowHeight();
  appendChatBubble('agent', '<p style="color: var(--accent-rose)"><strong>✘ Command Execution Rejected</strong> by operator. Operation aborted.</p>');
}

// Dynamically adjust Electron Window Height based on content scroll height
function adjustWindowHeight() {
  const container = document.getElementById('hud-container');
  const height = container.scrollHeight + 20; // add padding
  ipcRenderer.send('set-height', height);
}

// WebSocket Connection to local Brigade Gateway
function connectToGateway() {
  ws = new WebSocket('ws://localhost:7777');
  
  ws.onopen = () => {
    isLiveMode = true;
    modeBadge.textContent = 'Gateway Live';
    modeBadge.classList.add('live');
    gatewayLink.textContent = '🔗 ws://localhost:7777';
    gatewayLink.style.color = 'var(--accent-emerald)';
  };
  
  ws.onclose = () => {
    isLiveMode = false;
    modeBadge.textContent = 'Demo Mode';
    modeBadge.classList.remove('live');
    gatewayLink.textContent = '🔗 localhost:7777 (Offline)';
    gatewayLink.style.color = 'var(--text-secondary)';
    // Retry in 10 seconds
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
  // Support Brigade protocol message shapes
  if (msg.type === 'agent_stream') {
    // Stream text into chat view
    if (chatContainer.style.display !== 'flex') {
      suggestionList.style.display = 'none';
      chatContainer.style.display = 'flex';
      chatContainer.innerHTML = '';
      appendChatBubble('agent', '');
    }
    const lastBubble = chatContainer.lastElementChild.querySelector('.chat-bubble-content');
    lastBubble.textContent += msg.content;
    adjustWindowHeight();
  } else if (msg.type === 'approval_requested') {
    // Show approval requested from actual gateway agent
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
      // User typed custom query
      const queryText = searchInput.value.trim();
      searchInput.value = '';
      if (isLiveMode) {
        sendQueryToGateway(queryText);
      } else {
        // Run demo simulation with custom text
        runDemoSimulation({
          title: queryText,
          action: 'summarize-chrome' // default to demo summary
        });
      }
    }
  }
});

// Search input live filtering
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  
  if (query === '') {
    renderSuggestions(defaultSuggestions);
    chatContainer.style.display = 'none';
    approvalPanel.style.display = 'none';
    return;
  }
  
  // Filter default suggestions based on search
  const filtered = defaultSuggestions.filter(item => 
    item.title.toLowerCase().includes(query) || 
    item.sub.toLowerCase().includes(query)
  );
  
  renderSuggestions(filtered);
});

// IPC messages from main process
ipcRenderer.on('window-shown', () => {
  searchInput.value = '';
  renderSuggestions(defaultSuggestions);
  chatContainer.style.display = 'none';
  approvalPanel.style.display = 'none';
  searchInput.focus();
  adjustWindowHeight();
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

// Toggle badge mode manually if clicked (for demo purposes)
modeBadge.addEventListener('click', () => {
  if (!isLiveMode) {
    // Force toggle to mock live gateway state
    isLiveMode = true;
    modeBadge.textContent = 'Gateway Live';
    modeBadge.classList.add('live');
    gatewayLink.textContent = '🔗 ws://localhost:7777 (Simulated)';
    gatewayLink.style.color = 'var(--accent-emerald)';
  } else {
    isLiveMode = false;
    modeBadge.textContent = 'Demo Mode';
    modeBadge.classList.remove('live');
    gatewayLink.textContent = '🔗 localhost:7777';
    gatewayLink.style.color = 'var(--text-secondary)';
  }
});

// Init on load
init();
