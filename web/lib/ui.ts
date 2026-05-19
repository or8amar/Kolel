/** עיצוב משותף — מבוסס על event-planner (navy + gold + cream) */

const fieldBase =
  "w-full rounded-ep-sm border-[1.5px] border-line bg-white px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-light focus:border-navy md:h-11 md:text-sm";

export const fieldInput = fieldBase;

export const fieldSelect = fieldBase;

export const btnPrimary =
  "inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-ep-sm bg-navy px-5 text-base font-semibold text-white transition active:scale-[0.98] active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-11 md:w-auto md:text-sm";

export const btnGold =
  "inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-ep-sm bg-gold px-5 text-base font-semibold text-navy transition active:scale-[0.98] active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-11 md:w-auto md:text-sm";

export const btnSecondary =
  "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-ep-sm border border-line bg-cream px-5 text-base font-semibold text-ink-mid transition hover:bg-white active:scale-[0.98] disabled:opacity-40 md:min-h-11 md:text-sm";

export const btnSuccess = btnGold;

export const card = "ep-card";
