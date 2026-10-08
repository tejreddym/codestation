"use client";
import Link from "next/link";
import { Star } from "lucide-react";
import { getTool } from "@/config/tools";
import { useWorkbench } from "./WorkbenchProvider";
export function FavoriteButton({ slug }: { slug: string }) {
  const { preferences, toggleFavorite } = useWorkbench();
  const active = preferences.favorites.includes(slug);
  const tool = getTool(slug);
  return <button type="button" className="favorite-button" aria-label={`${active ? "Remove" : "Add"} ${tool?.name ?? "tool"} ${active ? "from" : "to"} favorites`} aria-pressed={active} onClick={() => toggleFavorite(slug)}><Star size={17} fill={active ? "currentColor" : "none"} aria-hidden="true" /></button>;
}
export default function PersonalTools({ always = false }: { always?: boolean }) {
  const { preferences, ready } = useWorkbench();
  if (!always && (!ready || (!preferences.favorites.length && !preferences.recent.length))) return null;
  return <section className="personal-tools" aria-label="Your tools">{([['Favorites', preferences.favorites], ['Recently used', preferences.recent]] as const).map(([label, ids]) => <div key={label}><h2>{label}</h2>{ids.length ? <ul>{ids.map(id => { const tool = getTool(id); return tool ? <li key={id}><Link href={`/tools/${tool.slug}`}>{tool.name}</Link>{label === 'Favorites' && <FavoriteButton slug={id} />}</li> : null; })}</ul> : <p className="muted">{label === 'Favorites' ? 'Use a star to keep a tool here.' : 'Tools you visit appear here. Only tool names are remembered.'}</p>}</div>)}</section>;
}
