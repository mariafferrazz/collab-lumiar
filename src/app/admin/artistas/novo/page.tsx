import type { Metadata } from "next";

import { createArtistAction } from "@/app/admin/actions";
import { AdminBreadcrumbs, AdminPageHeader } from "@/components/admin/admin-ui";
import { ArtistForm } from "@/components/admin/artist-form";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = { title: "Novo artista — Administração" };

export default async function NewArtistPage() {
  await requireAdminSession();
  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Artistas", href: "/admin/artistas" },
          { label: "Novo" },
        ]}
      />
      <AdminPageHeader
        description="Cadastre somente informações públicas e profissionais autorizadas pelo artista."
        eyebrow="Artistas"
        title="Novo perfil"
      />
      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-8">
        <ArtistForm action={createArtistAction} />
      </section>
    </div>
  );
}
