import { Suspense } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminLoadingState } from "@/components/admin/admin-ui";
import { requireAdminSession } from "@/lib/server/auth-session";

// Rotas com sessão e banco são deliberadamente bloqueantes no Next.js 16.
export const instant = false;

async function ProtectedAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  return <AdminShell userName={session.user.name}>{children}</AdminShell>;
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminLoadingState />}>
      <ProtectedAdminShell>{children}</ProtectedAdminShell>
    </Suspense>
  );
}
