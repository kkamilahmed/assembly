/** The three screens, left to right as the arrow keys walk them: the
 *  machines (cause), the plant (the line itself, home), the dashboard
 *  (outcome). */
export const VIEWS = ['machines', 'plant', 'dashboard'] as const;
export type View = (typeof VIEWS)[number];

export function stepView(view: View, delta: -1 | 1): View {
  const i = VIEWS.indexOf(view) + delta;
  return VIEWS[Math.max(0, Math.min(VIEWS.length - 1, i))];
}
