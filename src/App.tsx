import { Boxes, Database, Network, ShieldCheck, Zap } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ConnectionDialog } from "@/components/connection-dialog";
import { ErrorBoundary } from "@/components/error-boundary";
import { Providers } from "@/components/providers";
import { SectionLayout, SoonPage } from "@/components/section-layout";
import { TopNav } from "@/components/top-nav";
import { COMPUTE_ITEMS, DBCACHE_ITEMS, FUNCTION_ITEMS, IAM_ITEMS, VPC_ITEMS } from "@/lib/sections";
import { AlbDetailPage, AlbPage } from "@/pages/alb";
import { AsgPage } from "@/pages/asg";
import { Ec2Page } from "@/pages/ec2";
import { InstanceProfilesPage } from "@/pages/iam-instance-profiles";
import { IamPoliciesPage, IamPolicyDetailPage } from "@/pages/iam-policies";
import { IamRoleDetailPage, IamRolesPage } from "@/pages/iam-roles";
import { KeyPairsPage } from "@/pages/key-pairs";
import { LaunchTemplatesPage } from "@/pages/launch-templates";
import { S3Page } from "@/pages/s3";
import { SecurityGroupDetailPage, SecurityGroupsPage } from "@/pages/security-groups";
import { TargetGroupsPage } from "@/pages/target-groups";
import { VolumesPage } from "@/pages/volumes";
import { useSettings } from "@/store/settings";

export function App() {
  const configured = useSettings((s) => s.configured);
  const s = useSettings((st) => st.settings);
  // Remount the subtree when the connection target changes to reset selection state
  const connectionId = `${s.endpoint}|${s.region}|${s.accessKeyId}`;

  return (
    <Providers>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        {configured ? (
          <div className="flex h-full flex-col">
            <TopNav />
            {/* Remount the boundary on navigation/connection change so a caught error clears. */}
            <ErrorBoundary key={connectionId}>
              <div className="flex-1 overflow-hidden">
                <Routes>
                  <Route path="/s3" element={<S3Page />} />

                  <Route
                    path="/compute"
                    element={
                      <SectionLayout
                        titleKey="compute.section"
                        icon={Boxes}
                        items={COMPUTE_ITEMS}
                      />
                    }
                  >
                    <Route index element={<Navigate to="instances" replace />} />
                    <Route path="instances" element={<Ec2Page />} />
                    <Route path="security-groups" element={<SecurityGroupsPage />} />
                    <Route path="security-groups/:groupId" element={<SecurityGroupDetailPage />} />
                    <Route path="volumes" element={<VolumesPage />} />
                    <Route path="launch-templates" element={<LaunchTemplatesPage />} />
                    <Route path="key-pairs" element={<KeyPairsPage />} />
                    <Route path="load-balancers" element={<AlbPage />} />
                    <Route path="load-balancers/:lbName" element={<AlbDetailPage />} />
                    <Route path="target-groups" element={<TargetGroupsPage />} />
                    <Route path="asg" element={<AsgPage />} />
                  </Route>

                  <Route
                    path="/vpc"
                    element={
                      <SectionLayout titleKey="vpc.section" icon={Network} items={VPC_ITEMS} />
                    }
                  >
                    <Route index element={<Navigate to="vpcs" replace />} />
                    {VPC_ITEMS.map((it) => (
                      <Route
                        key={it.path}
                        path={it.path}
                        element={<SoonPage labelKey={it.labelKey} />}
                      />
                    ))}
                  </Route>

                  <Route
                    path="/db"
                    element={
                      <SectionLayout
                        titleKey="dbcache.section"
                        icon={Database}
                        items={DBCACHE_ITEMS}
                      />
                    }
                  >
                    <Route index element={<Navigate to="db-clusters" replace />} />
                    {DBCACHE_ITEMS.map((it) => (
                      <Route
                        key={it.path}
                        path={it.path}
                        element={<SoonPage labelKey={it.labelKey} />}
                      />
                    ))}
                  </Route>

                  <Route
                    path="/function"
                    element={
                      <SectionLayout
                        titleKey="function.section"
                        icon={Zap}
                        items={FUNCTION_ITEMS}
                      />
                    }
                  >
                    <Route index element={<Navigate to="functions" replace />} />
                    {FUNCTION_ITEMS.map((it) => (
                      <Route
                        key={it.path}
                        path={it.path}
                        element={<SoonPage labelKey={it.labelKey} />}
                      />
                    ))}
                  </Route>

                  <Route
                    path="/iam"
                    element={
                      <SectionLayout titleKey="iam.section" icon={ShieldCheck} items={IAM_ITEMS} />
                    }
                  >
                    <Route index element={<Navigate to="roles" replace />} />
                    <Route path="roles" element={<IamRolesPage />} />
                    <Route path="roles/:roleName" element={<IamRoleDetailPage />} />
                    <Route path="instance-profiles" element={<InstanceProfilesPage />} />
                    <Route path="policies" element={<IamPoliciesPage />} />
                    <Route path="policies/:policyId" element={<IamPolicyDetailPage />} />
                  </Route>

                  {/* Back-compat redirects from the old flat tab paths */}
                  <Route path="/ec2" element={<Navigate to="/compute/instances" replace />} />
                  <Route path="/alb" element={<Navigate to="/compute/load-balancers" replace />} />
                  <Route path="/asg" element={<Navigate to="/compute/asg" replace />} />
                  <Route path="*" element={<Navigate to="/s3" replace />} />
                </Routes>
              </div>
            </ErrorBoundary>
          </div>
        ) : (
          <div className="h-full bg-slate-100" />
        )}

        {/* First run: force the connection dialog when no settings exist in localStorage */}
        <ConnectionDialog mode="setup" open={!configured} onClose={() => {}} />
      </BrowserRouter>
    </Providers>
  );
}
