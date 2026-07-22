// Repository 인터페이스 (Clean Architecture의 경계).
// UI·유스케이스는 이 인터페이스에만 의존한다. 구현(목업/네이버API/Supabase)은 갈아끼운다.
import type { Tee } from "@/features/catalog/domain/tee";

export interface TeeRepository {
  /** 전체 상품을 가져온다. (실제 구현은 네트워크라 async) */
  getAll(): Promise<Tee[]>;
  /** 단건 조회. 없으면 null. */
  getById(id: string): Promise<Tee | null>;
}
