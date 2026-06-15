export function Logo() {
  return (
    <div className="logo-lockup" aria-label="Figura">
      <svg className="logo-mark" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M32 8 39 30 32 56 25 34Z" fill="currentColor" opacity="0.86" />
        <path d="M8 32 30 25 56 32 34 39Z" fill="currentColor" opacity="0.35" />
        <circle cx="32" cy="32" r="5" fill="var(--color-bg)" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}
