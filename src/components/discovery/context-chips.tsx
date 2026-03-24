import { PREMIUM_CHIP } from "@/components/ui/premium-styles";

type ContextChipsProps = {
  chips: string[];
  testId?: string;
};

export function ContextChips({ chips, testId }: ContextChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {chips.map((chip) => (
        <span className={PREMIUM_CHIP} key={chip}>
          {chip}
        </span>
      ))}
    </div>
  );
}
