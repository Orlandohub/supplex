/**
 * Navigation Store
 * Manages sidebar collapse state with persistence
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NavigationState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) =>
        set({ isSidebarCollapsed: collapsed }),
    }),
    {
      name: "navigation-storage", // localStorage key
    }
  )
);
