import { useEffect, useState } from "react";

export default function App() {
  const [result, setResult] = useState("Checking connection...");

  useEffect(() => {
    async function checkConnection() {
      try {
        const response = await fetch("/api/health");

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }

        const data = await response.json();
        setResult(JSON.stringify(data, null, 2));
      } catch (error) {
        setResult(
          error instanceof Error ? error.message : "Connection failed"
        );
      }
    }

    checkConnection();
  }, []);

  return (
    <main>
      <h1>PC Store connection check</h1>
      <pre>{result}</pre>
    </main>
  );
}
