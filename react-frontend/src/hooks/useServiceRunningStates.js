import { useEffect, useState } from "react";
import api from "../services/api";

const DEFAULT_POLL_MS = 5000;

// Polls each service's status and returns { [serviceName]: boolean running }.
// Polling only runs while `enabled` is true; it fetches immediately when enabled.
export default function useServiceRunningStates(services, enabled = true, pollMs = DEFAULT_POLL_MS) {
  const [runningStates, setRunningStates] = useState({});

  useEffect(() => {
    if (!enabled || services.length === 0) return undefined;
    let isSubscribed = true;

    async function fetchRunningStates() {
      const results = await Promise.all(
        services.map(async (service) => {
          try {
            const status = await api.get(`/service/${service.name}/status`);
            return [service.name, Boolean(status?.running)];
          } catch {
            return [service.name, false];
          }
        })
      );
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
  }, [enabled, services, pollMs]);

  return runningStates;
}
