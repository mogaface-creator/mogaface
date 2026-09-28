export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} MogaFace. Not a medical device.</p>
        <p>Analysis runs locally in your browser.</p>
      </div>
    </footer>
  );
}
