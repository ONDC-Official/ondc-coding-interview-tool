import { useNavigate } from 'react-router-dom';
import { customAlphabet } from 'nanoid';
import { Brand } from './Brand.jsx';

// Base62, length 16 -> ~95 bits of entropy. Hard to guess / enumerate.
const newRoomId = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  16
);

export default function Landing() {
  const navigate = useNavigate();

  const createSession = () => {
    navigate(`/s/${newRoomId()}`);
  };

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="landing-brand">
          <Brand size={40} stacked />
        </div>
        <p className="tagline">
          A private, real-time collaborative editor for one-on-one DSA coding
          interviews.
        </p>
        <button className="btn btn-primary" onClick={createSession}>
          Create new session
        </button>
        <p className="hint">
          A fresh, secret room link is generated. Share it with exactly one
          candidate — sessions are capped at 2 people.
        </p>
      </div>
    </div>
  );
}
