type OpportunityRailProps = {
  children: React.ReactNode;
};

export function OpportunityRail({ children }: OpportunityRailProps) {
  return (
    <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block" data-testid="home-opportunity-rail">
      {children}
    </aside>
  );
}
