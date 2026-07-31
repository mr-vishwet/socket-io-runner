import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io, Socket } from "socket.io-client";

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
  "type": "some-service",
  "action": "some-action",
  "payload": {
    "id": "some-id"
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
    .map(
      (l) =>
        `[${l.time}] ${l.title}${
          l.data !== undefined ? "\n" + formatData(l.data) : ""
        }`
    )
    .join("\n\n");

const sanitizeLooseObject = (text: string): string => {
  let s = text.trim();

  // Convert single-quoted strings to double-quoted strings
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, inner) => {
    const escaped = inner.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  // Quote unquoted object keys
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)\s*:/g, '$1"$2":');

  // Quote bare values like some-service, some-action, some-id
  s = s.replace(
    /:(\s*)([A-Za-z0-9_$-][A-Za-z0-9_$-]*)(\s*[,}\]])/g,
    (match, spacing, value, tail) => {
      if (/^(true|false|null)$/.test(value)) return match;
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) return match;
      return `:${spacing}"${value}"${tail}`;
    }
  );

  // Remove trailing commas
  s = s.replace(/,(\s*[}\]])/g, "$1");

  return s;
};

const lenientParse = (text: string): any => {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty input");

  try {
    return JSON.parse(trimmed);
  } catch {
    //
  }

  try {
    const sanitized = sanitizeLooseObject(trimmed);
    return JSON.parse(sanitized);
  } catch {
    //
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${trimmed});`);
    const result = fn();

    if (result === undefined) {
      throw new Error("Could not evaluate input");
    }

    return result;
  } catch (e: any) {
    throw new Error(`Could not parse as JSON or JS object: ${e.message}`);
  }
};

export default function RunnerPage() {
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
      broadcastLog(
        "event",
        `📩 Event: ${event}`,
        args.length === 1 ? args[0] : args
      );
    });
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
    setSocketId(null);
  };

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
      {
        id,
        name: `Request ${tabCounter.current}`,
        request: DEFAULT_REQUEST,
        logs: [],
      },
    ]);

    setActiveId(id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;

    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id && next.length > 0) setActiveId(next[0].id);
      return next;
    });
  };

  const renameTab = (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    const name = window.prompt("Rename tab", tab?.name ?? "");
    if (!name?.trim()) return;

    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: name.trim() } : t))
    );
  };

  const updateRequest = (id: string, value: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, request: value } : t))
    );
  };

  const clearLogs = (id: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, logs: [] } : t)));
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1200);
    } catch {
      //
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">⚡</div>
          <div>
            <h2>Socket.IO Runner</h2>
            <p className="brand-sub">Realtime request inspector</p>
          </div>
        </div>

        <Link to="/" className="back-home-link">
          ← Back to overview
        </Link>

        <div className="field-group">
          <label htmlFor="socket-url">Socket URL</label>
          <input
            id="socket-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:8000"
          />
        </div>

        <div className="field-group">
          <label htmlFor="auth-token">Auth Token (JWT)</label>
          <textarea
            id="auth-token"
            rows={5}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your auth token here"
          />
        </div>

        <div className="conn-controls">
          <button
            className="btn btn-primary"
            onClick={connect}
            disabled={connected}
          >
            Connect
          </button>
          <button
            className="btn btn-ghost"
            onClick={disconnect}
            disabled={!connected}
          >
            Disconnect
          </button>
        </div>

        <div className={`status-pill ${connected ? "online" : "offline"}`}>
          <span className="dot" />
          {connected ? "Connected" : "Disconnected"}
        </div>

        {connected && socketId && <div className="socket-id">ID: {socketId}</div>}
      </aside>

      <main className="main-panel tool-page">
        <section className="runner-topbar">
          <div>
            <p className="runner-topbar-kicker">Tool workspace</p>
            <h1>Socket.IO Runner</h1>
            <p className="runner-topbar-text">
              Connect, format payloads, send events, inspect acknowledgements,
              and copy exactly the response you need.
            </p>
          </div>
        </section>

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
                  aria-label={`Close ${t.name}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button
            className="add-tab"
            onClick={addTab}
            title="Add request tab"
            aria-label="Add request tab"
          >
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
                <button
                  className="btn btn-primary"
                  onClick={() => send(activeTab.id)}
                >
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
                    onClick={() =>
                      copyText(formatLogs(activeTab.logs), `${activeTab.id}-res`)
                    }
                  >
                    {copiedKey === `${activeTab.id}-res` ? "Copied!" : "Copy All"}
                  </button>

                  <button
                    className="clear-btn"
                    onClick={() => clearLogs(activeTab.id)}
                  >
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

                        {log.data !== undefined && (
                          <button
                            className="copy-btn copy-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyText(formatData(log.data), log.id);
                            }}
                          >
                            {copiedKey === log.id ? "Copied!" : "Copy"}
                          </button>
                        )}
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