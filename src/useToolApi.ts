import React, { useState, useRef } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/clerk-react';
import { track } from '@bilkobibitkov/host-kit';

// Same-origin in production (`bilko.run/projects/headline-grader/` ➜ `bilko.run/api`).
// In `vite dev` set VITE_API_URL=http://localhost:4000 to proxy to a local host.
const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://bilko.run/api';

export function useToolApi<TResult>(endpoint: string) {
  const { getToken } = useAuth();
  const { user, isSignedIn } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  const [result, setResult] = useState<TResult | null>(null);
  const [compareResult, setCompareResult] = useState<any | null>(null);
  const [generateResult, setGenerateResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [needsTokens, setNeedsTokens] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const signInRef = useRef<HTMLButtonElement>(null);

  async function fetchEndpoint(urlSuffix: string, body: Record<string, unknown>, onSuccess: (data: any) => void) {
    if (!isSignedIn) {
      signInRef.current?.click();
      return;
    }
    setLoading(true);
    setResult(null);
    setCompareResult(null);
    setError(null);
    setNeedsTokens(false);
    track('submit_start', { tool: endpoint, metadata: { mode: urlSuffix || 'submit' } });
    try {
      const token = await getToken();
      const res = await fetch(`${API}/demos/${endpoint}${urlSuffix}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...body, email }),
      });
      const data = await res.json();
      if (data.requiresTokens) {
        setNeedsTokens(true);
        setTokenBalance(data.balance ?? 0);
        track('paywall_shown', { tool: endpoint });
        return;
      }
      if (data.gated) {
        setError(data.message || 'Rate limit reached.');
        track('paywall_shown', { tool: endpoint, metadata: { gated: true } });
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onSuccess(data);
      if (data.usage?.balance !== undefined) setTokenBalance(data.usage.balance);
      track('submit_success', { tool: endpoint, metadata: { mode: urlSuffix || 'submit' } });
      if (data.usage?.balance !== undefined) track('credit_spent', { tool: endpoint });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed.');
      track('submit_error', { tool: endpoint, metadata: { message: e instanceof Error ? e.message : 'error' } });
    } finally {
      setLoading(false);
    }
  }

  const submit = (body: Record<string, unknown>) =>
    fetchEndpoint('', body, (data) => setResult(data as TResult));

  const submitCompare = (body: Record<string, unknown>) =>
    fetchEndpoint('/compare', body, setCompareResult);

  async function submitGenerate(body: Record<string, unknown>) {
    if (!isSignedIn) {
      signInRef.current?.click();
      return;
    }
    setGenerating(true);
    setGenerateResult(null);
    setGenError(null);
    track('submit_start', { tool: endpoint, metadata: { mode: 'generate' } });
    try {
      const token = await getToken();
      const res = await fetch(`${API}/demos/${endpoint}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...body, email }),
      });
      const data = await res.json();
      if (data.gated) {
        setGenError(data.message || 'Rate limit reached.');
        track('paywall_shown', { tool: endpoint, metadata: { gated: true } });
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setGenerateResult(data);
      track('submit_success', { tool: endpoint, metadata: { mode: 'generate' } });
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Generation failed.');
      track('submit_error', { tool: endpoint, metadata: { mode: 'generate', message: e instanceof Error ? e.message : 'error' } });
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setResult(null);
    setCompareResult(null);
    setGenerateResult(null);
    setError(null);
    setGenError(null);
    setNeedsTokens(false);
  }

  return {
    result, compareResult, generateResult, generating, genError,
    loading, error, needsTokens, tokenBalance,
    email, isSignedIn,
    submit, submitCompare, submitGenerate, reset,
    signInRef, SignInButton,
  };
}

/** Handler for Cmd/Ctrl+Enter keyboard shortcut on inputs */
export function onCmdEnter(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    fn();
  }
}
