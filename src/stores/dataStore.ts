import { create } from 'zustand';
import type { ParsedChat, ParsedStatus } from '@/services/calcLogic';

interface DataState {
  rawChats: ParsedChat[];
  rawStatus: ParsedStatus[];
  setRawChats: (chats: ParsedChat[]) => void;
  setRawStatus: (status: ParsedStatus[]) => void;
  clearData: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  rawChats: [],
  rawStatus: [],
  setRawChats: (chats) => set({ rawChats: chats }),
  setRawStatus: (status) => set({ rawStatus: status }),
  clearData: () => set({ rawChats: [], rawStatus: [] }),
}));
