import { useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";

type LogType = "info" | "sent" | "response" | "event" | "error";

interface LogEntry {
  id: string;
  time: string;
  type: LogType;
  title: string;
  data?: any;
}

interface ReqTab {
  id: string;
  name: string;
  request: string;
  logs: LogEntry[];
}

const DEFAULT_REQUEST = `{
  "type": "userService",
  "action": "get",
  "payload": {
    "unionCode": "UNION-149136"
  }
}`;

const genId = () => Math.random().toString(36).slice(2, 10);

const formatData = (data: any) =>
  data === undefined
    ? ""
    : typeof data === "string"
    ? data
    : JSON.stringify(data, null, 2);

const formatLogs = (logs: LogEntry[]) =>
  logs
    .map((l) => `[${l.time}] ${l.title}${l.data !== undefined ? "\n" + formatData(l.data) : ""}`)
    .join("\n\n");

/**
 * Lenient parser: accepts strict JSON first. If that fails, falls back to
 * treating the text as a JS object literal (unquoted keys, single quotes,
 * trailing commas, comments) so pasted JS-style payloads still work.
 */
const lenientParse = (text: string): any => {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty input");

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to lenient parsing
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${trimmed});`);
    const result = fn();
    if (result === undefined) throw new Error("Could not evaluate input");
    return result;
  } catch (e: any) {
    throw new Error(`Could not parse as JSON or JS object: ${e.message}`);
  }
};

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const tabCounter = useRef(1);

  const [url, setUrl] = useState("http://localhost:8000");
  const [token, setToken] = useState("PASTE_YOUR_JWT_TOKEN_HERE");
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);

  const [tabs, setTabs] = useState<ReqTab[]>([
    { id: "t1", name: "Request 1", request: DEFAULT_REQUEST, logs: [] },
  ]);
  const [activeId, setActiveId] = useState("t1");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const pushLog = (tabId: string, type: LogType, title: string, data?: any) => {
    const entry: LogEntry = {
      id: genId(),
      time: new Date().toLocaleTimeString(),
      type,
      title,
      data,
    };
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, logs: [...t.logs, entry] } : t))
    );
  };

  const broadcastLog = (type: LogType, title: string, data?: any) => {
    const entry: LogEntry = {
      id: genId(),
      time: new Date().toLocaleTimeString(),
      type,
      title,
      data,
    };
    setTabs((prev) => prev.map((t) => ({ ...t, logs: [...t.logs, entry] })));
  };

  const connect = () => {
    if (socketRef.current?.connected) return;

    broadcastLog("info", "🔄 Connecting...", url);

    const socket = io(url, {
      transports: ["websocket"],
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSocketId(socket.id ?? null);
      broadcastLog("info", "✅ Connected", socket.id);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      setSocketId(null);
      broadcastLog("error", "❌ Disconnected", reason);
    });

    socket.on("connect_error", (err) => {
      broadcastLog("error", "🚫 Connection Error", err.message);
    });

    socket.on("error", (err) => {
      broadcastLog("error", "🚫 Error", err);
    });

    socket.onAny((event, ...args) => {
      broadcastLog("event", `📩 Event: ${event}`, args.length === 1 ? args[0] : args);
    });
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
    setSocketId(null);
  };

  /** Reformats a tab's request text in place, using the lenient parser. */
  const formatTab = (tabId: string, showError = false) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    try {
      const parsed = lenientParse(tab.request);
      const pretty = JSON.stringify(parsed, null, 2);
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, request: pretty } : t))
      );
    } catch (e: any) {
      if (showError) pushLog(tabId, "error", "❌ Could not format", e.message);
    }
  };

  const send = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (!socketRef.current?.connected) {
      pushLog(tabId, "error", "⚠ Socket not connected");
      return;
    }

    let body: any;
    try {
      body = lenientParse(tab.request);
    } catch (e: any) {
      pushLog(tabId, "error", "❌ Invalid request", e.message);
      return;
    }

    // Normalize the textarea to clean JSON now that we know it parses
    const pretty = JSON.stringify(body, null, 2);
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, request: pretty } : t))
    );

    pushLog(tabId, "sent", "⬆ Sent", body);

    socketRef.current.emit("action", body, (ack: any) => {
      pushLog(tabId, "response", "⬇ Response", ack);
    });
  };

  const addTab = () => {
    tabCounter.current += 1;
    const id = genId();
    setTabs((prev) => [
      ...prev,
      { id, name: `Request ${tabCounter.current}`, request: DEFAULT_REQUEST, logs: [] },
    ]);
    setActiveId(id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  };

  const renameTab = (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    const name = window.prompt("Rename tab", tab?.name ?? "");
    if (name) {
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    }
  };

  const updateRequest = (id: string, value: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, request: value } : t)));
  };

  const clearLogs = (id: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, logs: [] } : t)));
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    } catch {
      // clipboard unavailable, ignore
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">⚡</div>
          <div>
            <h1>Socket.IO Tester</h1>
            <p className="brand-sub">Realtime request inspector</p>
          </div>
        </div>

        <div className="field-group">
          <label>Socket URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>

        <div className="field-group">
          <label>Auth Token (JWT)</label>
          <textarea rows={5} value={token} onChange={(e) => setToken(e.target.value)} />
        </div>

        <div className="conn-controls">
          <button className="btn btn-primary" onClick={connect} disabled={connected}>
            Connect
          </button>
          <button className="btn btn-ghost" onClick={disconnect} disabled={!connected}>
            Disconnect
          </button>
        </div>

        <div className={`status-pill ${connected ? "online" : "offline"}`}>
          <span className="dot" />
          {connected ? "Connected" : "Disconnected"}
        </div>

        {connected && socketId && <div className="socket-id">ID: {socketId}</div>}
      </aside>

      <main className="main-panel">
        <div className="tab-bar">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={`tab ${t.id === activeId ? "active" : ""}`}
              onClick={() => setActiveId(t.id)}
              onDoubleClick={() => renameTab(t.id)}
            >
              <span>{t.name}</span>
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button className="add-tab" onClick={addTab} title="Add request tab">
            +
          </button>
        </div>

        {activeTab && (
          <div className="panel-split">
            <div className="panel request-panel">
              <div className="panel-header">
                <span>Request</span>
                <button
                  className="copy-btn"
                  onClick={() => copyText(activeTab.request, `${activeTab.id}-req`)}
                >
                  {copiedKey === `${activeTab.id}-req` ? "Copied!" : "Copy"}
                </button>
              </div>
              <textarea
                className="code-area"
                spellCheck={false}
                value={activeTab.request}
                onChange={(e) => updateRequest(activeTab.id, e.target.value)}
                onBlur={() => formatTab(activeTab.id)}
              />
              <div className="panel-footer footer-row">
                <button className="btn btn-primary" onClick={() => send(activeTab.id)}>
                  Send ▶
                </button>
                <button
                  className="format-btn"
                  onClick={() => formatTab(activeTab.id, true)}
                >
                  Format
                </button>
              </div>
            </div>

            <div className="divider" />

            <div className="panel response-panel">
              <div className="panel-header">
                <span>Response</span>
                <div className="panel-header-actions">
                  <button
                    className="copy-btn"
                    onClick={() => copyText(formatLogs(activeTab.logs), `${activeTab.id}-res`)}
                  >
                    {copiedKey === `${activeTab.id}-res` ? "Copied!" : "Copy"}
                  </button>
                  <button className="clear-btn" onClick={() => clearLogs(activeTab.id)}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="console">
                {activeTab.logs.length === 0 ? (
                  <div className="console-empty">No logs yet…</div>
                ) : (
                  activeTab.logs.map((log) => (
                    <div key={log.id} className={`log-entry log-${log.type}`}>
                      <div className="log-meta">
                        <span className="log-time">{log.time}</span>
                        <span className="log-title">{log.title}</span>
                      </div>
                      {log.data !== undefined && (
                        <pre className="log-data">{formatData(log.data)}</pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}