import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import MappingsClient from "@/components/MappingsClient";

export const dynamic = "force-dynamic";

export default function MappingsPage() {
  return (
    <div>
      <div className="topbar">
        <div className="brand">
          Invictus <span>Dashboard</span>
        </div>
        <div className="nav">
          <Link href="/">Сводка</Link>
          <Link href="/mappings" className="active">Справочники</Link>
          <LogoutButton />
        </div>
      </div>
      <div className="container">
        <MappingsClient />
      </div>
    </div>
  );
}
