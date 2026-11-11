"use client";
import { useEffect, useRef, useState } from 'react';
import { startLayoutTrace } from '../lib/layout-trace';

export function CandidateLayoutTrace() {
  const stop = useRef<ReturnType<typeof startLayoutTrace> | null>(null);
  const mounted = useRef(true);
  const [running, setRunning] = useState(false), [result, setResult] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current?.('cancelled'); stop.current = null; }; }, []);
  const start = () => {
    if (stop.current) return;
    setResult(''); setRunning(true);
    stop.current = startLayoutTrace(trace => {
      stop.current = null;
      if (mounted.current) { setRunning(false); setResult(JSON.stringify(trace, null, 2)); }
    });
  };
  return <details className="candidate-layout-trace">
    <summary>Layout diagnostic · isolated development</summary>
    <p>Capture up to 20 seconds of screen geometry. Records and phrases are excluded. Nothing is sent or saved automatically.</p>
    <button type="button" disabled={running} onClick={start}>Start layout capture</button>
    <button type="button" disabled={!running} onClick={() => stop.current?.()}>Stop layout capture</button>
    <p role="status">{running ? 'Capturing geometry. Scroll normally; capture stops automatically.' : result ? 'Capture complete. Geometry report is available below.' : 'Capture idle.'}</p>
    {result && <><label htmlFor="candidate-layout-report">Geometry report</label><textarea id="candidate-layout-report" readOnly value={result} rows={6}/><button type="button" onClick={() => setResult('')}>Discard layout report</button></>}
  </details>;
}
