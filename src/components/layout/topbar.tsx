"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, User, LogOut, Search } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { useAuthStore } from "@/stores/auth.store";
import { authApi } from "@/lib/api/auth";

export function Topbar() {
  const { toggleSidebar } = useUIStore();
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = user
    ? `${user.firstname.charAt(0)}${user.lastname.charAt(0)}`.toUpperCase()
    : "?";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout errors
    } finally {
      clearAuth();
      router.push("/login");
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // `relative` est indispensable : sans classe de positionnement, `z-index` est
  // ignoré (position: static), et le menu profil passait alors sous le PageHeader
  // collant du contenu (z-20). `shrink-0` empêche la barre d'être compressée.
  return (
    <header className="relative z-40 shrink-0 bg-white shadow h-16 flex items-center px-4 justify-between">
      {/* Left: hamburger */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Center: search bar */}
      <form onSubmit={handleSearch} className="hidden sm:flex items-center gap-2 flex-1 max-w-md mx-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher… (patients, examens…)"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </form>

      {/* Right: user dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 focus:outline-none"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {user?.firstname ?? ""}
          </span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
            <div className="px-4 py-2 text-gray-500 text-sm">Bienvenue !</div>
            <Link
              href="/profile"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              <User className="w-4 h-4" />
              Mon compte
            </Link>
            <hr className="my-1 border-gray-200" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
