# 🦁 Brigade Shadow Partner

> An OS-native, Spotlight-style glassmorphic HUD overlay for your self-hosted AI agent crew. Always one shortcut away.

This is a runnable prototype of the **Shadow Partner** desktop overlay client, built with **Electron** and **WebSockets**. It interfaces directly with the local **Spinabot Brigade Gateway** (`localhost:7777`) to trigger agent skills, query the Tideline memory graph, and handle desktop-native command execution approvals.

---

## ✨ Features

1. **Spotlight-Style HUD Overlay:** Summon the overlay instantly from any active application using `Ctrl + Shift + Space` (Mac: `Cmd + Shift + Space`). Press `Esc` to hide.
2. **Interactive Demo Mode:** Includes a built-in high-fidelity simulator that showcases:
   * Context-aware Action Cards (active window and application context).
   * Streaming answers from your agent crew (typewriter simulation).
   * Slid-out Command Execution Gating (desktop approvals).
3. **Live Gateway Connection:** Automatically checks for a running Brigade Gateway at `ws://localhost:7777`. If online, it swaps to live mode, letting you query actual gateway agents and receive real approval prompts.
4. **Vibrant Glassmorphic Aesthetics:** Built with CSS blur-filters, gradient borders, and custom typography to offer a modern, premium experience.

---

## 🚀 Quick Start

### 1. Install Dependencies
Make sure you have [Node.js](https://nodejs.org) installed, then open your terminal in this directory and run:
```bash
npm install
```

### 2. Start the Desktop Client
Run the following command to boot up the overlay:
```bash
npm start
```

### 3. Usage
* Press **`Ctrl + Shift + Space`** (or **`Cmd + Shift + Space`**) to toggle the HUD.
* Select one of the context suggestions using the arrow keys and press **`Enter`** (or click it) to trigger the simulation.
* If a simulated approval card slides out, press **`Enter`** or click **`Approve`** to let the agent complete the command execution.
* Press **`Esc`** or click outside the window to hide the overlay.

---

## 🛠️ How it Works

* **Main Process (`index.js`):** Manages the frameless Electron window, handles global shortcut registration, centers the HUD relative to the main display, and handles IPC resizing messages.
* **Renderer Process (`renderer.js`):** Sets up standard browser WebSockets to connect to `ws://localhost:7777`, manages input states, lists suggestions, types streaming responses, and processes client keyboard navigation.
* **Styles & UI (`styles.css`, `index.html`):** Configures premium frosted-glass filters (`backdrop-filter`) and animated gradients to ensure visual excellence.

---

## 🔗 Connection to Brigade

The desktop client communicates directly using the JSON gateway event channel defined in Brigade's gateway protocol:
* **Outbound Queries:** Sends user messages to the WebSocket gateway.
* **Inbound Stream:** Dynamically listens for `agent_stream` content and renders it.
* **Desktop Approvals:** Gathers user confirmations on `approval_requested` actions, responding with standard confirmation handshakes.
