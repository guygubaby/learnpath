import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UiState = {
  selectedChildId: string | null
  selectChild: (id: string | null) => void
  authOpen: boolean
  setAuthOpen: (open: boolean) => void
  profileOpen: boolean
  setProfileOpen: (open: boolean) => void
}
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      selectedChildId: null,
      selectChild: (id) => set({ selectedChildId: id }),
      authOpen: false,
      setAuthOpen: (open) => set({ authOpen: open }),
      profileOpen: false,
      setProfileOpen: (open) => set({ profileOpen: open }),
    }),
    {
      name: 'learnpath-preferences',
      partialize: (state) => ({ selectedChildId: state.selectedChildId }),
    },
  ),
)
