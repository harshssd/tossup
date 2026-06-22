import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClub, listClubs } from './api';
import type { Club } from './types';

const STORAGE_KEY = 'tossup.activeClubId';

interface ClubContextValue {
  clubs: Club[];
  activeClub: Club | null;
  activeClubId: string | null;
  loading: boolean;
  selectClub: (id: string) => Promise<void>;
  addClub: (name: string) => Promise<Club>;
  refresh: () => Promise<void>;
}

const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await listClubs();
    setClubs(list);
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const valid = stored && list.some((c) => c.id === stored) ? stored : list[0]?.id ?? null;
    setActiveClubId(valid);
    if (valid && valid !== stored) await AsyncStorage.setItem(STORAGE_KEY, valid);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const selectClub = useCallback(async (id: string) => {
    setActiveClubId(id);
    await AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  const addClub = useCallback(
    async (name: string) => {
      const club = await createClub(name);
      setClubs((prev) => [...prev, club]);
      await selectClub(club.id);
      return club;
    },
    [selectClub],
  );

  const activeClub = clubs.find((c) => c.id === activeClubId) ?? null;

  return (
    <ClubContext.Provider
      value={{ clubs, activeClub, activeClubId, loading, selectClub, addClub, refresh }}
    >
      {children}
    </ClubContext.Provider>
  );
}

export function useClub(): ClubContextValue {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error('useClub must be used within ClubProvider');
  return ctx;
}
