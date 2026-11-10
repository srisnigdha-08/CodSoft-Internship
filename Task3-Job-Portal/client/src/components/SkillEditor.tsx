import { useState, type KeyboardEvent } from 'react';

/** Tag-style input. Each skill is sent as its own value and stored relationally by the API. */
export function SkillEditor({
  skills,
  onChange,
  placeholder = 'Type a skill and press Enter',
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim().replace(/\s+/g, ' ');
    setDraft('');
    if (!value) return;
    if (!skills.some((skill) => skill.toLowerCase() === value.toLowerCase())) {
      onChange([...skills, value]);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && !draft && skills.length > 0) {
      onChange(skills.slice(0, -1));
    }
  };

  return (
    <div className="skill-editor">
      {skills.map((skill) => (
        <span key={skill} className="skill-chip">
          {skill}
          <button
            type="button"
            aria-label={`Remove ${skill}`}
            onClick={() => onChange(skills.filter((item) => item !== skill))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        aria-label="Add a skill"
        value={draft}
        placeholder={placeholder}
        maxLength={60}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
      />
    </div>
  );
}
