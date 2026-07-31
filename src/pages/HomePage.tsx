import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-brand">
          <div className="landing-brand-logo">⚡</div>
          <div>
            <p className="landing-brand-kicker">Developer Utility</p>
            <h1>Socket.IO Runner</h1>
          </div>
        </div>

        <nav className="landing-nav">
          <a href="#problems">Problems</a>
          <a href="#features">Features</a>
          <a href="#use-cases">Use Cases</a>
          <Link to="/runner" className="landing-nav-cta">
            Open Runner
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="hero-badge">Realtime Socket Debugging Tool</div>
            <h2>
              Test Socket.IO events, payloads, acknowledgements, and live
              responses from one clean browser-based workspace.
            </h2>
            <p>
              Socket.IO Runner helps developers connect with auth tokens, send
              request payloads, inspect acknowledgements, monitor incoming
              events, and copy exactly the response they need without building a
              dedicated frontend first.
            </p>

            <div className="hero-actions">
              <Link to="/runner" className="primary-link-btn">
                Launch Socket.IO Runner
              </Link>
              <a href="#problems" className="secondary-link-btn">
                See what problems it solves
              </a>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-header">Why teams use it</div>
            <ul>
              <li>Validate Socket.IO request and response flows quickly.</li>
              <li>Test auth-based connections without writing temporary screens.</li>
              <li>Inspect raw event payloads and acknowledgement data.</li>
              <li>Format loose object-style payloads into valid JSON instantly.</li>
              <li>Copy only the exact response needed for debugging or sharing.</li>
            </ul>
          </div>
        </section>

        <section id="problems" className="content-section">
          <div className="section-heading">
            <p className="section-kicker">Problems solved</p>
            <h2>Why this tool exists</h2>
          </div>

          <div className="card-grid">
            <article className="info-card">
              <h3>Socket flows are hard to test manually</h3>
              <p>
                Traditional API tools are great for HTTP, but realtime event
                debugging usually needs a custom UI, extra logs, or temporary
                development screens.
              </p>
            </article>

            <article className="info-card">
              <h3>Teams waste time building throwaway testers</h3>
              <p>
                Developers often create ad-hoc pages just to connect a socket,
                send one payload, and inspect one response. That slows down
                debugging and adds maintenance overhead.
              </p>
            </article>

            <article className="info-card">
              <h3>Copied payloads are often not valid JSON</h3>
              <p>
                Logs, chats, and backend snippets frequently contain loose
                object-style data with unquoted keys and values that cannot be
                sent directly without cleanup.
              </p>
            </article>
          </div>
        </section>

        <section id="features" className="content-section alt-section">
          <div className="section-heading">
            <p className="section-kicker">Feature overview</p>
            <h2>Built for fast developer workflows</h2>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <h3>JWT-authenticated connection</h3>
              <p>
                Connect to your Socket.IO backend with a token and inspect the
                live connection state directly from the UI.
              </p>
            </article>

            <article className="feature-card">
              <h3>Multi-tab request workspace</h3>
              <p>
                Keep multiple payloads open at the same time so each request
                scenario stays isolated and easy to revisit.
              </p>
            </article>

            <article className="feature-card">
              <h3>Lenient input formatter</h3>
              <p>
                Paste loose JS-like payloads and convert them into clean JSON
                ready for direct emission.
              </p>
            </article>

            <article className="feature-card">
              <h3>Response and event inspection</h3>
              <p>
                Review acknowledgements, connection messages, errors, and custom
                socket events inside one running session.
              </p>
            </article>

            <article className="feature-card">
              <h3>Copy full session or one response</h3>
              <p>
                Copy the entire session log or only a single response block,
                which is ideal for debugging, QA notes, and backend discussions.
              </p>
            </article>

            <article className="feature-card">
              <h3>Built for internal tools and QA</h3>
              <p>
                Useful for developers, testers, and teams working with
                event-based systems, auth flows, and realtime APIs.
              </p>
            </article>
          </div>
        </section>

        <section id="use-cases" className="content-section">
          <div className="section-heading">
            <p className="section-kicker">Common scenarios</p>
            <h2>Where Socket.IO Runner helps most</h2>
          </div>

          <div className="use-case-list">
            <div className="use-case-item">
              <h3>Backend debugging</h3>
              <p>
                Trigger events and inspect raw acknowledgement payloads without
                depending on a mobile or web client flow.
              </p>
            </div>

            <div className="use-case-item">
              <h3>QA verification</h3>
              <p>
                Validate event contracts, payload structure, and auth behavior
                in a simple repeatable interface.
              </p>
            </div>

            <div className="use-case-item">
              <h3>Realtime feature development</h3>
              <p>
                Test new socket-based features while backend and frontend are
                still being developed independently.
              </p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-card">
            <p className="section-kicker">Ready to test your events?</p>
            <h2>Open the runner and start sending payloads.</h2>
            <p>
              Move from problem explanation to actual testing in one click with
              a dedicated runner workspace.
            </p>
            <Link to="/runner" className="primary-link-btn">
              Proceed to Socket.IO Runner
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}