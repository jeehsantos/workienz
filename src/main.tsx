import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { validateEnvOrThrow } from "./security/envValidator";

// Validate environment variables at startup
// This will throw an error if required variables are missing or invalid
try {
  validateEnvOrThrow();
} catch (error) {
  console.error(error);
  // Display user-friendly error message
  document.getElementById("root")!.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    ">
      <div style="
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 1rem;
        padding: 2rem;
        max-width: 600px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      ">
        <h1 style="margin: 0 0 1rem 0; font-size: 1.5rem;">⚙️ Configuration Required</h1>
        <p style="margin: 0 0 1rem 0; opacity: 0.9;">
          The application is missing required environment variables.
        </p>
        <pre style="
          background: rgba(0, 0, 0, 0.3);
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          font-size: 0.875rem;
          line-height: 1.5;
        ">${error instanceof Error ? error.message : String(error)}</pre>
        <p style="margin: 1rem 0 0 0; font-size: 0.875rem; opacity: 0.8;">
          Please check the console for more details and refer to .env.example for setup instructions.
        </p>
      </div>
    </div>
  `;
  throw error;
}

createRoot(document.getElementById("root")!).render(<App />);

