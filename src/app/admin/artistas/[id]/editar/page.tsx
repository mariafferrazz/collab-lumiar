import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateArtistAction } from "@/app/admin/actions";
import { AdminBreadcrumbs, AdminPageHeader } from "@/components/admin/admin-ui";
import { ArtistForm } from "@/components/admin/artist-form";
import { isUuid } from "@/lib/admin/validation";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = { title: "Editar artista — Administração" };

export default async function EditArtistPage({
  params,
}: PageProps<"/admin/artistas/[id]/editar">) {
  await requireAdminSession();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const detail = await adminCatalog.artist(id);
  if (!detail) notFound();
  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Artistas", href: "/admin/artistas" },
          { label: detail.artist.artisticName, href: `/admin/artistas/${id}` },
          { label: "Editar" },
        ]}
      />
      <AdminPageHeader
        description="Atualize somente informações públicas autorizadas."
        eyebrow="Artistas"
        title="Editar perfil"
      />
      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-8">
        <ArtistForm action={updateArtistAction} values={detail.artist} />
      </section>
    </div>
  );
}
