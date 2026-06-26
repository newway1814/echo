export type DailyPromptSet = {
  todayLabel: string;
  greeting: string;
  dailyPrompt: string;
  promptChips: string[];
};

const promptChips = ["What drained you today?", "A small good thing", "Something you keep avoiding"];

export function getDailyPromptSet(now = new Date()): DailyPromptSet {
  return {
    todayLabel: formatTodayLabel(now),
    greeting: getGreeting(now),
    dailyPrompt: "What's sitting with you today?",
    promptChips,
  };
}

export function formatTodayLabel(now = new Date()) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
    .format(now)
    .replace(",", " ·")
    .toUpperCase();
}

export function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}
