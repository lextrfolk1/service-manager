import { useEffect, useState } from "react";
import api from "../services/api";
import usePageVisible from "./usePageVisible";

const DEFAULT_POLL_MS = 5000;

// Polls service status (one request for all services, without git info) and returns
// { [serviceName]: boolean running }. Polling only runs while `enabled` is true and the
// browser tab is visible; it fetches immediately when enabled.
export default function useServiceRunningStates(services, enabled = true, pollMs = DEFAULT_POLL_MS) {
  const [runningStates, setRunningStates] = useState({});
  const pageVisible = usePageVisible();
  const active = enabled && pageVisible;

  useEffect(() => {
    if (!active || services.length === 0) return undefined;
    let isSubscribed = true;

    async function fetchRunningStates() {
      let statuses = {};
      try {
        const names = services.map((service) => service.name).join(",");
        const data = await api.get(`/services/status?git=false&names=${encodeURIComponent(names)}`);
        statuses = data?.statuses || {};
      } catch {
        // Treat as not running
      }
      const results = services.map((service) => [service.name, Boolean(statuses[service.name]?.running)]);
      if (!isSubscribed) return;
      setRunningStates((previous) => {
        const changed = results.some(([name, running]) => previous[name] !== running);
        return changed ? Object.fromEntries(results) : previous;
      });
    }

    fetchRunningStates();
    const interval = setInterval(fetchRunningStates, pollMs);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [active, services, pollMs]);

  return runningStates;
}
