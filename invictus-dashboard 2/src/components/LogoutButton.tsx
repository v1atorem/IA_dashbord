"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <a
      href="#"
      onClick={async (e) => {
        e.preventDefault();
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Выйти
    </a>
  );
}
