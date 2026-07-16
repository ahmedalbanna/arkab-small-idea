import type { ComponentType } from "react";

interface RegisteredHostsProps {
  hosts: ComponentType[];
}

/**
 * Renders every plugin host component once. Hosts run app-level hooks/effects
 * (intervals, indexing, subscriptions) so that logic no longer lives in
 * `App.tsx`.
 */
export function RegisteredHosts({ hosts }: RegisteredHostsProps) {
  return (
    <>
      {hosts.map((Host, index) => (
        <Host key={index} />
      ))}
    </>
  );
}
