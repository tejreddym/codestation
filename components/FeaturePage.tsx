import Link from "next/link";
import type { ReactNode } from "react";
export default function FeaturePage({title,intro,children}:{title:string;intro:string;children:ReactNode}) {return <main className="shell"><section className="tool-page feature-page"><nav className="crumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/workbench">Workbench</Link></nav><div className="eyebrow">[ YOUR WORKSPACE ]</div><h1>{title}</h1><p className="lead">{intro}</p>{children}</section></main>;}
