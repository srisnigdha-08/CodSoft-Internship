import { useState, type FormEvent } from 'react';

export function SearchBox({
  placeholder,
  onSearch,
}: {
  placeholder: string;
  onSearch: (value: string) => void;
}) {
  const [value, setValue] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(value.trim());
  };

  return (
    <form className="inline-search" onSubmit={submit} role="search">
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className="btn btn-secondary btn-sm">
        Search
      </button>
    </form>
  );
}
