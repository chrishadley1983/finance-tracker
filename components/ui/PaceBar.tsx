/**
 * Budget bar: the budget sits at 80% of the track so overspend has room to
 * show past it. An optional tick marks where an even pace would be today.
 * Colour only signals trouble: amber = well ahead of pace, red = over budget.
 */
export function paceTone(spent: number, budget: number, pace?: number): 'ok' | 'ahead' | 'over' {
  if (budget <= 0) return spent > 0 ? 'over' : 'ok';
  const used = spent / budget;
  if (used > 1) return 'over';
  if (pace !== undefined && used > pace + 0.15) return 'ahead';
  return 'ok';
}

export function PaceBar({ spent, budget, pace, fixed = false, label }: { spent: number; budget: number; pace?: number; fixed?: boolean; label: string }) {
  const scale = 0.8;
  const used = budget > 0 ? spent / budget : spent > 0 ? 1.25 : 0;
  const width = Math.min(used * scale, 1) * 100;
  const tone = fixed ? 'ok' : paceTone(spent, budget, pace);
  const fill = fixed ? 'bg-line' : tone === 'over' ? 'bg-bad' : tone === 'ahead' ? 'bg-warn' : 'bg-ink-2';
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(budget, spent)}
      aria-valuenow={spent}
      className="relative h-1.5 rounded-full bg-line-2"
    >
      <div className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: `${width}%` }} />
      {pace !== undefined && !fixed && (
        <div className="absolute -inset-y-[3px] w-[1.5px] bg-ink" style={{ left: `${Math.min(pace, 1) * scale * 100}%` }} aria-hidden />
      )}
      <div className="absolute -inset-y-1 w-[1.5px] bg-ink-3" style={{ left: `${scale * 100}%` }} aria-hidden />
    </div>
  );
}
