import Link from "next/link";
import { InformationalPage, informationalStyles } from "@/components/InformationalPage";
import { metadataForPage } from "@/config/site";
import { stations } from "@/config/stations";
import { tools } from "@/config/tools";

export const metadata = metadataForPage("/site-directory", "Site Directory", "A directory of Code Station information, stations, and tools.");

export default function SiteDirectoryPage() {
  const stationRoutes = stations.filter((station) => station.route.startsWith("/stations/"));
  return <InformationalPage title="Site Directory" intro="Browse the public information pages, implemented stations, and canonical tool routes."><h2>Information</h2><ul className={informationalStyles.directory}>{[["Workbench", "/workbench"], ["Workflows", "/workflows"], ["Batch Images", "/batch-images"], ["Settings", "/settings"], ["Feedback", "/feedback"], ["Offline Tools", "/offline"], ["About", "/about"], ["Privacy Notice", "/privacy"], ["Terms of Use", "/terms"], ["Licenses and Notices", "/licenses"]].map(([name, href]) => <li key={href}><Link href={href}>{name}</Link></li>)}</ul><h2>Stations</h2><ul className={informationalStyles.directory}>{stationRoutes.map((station) => <li key={station.id}><Link href={station.route}>{station.name}</Link><small>{station.toolCount} tools</small></li>)}</ul><h2>Canonical tools</h2><ul className={informationalStyles.directory}>{tools.map((tool) => <li key={tool.id}><Link href={`/tools/${tool.slug}`}>{tool.name}</Link><small>{tool.category}</small></li>)}</ul></InformationalPage>;
}
