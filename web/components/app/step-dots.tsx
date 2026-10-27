export function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <span>Step {step} of 3</span>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          aria-hidden
          className={`h-2 w-2 rounded-full ${n <= step ? "bg-blue-700" : "bg-neutral-300"}`}
        />
      ))}
    </div>
  );
}
