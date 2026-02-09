'use client';

import { useState, useEffect, useRef } from 'react';
import { isAddress } from 'viem';
import { resolveNameToAddress, looksLikeEns } from '@/lib/ens';

export function useEnsResolve(input: string) {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [ensName, setEnsName] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);
    setResolvedAddress(null);
    setEnsName(null);

    if (!input || isAddress(input) || !looksLikeEns(input)) {
      setResolving(false);
      return;
    }

    setResolving(true);
    timeout.current = setTimeout(async () => {
      const address = await resolveNameToAddress(input);
      setResolving(false);
      if (address) {
        setResolvedAddress(address);
        setEnsName(input);
      }
    }, 500);

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [input]);

  // Use resolved address if available, otherwise use raw input
  const effectiveAddress = resolvedAddress || input;

  return { resolvedAddress, resolving, ensName, effectiveAddress };
}
