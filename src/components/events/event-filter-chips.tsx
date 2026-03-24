import Link from "next/link";

type EventFilterChipsProps = {
  activeTab: "all" | "tonight" | "upcoming" | "circle" | "private";
  query: string;
};

const FILTERS: Array<{ value: EventFilterChipsProps["activeTab"]; label: string }> = [
  { value: "all", label: "All" },
  { value: "tonight", label: "Tonight" },
  { value: "upcoming", label: "Upcoming" },
  { value: "circle", label: "Circle" },
  { value: "private", label: "Private" },
];

function buildEventsHref(tab: EventFilterChipsProps["activeTab"], query: string) {
  const params = new URLSearchParams();
  if (tab !== "all") {
    params.set("tab", tab);
  }
  if (query) {
    params.set("query", query);
  }
  const suffix = params.toString();
  return suffix ? `/events?${suffix}` : "/events";
}

export function EventFilterChips({ activeTab, query }: EventFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="events-filter-bar">
      {FILTERS.map((filter) => {
        const isActive = filter.value === activeTab;
        return (
          <Link
            className={`rounded-full border px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition ${
              isActive
                ? "border-[rgba(229,181,98,0.26)] bg-[rgba(229,181,98,0.12)] text-[#f1ddb2]"
                : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white/62 hover:text-white"
            }`}
            data-testid={`events-filter-${filter.value}`}
            href={buildEventsHref(filter.value, query)}
            key={filter.value}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
