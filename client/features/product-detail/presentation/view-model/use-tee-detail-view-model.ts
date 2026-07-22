"use client";

// ViewModel (MVVM) — 상세 화면. id로 단건 로드.
import { useEffect, useState } from "react";

import { supabaseTeeRepository } from "@/features/catalog/data/supabase-tee-repository";
import type { TeeRepository } from "@/features/catalog/data/tee-repository";
import type { Tee } from "@/features/catalog/domain/tee";

export interface TeeDetailViewModel {
  loading: boolean;
  tee: Tee | null;
}

export function useTeeDetailViewModel(
  id: string,
  repository: TeeRepository = supabaseTeeRepository,
): TeeDetailViewModel {
  const [tee, setTee] = useState<Tee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void repository.getById(id).then((data) => {
      if (!active) return;
      setTee(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id, repository]);

  return { loading, tee };
}
