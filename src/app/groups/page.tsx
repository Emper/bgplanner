"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

interface Group {
  _id: string;
  name: string;
  memberCount: number;
  gameCount: number;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch("/api/groups", { credentials: "include" });
        if (!res.ok) throw new Error("Error al cargar los grupos");
        const data = await res.json();
        setGroups(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Mis Grupos</h1>
            <Link
              href="/groups/new"
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 font-medium text-sm"
            >
              Crear grupo
            </Link>
          </div>

          {loading && <p className="text-gray-400">Cargando...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {!loading && !error && groups.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
              No perteneces a ningún grupo todavía. ¡Crea uno o acepta una invitación!
            </div>
          )}

          <div className="grid gap-4">
            {groups.map((group) => (
              <Link
                key={group._id}
                href={`/groups/${group._id}`}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-indigo-300 transition-colors block"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  {group.name}
                </h2>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>{group.memberCount} miembros</span>
                  <span>{group.gameCount} juegos</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
