// 페이지 3 — /tee/[id]. Next 16: params는 Promise. 본체는 product-detail feature.
import ProductDetail from "@/features/product-detail/presentation/components/ProductDetail";

export default async function TeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetail id={id} />;
}
