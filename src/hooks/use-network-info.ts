import { useEffect, useState } from "react";

export interface NetworkInformation {
  effectiveType: string;
  downlink: number;
  rtt: number;
  isReady: boolean;
}

interface NetworkConnection extends EventTarget {
  effectiveType: string;
  downlink: number;
  rtt: number;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

declare global {
  interface Navigator {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  }
}

const DEFAULT_NETWORK_INFO: NetworkInformation = {
  effectiveType: "",
  downlink: -1,
  rtt: -1,
  isReady: false,
};

const NETWORK_INIT_DELAY_MS = 2000;

export function useNetworkInfo(): NetworkInformation {
  const [networkInfo, setNetworkInfo] =
    useState<NetworkInformation>(DEFAULT_NETWORK_INFO);

  useEffect(() => {
    const getConnection = (): NetworkConnection | null => {
      return (
        navigator.connection ??
        navigator.mozConnection ??
        navigator.webkitConnection ??
        null
      );
    };

    const updateNetworkInfo = () => {
      const connection = getConnection();

      if (!connection) {
        setNetworkInfo((prev) =>
          prev.isReady ? prev : { ...prev, isReady: true }
        );
        return;
      }

      setNetworkInfo({
        effectiveType: connection.effectiveType ?? "",
        downlink: connection.downlink ?? -1,
        rtt: connection.rtt ?? -1,
        isReady: true,
      });
    };

    const connection = getConnection();

    const initTimeout = window.setTimeout(() => {
      if (connection) {
        updateNetworkInfo();
        connection.addEventListener("change", updateNetworkInfo);
      } else {
        setNetworkInfo((prev) => ({ ...prev, isReady: true }));
      }
    }, NETWORK_INIT_DELAY_MS);

    return () => {
      window.clearTimeout(initTimeout);
      if (connection) {
        connection.removeEventListener("change", updateNetworkInfo);
      }
    };
  }, []);

  return networkInfo;
}

export function getNetworkSpeedLabel(
  effectiveType: string,
  downlink: number
): string {
  if (downlink <= 0) {
    return "Speed unknown";
  }

  let speedLabel: string;
  if (downlink >= 10) {
    speedLabel = "Fast";
  } else if (downlink >= 5) {
    speedLabel = "Good";
  } else if (downlink >= 1) {
    speedLabel = "Slow";
  } else {
    speedLabel = "Very slow";
  }

  let typeLabel: string;
  if (effectiveType === "4g") {
    typeLabel = "4G";
  } else if (effectiveType === "3g") {
    typeLabel = "3G";
  } else if (effectiveType === "2g") {
    typeLabel = "2G";
  } else if (effectiveType === "slow-2g") {
    typeLabel = "Slow 2G";
  } else {
    typeLabel = effectiveType || "Unknown";
  }

  return `${speedLabel} (${typeLabel}, ${downlink.toFixed(1)} Mbps)`;
}

export function getNetworkBarCount(effectiveType: string): number {
  switch (effectiveType) {
    case "slow-2g":
      return 1;
    case "2g":
      return 1;
    case "3g":
      return 2;
    case "4g":
      return 3;
    default:
      return 4;
  }
}
