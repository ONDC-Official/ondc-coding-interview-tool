import type { FormEvent } from 'react';
import { Brand } from '../../components/Brand';
import { Spinner } from '../../components/Spinner';

export type JoinMode = 'form' | 'connecting' | 'full' | 'notfound';

interface Props {
  mode: JoinMode;
  roomId: string;
  name: string;
  onName: (value: string) => void;
  onJoin: () => void;
}

// Candidate-facing gate shown before (and during) connection. One card hosts the
// join form plus the connecting / full / not-found states, mirroring the mockup.
export function JoinGate({ mode, roomId, name, onName, onJoin }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onJoin();
  };

  return (
    <div className="screen-center">
      <div className="panel join-card">
        {mode === 'form' && (
          <form className="join-form" onSubmit={submit}>
            <Brand size={40} name={null} stacked />
            <div className="join-title" style={{ marginTop: 16 }}>
              You’re invited to a coding interview
            </div>
            <div className="join-sub">
              Room <span className="mono accent">{roomId}</span> · 2 participants max
            </div>
            <label className="field-label" htmlFor="join-name">
              Display name
            </label>
            <input
              id="join-name"
              className="text-input"
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="e.g. Riya K."
              autoFocus
            />
            <button className="btn btn-primary btn-block" type="submit">
              Join session
            </button>
          </form>
        )}

        {mode === 'connecting' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <Spinner />
            </div>
            <div className="join-title">Connecting to room…</div>
            <div className="join-sub tight mono">Syncing shared document via Yjs</div>
          </div>
        )}

        {mode === 'full' && (
          <div>
            <div className="join-icon amber">!</div>
            <div className="join-title">Session is full</div>
            <div className="join-sub tight">
              This room already has 2 participants. Each interview room is capped at
              two — ask the interviewer for a new link.
            </div>
          </div>
        )}

        {mode === 'notfound' && (
          <div>
            <div className="join-icon red">?</div>
            <div className="join-title">Session not found</div>
            <div className="join-sub tight">
              This link is invalid or the session has ended. Sessions are created by
              an admin and removed when closed.
            </div>
          </div>
        )}
      </div>

      {mode === 'form' && (
        <div className="join-foot">
          No account required · 2 participants max · end-to-end live sync
        </div>
      )}
    </div>
  );
}
