import type {FrayChild} from "@sylwellsoftware/fray";
import type {Screen} from "../api/ScenarioApi.ts";
import {OverviewScreen} from "./OverviewView/OverviewScreen.tsx";
import {ProjectsScreen} from "./ProjectsView/ProjectsScreen.tsx";
import {PlanningScreen} from "./PlanningView/PlanningScreen.tsx";
import {QueueScreen} from "./QueueView/QueueScreen.tsx";
import {ResourcesScreen} from "./ResourcesView/ResourcesScreen.tsx";
import {IssuesScreen} from "./IssuesView/IssuesScreen.tsx";
import {AnalyticsScreen} from "./AnalyticsView/AnalyticsScreen.tsx";

export {ScreenView, titles, options} from "./shared/ScreenView.tsx";
export {OverviewScreen, ProjectsScreen, PlanningScreen, QueueScreen, ResourcesScreen, IssuesScreen, AnalyticsScreen};

export const screenViews: Record<Screen, FrayChild> = {
    overview: <OverviewScreen screen="overview"/>,
    projects: <ProjectsScreen screen="projects"/>,
    planning: <PlanningScreen screen="planning"/>,
    queue: <QueueScreen screen="queue"/>,
    resources: <ResourcesScreen screen="resources"/>,
    issues: <IssuesScreen screen="issues"/>,
    analytics: <AnalyticsScreen screen="analytics"/>,
};
