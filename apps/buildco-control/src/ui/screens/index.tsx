import type { FrayChild } from "@sylwellsoftware/fray";
import type { Screen } from "../../app/contract.ts";
import { OverviewScreen } from "./OverviewScreen.tsx";
import { ProjectsScreen } from "./ProjectsScreen.tsx";
import { PlanningScreen } from "./PlanningScreen.tsx";
import { QueueScreen } from "./QueueScreen.tsx";
import { ResourcesScreen } from "./ResourcesScreen.tsx";
import { IssuesScreen } from "./IssuesScreen.tsx";
import { AnalyticsScreen } from "./AnalyticsScreen.tsx";

export { ScreenView, titles, options } from "./base.tsx";
export { OverviewScreen, ProjectsScreen, PlanningScreen, QueueScreen, ResourcesScreen, IssuesScreen, AnalyticsScreen };

export const screenViews: Record<Screen, FrayChild> = {
  overview: <OverviewScreen screen="overview" />,
  projects: <ProjectsScreen screen="projects" />,
  planning: <PlanningScreen screen="planning" />,
  queue: <QueueScreen screen="queue" />,
  resources: <ResourcesScreen screen="resources" />,
  issues: <IssuesScreen screen="issues" />,
  analytics: <AnalyticsScreen screen="analytics" />,
};
